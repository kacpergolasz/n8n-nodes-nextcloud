import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadFolders } from '../../NextcloudNews/GenericFunctions';
import { nodeApiErrorPayload } from '../../shared/parse';
import { formatNewsAccessErrorMessage, getHttpStatusCode } from '../../NextcloudNews/shared/httpStatus';
import { scrubErrorMessage } from '../../NextcloudNews/shared/scrubSecrets';

export async function getFolders(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const folders = await loadFolders(this);
		return {
			results: folders.map((folder) => ({ name: folder.name, value: folder.value })),
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
