import type { IHttpRequestOptions } from 'n8n-workflow';

import type { NextcloudHttpMethod } from '../shared/assertHttpMethodIsValid';
import { assertHttpMethodIsValid } from '../shared/assertHttpMethodIsValid';
import { isPlainObject } from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import { getHttpStatusCode } from './shared/httpStatus';

/**
 * Result wrapper returned by every FilesClient call. A call either succeeds
 * with the parsed response or fails with a descriptive Error — it never throws.
 */
type Maybe =
	| {
			success: true;
			response: unknown;
	  }
	| {
			success: false;
			error: Error;
	  };

export type FilesClientEncoding =
	| 'json'
	| 'arraybuffer'
	| 'blob'
	| 'document'
	| 'text'
	| 'stream';

export type FilesClientRequestOptions = {
	/** When false, skip JSON parse (WebDAV XML / binary). Default true for OCS JSON. */
	json?: boolean;
	encoding?: FilesClientEncoding;
	/** When true, treat HTTP 4xx/5xx as a successful transport so OCS envelopes can be read. */
	ignoreHttpStatusErrors?: boolean;
};

export type FilesClientBody = string | Buffer | Record<string, unknown>;

/**
 * Typed HTTP client for Nextcloud Files (WebDAV + OCS).
 *
 * Two servers share one host: WebDAV under `/remote.php/dav/files/…` and OCS under
 * `/ocs/v2.php/…`. Pass absolute WebDAV URLs for file operations; pass host-relative
 * OCS paths for sharing. Auth is injected by `httpRequestWithAuthentication`.
 *
 * Reference: nodes/NextcloudFiles/context/api/documentation/openapi.md
 */
export class FilesClient {
	#baseUrl: string;
	#username: string;
	#headers: Record<string, string>;
	#context: NextcloudRequestContext;

	/** The constructor is the ONLY place where the `private` keyword is allowed. */
	private constructor(
		baseUrl: string,
		username: string,
		defaultHeaders: Record<string, string>,
		context: NextcloudRequestContext,
	) {
		this.#baseUrl = baseUrl.replace(/\/+$/, '');
		this.#username = username;
		this.#headers = defaultHeaders;
		this.#context = context;
	}

	/** Credential host used to resolve relative OCS paths. */
	public get baseUrl(): string {
		return this.#baseUrl;
	}

	/** Nextcloud username (WebDAV path segment + listing parse). */
	public get username(): string {
		return this.#username;
	}

	/**
	 * Factory for n8n node/listSearch paths. Reads host + username from the
	 * `nextcloudApi` credential. Auth is injected by
	 * `httpRequestWithAuthentication` — do not set Authorization here.
	 */
	public static async fromN8nContext(context: NextcloudRequestContext): Promise<FilesClient> {
		const credentials = await context.getCredentials('nextcloudApi');
		const baseUrl = credentials.baseUrl;
		const username = credentials.username;
		if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
			throw new Error('Base URL is required');
		}
		if (typeof username !== 'string' || !username.trim()) {
			throw new Error('Username is required');
		}
		return new FilesClient(baseUrl.replace(/\/+$/, ''), username.trim(), {}, context);
	}

	#messageFromResponseBody(body: unknown): string {
		let parsed = body;
		if (typeof body === 'string') {
			const text = body.trim();
			if (!text) {
				return '';
			}
			try {
				parsed = JSON.parse(text);
			} catch {
				return text;
			}
		}

		if (!isPlainObject(parsed)) {
			return '';
		}

		const ocs = parsed.ocs;
		if (isPlainObject(ocs) && isPlainObject(ocs.meta) && typeof ocs.meta.message === 'string') {
			return ocs.meta.message.trim();
		}

		for (const key of ['message', 'error'] as const) {
			const value = parsed[key];
			if (typeof value === 'string' && value.trim()) {
				return value.trim();
			}
		}

		return '';
	}

	#responseBodyFromCause(cause: unknown): unknown {
		if (!isPlainObject(cause)) {
			return undefined;
		}

		const response = cause.response;
		if (isPlainObject(response) && 'body' in response) {
			return response.body;
		}

		if ('body' in cause) {
			return cause.body;
		}

		if (typeof cause.description === 'string') {
			return cause.description;
		}

		return undefined;
	}

	#webDavHintForStatus(statusCode: number | undefined): string | undefined {
		if (statusCode === 412) {
			return 'Destination already exists. Enable Overwrite, or choose a different destination path.';
		}
		return undefined;
	}

	/** Formats n8n / HTTP failures into a descriptive Files API error. */
	#createError(cause: unknown): Error {
		const statusCode = getHttpStatusCode(cause);
		const rawDetail =
			this.#messageFromResponseBody(this.#responseBodyFromCause(cause)) ||
			(cause instanceof Error ? cause.message.trim() : '') ||
			(typeof cause === 'string' ? cause.trim() : '');

		const genericAxios =
			statusCode !== undefined &&
			new RegExp(`^request failed with status code ${statusCode}\\.?$`, 'i').test(rawDetail);
		const hint = this.#webDavHintForStatus(statusCode);
		const detail =
			!rawDetail || genericAxios || /^precondition failed\.?$/i.test(rawDetail)
				? (hint ?? '')
				: rawDetail;

		const statusPart =
			statusCode !== undefined
				? String(statusCode)
				: cause instanceof Error && cause.message
					? cause.message
					: 'request failed';
		const suffix = detail && detail !== statusPart ? ` — ${detail}` : '';
		const error = new Error(`Files API request failed: ${statusPart}${suffix}`);

		if (statusCode !== undefined) {
			Object.assign(error, { statusCode });
		}

		return error;
	}


	/** Safely combines base URL, path and query parameters. Absolute URLs pass through. */
	#buildUrl(path: string, query?: Record<string, string>): string {
		const url = new URL(path.startsWith('http') ? path : `${this.#baseUrl}${path}`);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				url.searchParams.append(key, value);
			}
		}
		return url.toString();
	}

	#stringifyQuery(
		query?: Record<string, string | number | boolean>,
	): Record<string, string> | undefined {
		if (!query) {
			return undefined;
		}
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(query)) {
			result[key] = String(value);
		}
		return result;
	}

	async #request(
		method: NextcloudHttpMethod,
		path: string,
		body?: FilesClientBody,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions: FilesClientRequestOptions = {},
	): Promise<Maybe> {
		try {
			assertHttpMethodIsValid(method);
			const json = requestOptions.json === true;
			const url = this.#buildUrl(path, this.#stringifyQuery(query));
			const mergedHeaders: Record<string, string> = {
				...this.#headers,
				...headers,
			};

			const options: IHttpRequestOptions = {
				method,
				url,
				headers: mergedHeaders,
				json,
				encoding: requestOptions.encoding,
				ignoreHttpStatusErrors: requestOptions.ignoreHttpStatusErrors,
			};
			if (body !== undefined) {
				options.body = body;
			}

			const response = await this.#context.helpers.httpRequestWithAuthentication.call(
				this.#context,
				'nextcloudApi',
				options,
			);
			return {
				success: true,
				response: response === '' ? undefined : response,
			};
		} catch (err) {
			return {
				success: false,
				error: this.#createError(err),
			};
		}
	}

	public async get(
		path: string,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('GET', path, undefined, query, headers, requestOptions);
	}

	public async post(
		path: string,
		body?: FilesClientBody,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('POST', path, body, query, headers, requestOptions);
	}

	public async put(
		path: string,
		body?: FilesClientBody,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('PUT', path, body, query, headers, requestOptions);
	}

	public async delete(
		path: string,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('DELETE', path, undefined, query, headers, requestOptions);
	}

	public async propfind(
		path: string,
		body?: string,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('PROPFIND', path, body, undefined, headers, {
			json: false,
			...requestOptions,
		});
	}

	public async mkcol(
		path: string,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('MKCOL', path, undefined, undefined, headers, {
			json: false,
			...requestOptions,
		});
	}

	public async move(
		path: string,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('MOVE', path, undefined, undefined, headers, {
			json: false,
			...requestOptions,
		});
	}

	public async copy(
		path: string,
		headers?: Record<string, string>,
		requestOptions?: FilesClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('COPY', path, undefined, undefined, headers, {
			json: false,
			...requestOptions,
		});
	}
}
