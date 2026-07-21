import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';

/**
 * Contexts that can call `getCredentials` / `httpRequestWithAuthentication`.
 * Includes `IPollFunctions` so trigger poll paths need no adapter cast.
 */
export type NextcloudRequestContext =
	| ILoadOptionsFunctions
	| IExecuteFunctions
	| IPollFunctions;
