import type { IHttpRequestOptions } from 'n8n-workflow';

import { isPlainObject } from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import { getHttpStatusCode } from './shared/httpStatus';

const DECK_API_PATH = '/index.php/apps/deck/api/v1.0';

/**
 * Result wrapper returned by every DeckClient call. A call either succeeds
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

type DeckHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Minimal typed HTTP client for the Nextcloud Deck API (v1.0/v1.1).
 *
 * Two servers exist — the REST API and the OCS API (config, comments,
 * sessions). Instantiate the client with the desired base URL and pass an
 * absolute URL as `path` to target the other one.
 *
 * n8n operations should use `fromN8nContext` so the server URL comes from
 * context credentials and requests go through `httpRequestWithAuthentication`
 * (proxy, TLS, credential injection, and structured HTTP errors). The
 * Basic/Bearer factories keep a fetch transport for standalone use.
 *
 * Every request sends `OCS-APIRequest: true` and `Content-Type: application/json`
 * by default; attachment uploads should pass `multipart/form-data` as a
 * `FormData` body (the Content-Type header is then left to the runtime).
 *
 * Reference: nodes/NextcloudDeck/context/api/documentation/openapi.md
 */
export class DeckClient {
	#baseUrl: string;
	#headers: Record<string, string>;
	#context: NextcloudRequestContext;

	/** The constructor is the ONLY place where the `private` keyword is allowed. */
	private constructor(
		baseUrl: string,
		defaultHeaders: Record<string, string>,
		context: NextcloudRequestContext
	) {
		this.#baseUrl = baseUrl.replace(/\/+$/, '');
		this.#headers = defaultHeaders;
		this.#context = context;
	}

	/**
	 * Factory for n8n node/listSearch paths. Reads the Deck API base URL from
	 * the `nextcloudApi` credential on context. Auth is injected by
	 * `httpRequestWithAuthentication` — do not set Authorization here.
	 */
	public static async fromN8nContext(context: NextcloudRequestContext): Promise<DeckClient> {
		const { baseUrl } = await context.getCredentials('nextcloudApi');
		if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
			throw new Error('Base URL is required');
		}
		return new DeckClient(
			`${baseUrl.replace(/\/+$/, '')}${DECK_API_PATH}`,
			{
				'OCS-APIRequest': 'true',
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

		const ocs = parsed.ocs;
		if (isPlainObject(ocs) && isPlainObject(ocs.meta) && typeof ocs.meta.message === 'string') {
			return ocs.meta.message;
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

	/** Formats n8n / HTTP failures into a descriptive Deck API error. */
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
		const error = new Error(`Deck API request failed: ${statusPart}${suffix}`);

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

	#mergeHeaders(
		headers: Record<string, string> | undefined,
		body: Record<string, unknown> | FormData | undefined,
	): Record<string, string> {
		const mergedHeaders = { ...this.#headers, ...headers };
		if (body instanceof FormData) {
			delete mergedHeaders['Content-Type'];
		}
		return mergedHeaders;
	}

	async #request(
		method: DeckHttpMethod,
		path: string,
		body?: Record<string, unknown> | FormData,
		query?: Record<string, string>,
		headers?: Record<string, string>,
	): Promise<Maybe> {
		try {
			const url = this.#buildUrl(path, query);
			const mergedHeaders = this.#mergeHeaders(headers, body);
			const isFormData = body instanceof FormData;
			const options: IHttpRequestOptions = {
				method,
				url,
				headers: mergedHeaders,
				json: !isFormData,
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
		query?: Record<string, string>,
		headers?: Record<string, string>,
	): Promise<Maybe> {
		return await this.#request('GET', path, undefined, query, headers);
	}

	public async post(
		path: string,
		body?: Record<string, unknown> | FormData,
		query?: Record<string, string>,
		headers?: Record<string, string>,
	): Promise<Maybe> {
		return await this.#request('POST', path, body, query, headers);
	}

	public async put(
		path: string,
		body?: Record<string, unknown> | FormData,
		query?: Record<string, string>,
		headers?: Record<string, string>,
	): Promise<Maybe> {
		return await this.#request('PUT', path, body, query, headers);
	}

	public async delete(
		path: string,
		query?: Record<string, string>,
		headers?: Record<string, string>,
	): Promise<Maybe> {
		return await this.#request('DELETE', path, undefined, query, headers);
	}
}
