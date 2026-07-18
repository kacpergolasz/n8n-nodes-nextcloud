import type { ILoadOptionsFunctions, INodeListSearchResult, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadBoards } from '../GenericFunctions';
import { formatDeckAccessErrorMessage, getHttpStatusCode } from '../shared/httpStatus';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getBoards(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const boards = await loadBoards(this);
		return {
			results: boards.map((board) => ({ name: board.name, value: board.value })),
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
		const message = formatDeckAccessErrorMessage(statusCode, scrubbedMessage);
		throw new NodeApiError(this.getNode(), { message } as JsonObject);
	}
}
