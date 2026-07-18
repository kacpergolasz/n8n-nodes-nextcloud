import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeParameterResourceLocator,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadStacks, resolveBoardId } from '../GenericFunctions';
import { formatDeckAccessErrorMessage, getHttpStatusCode } from '../shared/httpStatus';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getStacks(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const board = this.getCurrentNodeParameter('board') as
			| INodeParameterResourceLocator
			| undefined;
		if (!board?.value) {
			return { results: [] };
		}

		const boardId = resolveBoardId(board.value as string);
		const stacks = await loadStacks(this, boardId);
		return {
			results: stacks.map((stack) => ({ name: stack.name, value: stack.value })),
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
