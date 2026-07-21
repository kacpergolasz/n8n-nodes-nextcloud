import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	buildPathListSearchCacheKey,
	collectPathEntriesRecursive,
	directoryEntryToListOption,
	getCachedPathListOptions,
	getCredentials,
	resolvePathListSearchScope,
	paginatePathListOptions,
	setCachedPathListOptions,
} from '../GenericFunctions';
import { scrubErrorMessage } from '../shared/scrubSecrets';
import { nodeApiErrorPayload, parseOptionalString } from '../../shared/parse';

function parsePaginationOffset(paginationToken?: string): number {
	if (!paginationToken?.trim()) return 0;

	const offset = Number(paginationToken);
	return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

export async function getFolders(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	try {
		const credentials = await getCredentials(this);
		const resource = parseOptionalString(this.getNodeParameter('resource'), 'Resource');
		const operation = parseOptionalString(this.getNodeParameter('operation'), 'Operation');
		const scope = resolvePathListSearchScope(resource, operation);
		const cacheKey = buildPathListSearchCacheKey(credentials, resource, operation, filter);
		const offset = parsePaginationOffset(paginationToken);

		let options = offset > 0 ? getCachedPathListOptions(cacheKey) : undefined;
		if (!options) {
			const entries = await collectPathEntriesRecursive(this, credentials, {
				...scope,
				filter,
			});
			options = entries.map(directoryEntryToListOption);
			setCachedPathListOptions(cacheKey, options);
		}

		return paginatePathListOptions(options, offset);
	} catch (error) {
		let secrets = {};
		try {
			secrets = await getCredentials(this);
		} catch {
			// ignore credential load failures while scrubbing
		}
		const scrubbedMessage = scrubErrorMessage(error, secrets);
		throw new NodeApiError(this.getNode(), nodeApiErrorPayload(scrubbedMessage));
	}
}
