import type { ILoadOptionsFunctions, INodeListSearchResult, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	directoryEntryToListOption,
	getCredentials,
	loadDirectoryListing,
	normalizeFilesPath,
} from '../GenericFunctions';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getFolders(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	try {
		const credentials = await getCredentials(this);
		const directoryPath = normalizeFilesPath(filter ?? '/');
		const entries = await loadDirectoryListing(this, credentials, directoryPath);
		const results = entries.map(directoryEntryToListOption);

		if (directoryPath !== '/') {
			const parent =
				directoryPath.lastIndexOf('/') > 0
					? directoryPath.slice(0, directoryPath.lastIndexOf('/')) || '/'
					: '/';
			results.unshift({
				name: '📁 ..',
				value: parent,
			});
		}

		return { results };
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
