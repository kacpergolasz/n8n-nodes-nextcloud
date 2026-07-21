import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadStacks, resolveBoardId } from '../GenericFunctions';
import { nodeApiErrorPayload, parseLocatorParamValue } from '../../shared/parse';
import { formatDeckAccessErrorMessage, getHttpStatusCode } from '../shared/httpStatus';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getStacks(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const boardValue = parseLocatorParamValue(this.getCurrentNodeParameter('board'));
		if (!boardValue) {
			return { results: [] };
		}

		const boardId = resolveBoardId(boardValue);
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
		throw new NodeApiError(this.getNode(), nodeApiErrorPayload(message));
	}
}
