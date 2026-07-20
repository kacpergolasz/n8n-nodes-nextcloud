import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeParameterResourceLocator,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadFeeds, resolveFolderId } from '../GenericFunctions';
import { formatNewsAccessErrorMessage, getHttpStatusCode } from '../shared/httpStatus';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getFeeds(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const folderFilter = this.getCurrentNodeParameter('folderFilter') as
			| INodeParameterResourceLocator
			| undefined;
		const folderId =
			folderFilter?.value !== undefined &&
			folderFilter.value !== null &&
			folderFilter.value !== ''
				? resolveFolderId(folderFilter.value as string)
				: undefined;

		const feeds = await loadFeeds(this, folderId);
		return {
			results: feeds.map((feed) => ({ name: feed.name, value: feed.value })),
		};
	} catch (error) {
		let secrets = {};
		try {
			secrets = await getCredentials(this);
		} catch {
			// ignore credential load failures while scrubbing
		}
		const scrubbedMessage = scrubErrorMessage(error, secrets);
		const statusCode = getHttpStatusCode(error);
		const message = formatNewsAccessErrorMessage(statusCode, scrubbedMessage);
		throw new NodeApiError(this.getNode(), { message } as JsonObject);
	}
}
