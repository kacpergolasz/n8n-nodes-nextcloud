import type { IHttpRequestMethods } from 'n8n-workflow';

/** n8n's IHttpRequestMethods omits WebDAV verbs like PROPFIND, MKCOL, MOVE, and COPY. */
export type NextcloudHttpMethod = IHttpRequestMethods | 'PROPFIND' | 'MKCOL' | 'MOVE' | 'COPY';

/**
 * Narrow suite WebDAV/CalDAV verbs to n8n's `IHttpRequestMethods` at the HTTP boundary.
 *
 * n8n's union is only DELETE|GET|HEAD|PATCH|POST|PUT — it omits PROPFIND, MKCOL, MOVE, COPY.
 * Runtime accepts those verbs; this assertion teaches TypeScript the call is safe without `as`.
 */
export function assertHttpMethodIsValid(
	method: NextcloudHttpMethod,
): asserts method is IHttpRequestMethods {
	const validMethods: string[] = [
		'DELETE',
		'GET',
		'HEAD',
		'PATCH',
		'POST',
		'PUT',
	] satisfies IHttpRequestMethods[];
	const nextcloudMethods: string[] = [
		'PROPFIND',
		'MKCOL',
		'MOVE',
		'COPY',
	] satisfies NextcloudHttpMethod[];

	if (!validMethods.includes(method) && !nextcloudMethods.includes(method)) {
		throw new Error(`Invalid HTTP method: ${method}`);
	}
}
