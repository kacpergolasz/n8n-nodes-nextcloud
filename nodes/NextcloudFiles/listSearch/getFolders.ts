import type { ILoadOptionsFunctions, INodeListSearchResult, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	collectPathEntriesRecursive,
	directoryEntryToListOption,
	getCredentials,
	resolvePathListSearchScope,
	paginatePathListOptions,
} from '../GenericFunctions';
import { scrubErrorMessage } from '../shared/scrubSecrets';

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
		const resource = this.getNodeParameter('resource') as string | undefined;
		const operation = this.getNodeParameter('operation') as string | undefined;
		const scope = resolvePathListSearchScope(resource, operation);
		const entries = await collectPathEntriesRecursive(this, credentials, {
			...scope,
			filter,
		});
		const options = entries.map(directoryEntryToListOption);
		const offset = parsePaginationOffset(paginationToken);
		const page = paginatePathListOptions(options, offset);

		return page;
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
