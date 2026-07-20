import type { ILoadOptionsFunctions, INodeListSearchResult, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	buildPathListSearchCacheKey,
	collectPathEntriesRecursive,
	directoryEntryToListOption,
	getCachedPathListOptions,
	getCredentials,
	paginatePathListOptions,
	setCachedPathListOptions,
} from '../../NextcloudFiles/GenericFunctions';
import { scrubErrorMessage } from '../../NextcloudFiles/shared/scrubSecrets';

const FOLDERS_ONLY_SCOPE = { includeFiles: false, includeFolders: true } as const;
const LIST_SEARCH_RESOURCE = 'trigger';
const LIST_SEARCH_OPERATION = 'folderToWatch';

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
		const cacheKey = buildPathListSearchCacheKey(
			credentials,
			LIST_SEARCH_RESOURCE,
			LIST_SEARCH_OPERATION,
			filter,
		);
		const offset = parsePaginationOffset(paginationToken);

		let options = offset > 0 ? getCachedPathListOptions(cacheKey) : undefined;
		if (!options) {
			const entries = await collectPathEntriesRecursive(this, credentials, {
				...FOLDERS_ONLY_SCOPE,
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
		throw new NodeApiError(this.getNode(), { message: scrubbedMessage } as JsonObject);
	}
}
