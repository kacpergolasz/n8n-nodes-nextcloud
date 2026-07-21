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
		const raw = this.getCurrentNodeParameter('folder') as unknown;
		// Match poll/execute helpers: accept RLC `{ value }` or bare
		// numeric/string expression results (e.g. `={{ $json.folderId }}`).
		const value =
			raw !== null && typeof raw === 'object' && 'value' in (raw as object)
				? (raw as INodeParameterResourceLocator).value
				: raw;
		const folderId =
			value !== undefined && value !== null && String(value).trim() !== ''
				? resolveFolderId(value as string | number)
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
