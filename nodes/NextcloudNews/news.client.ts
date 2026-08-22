import type { IHttpRequestOptions } from 'n8n-workflow';

import { isPlainObject } from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import { getHttpStatusCode } from './shared/httpStatus';

const NEWS_API_PATH = '/index.php/apps/news/api/v1-3';

/**
 * Result wrapper returned by every NewsClient call. A call either succeeds
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

type NewsHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type NewsClientEncoding =
	| 'json'
	| 'arraybuffer'
	| 'blob'
	| 'document'
	| 'text'
	| 'stream';

export type NewsClientRequestOptions = {
	/** When false, skip JSON parse (favicon / binary). Default true. */
	json?: boolean;
	encoding?: NewsClientEncoding;
};

/**
 * Minimal typed HTTP client for the Nextcloud News API (v1-3).
 *
 * n8n operations should use `fromN8nContext` so the server URL comes from
 * context credentials and requests go through `httpRequestWithAuthentication`
 * (proxy, TLS, credential injection, and structured HTTP errors).
 *
 * Reference: nodes/NextcloudNews/context/api/documentation/openapi.md
 */
export class NewsClient {
	#baseUrl: string;
	#headers: Record<string, string>;
	#context: NextcloudRequestContext;

	/** The constructor is the ONLY place where the `private` keyword is allowed. */
	private constructor(
		baseUrl: string,
		defaultHeaders: Record<string, string>,
		context: NextcloudRequestContext,
	) {
		this.#baseUrl = baseUrl.replace(/\/+$/, '');
		this.#headers = defaultHeaders;
		this.#context = context;
	}

	/**
	 * Factory for n8n node/listSearch paths. Reads the News API base URL from
	 * the `nextcloudApi` credential on context. Auth is injected by
	 * `httpRequestWithAuthentication` — do not set Authorization here.
	 */
	public static async fromN8nContext(context: NextcloudRequestContext): Promise<NewsClient> {
		const { baseUrl } = await context.getCredentials('nextcloudApi');
		if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
			throw new Error('Base URL is required');
		}
		return new NewsClient(
			`${baseUrl.replace(/\/+$/, '')}${NEWS_API_PATH}`,
			{
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			context,
		);
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

	/** Formats n8n / HTTP failures into a descriptive News API error. */
	#createError(cause: unknown): Error {
		const statusCode = getHttpStatusCode(cause);
		const detail =
			this.#messageFromResponseBody(this.#responseBodyFromCause(cause)) ||
			(cause instanceof Error ? cause.message.trim() : '') ||
			(typeof cause === 'string' ? cause.trim() : '');

		const statusPart =
			statusCode !== undefined
				? String(statusCode)
				: cause instanceof Error && cause.message
					? cause.message
					: 'request failed';
		const suffix = detail && detail !== statusPart ? ` — ${detail}` : '';
		const error = new Error(`News API request failed: ${statusPart}${suffix}`);

		if (statusCode !== undefined) {
			Object.assign(error, { statusCode });
		}

		return error;
	}

	/** Safely combines base URL, path and query parameters. */
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
		method: NewsHttpMethod,
		path: string,
		body?: Record<string, unknown>,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions: NewsClientRequestOptions = {},
	): Promise<Maybe> {
		try {
			const json = requestOptions.json !== false;
			const url = this.#buildUrl(path, this.#stringifyQuery(query));
			const mergedHeaders: Record<string, string> = {
				...this.#headers,
				Accept: json ? 'application/json' : '*/*',
				...(json ? { 'Content-Type': 'application/json' } : {}),
				...headers,
			};
			if (!json) {
				delete mergedHeaders['Content-Type'];
			}

			const options: IHttpRequestOptions = {
				method,
				url,
				headers: mergedHeaders,
				json,
				encoding: requestOptions.encoding,
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
		requestOptions?: NewsClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('GET', path, undefined, query, headers, requestOptions);
	}

	public async post(
		path: string,
		body?: Record<string, unknown>,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: NewsClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('POST', path, body, query, headers, requestOptions);
	}

	public async put(
		path: string,
		body?: Record<string, unknown>,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: NewsClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('PUT', path, body, query, headers, requestOptions);
	}

	public async delete(
		path: string,
		query?: Record<string, string | number | boolean>,
		headers?: Record<string, string>,
		requestOptions?: NewsClientRequestOptions,
	): Promise<Maybe> {
		return await this.#request('DELETE', path, undefined, query, headers, requestOptions);
	}
}
