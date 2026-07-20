import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeParameterResourceLocator,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadFeeds, resolveFolderId } from '../../NextcloudNews/GenericFunctions';
import { formatNewsAccessErrorMessage, getHttpStatusCode } from '../../NextcloudNews/shared/httpStatus';
import { scrubErrorMessage } from '../../NextcloudNews/shared/scrubSecrets';

export async function getFeeds(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const folder = this.getCurrentNodeParameter('folder') as
			| INodeParameterResourceLocator
			| undefined;
		const folderId =
			folder?.value !== undefined && folder.value !== null && folder.value !== ''
				? resolveFolderId(folder.value as string)
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
