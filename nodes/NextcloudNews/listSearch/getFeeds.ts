import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadFeeds, resolveFolderId } from '../GenericFunctions';
import { nodeApiErrorPayload, parseLocatorParamValue } from '../../shared/parse';
import { formatNewsAccessErrorMessage, getHttpStatusCode } from '../shared/httpStatus';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getFeeds(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const raw = this.getCurrentNodeParameter('folderFilter');
		const valueStr = parseLocatorParamValue(raw);
		const folderId =
			valueStr !== undefined ? resolveFolderId(valueStr) : undefined;

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
		throw new NodeApiError(this.getNode(), nodeApiErrorPayload(message));
	}
}
