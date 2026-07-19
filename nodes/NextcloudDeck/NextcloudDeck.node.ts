import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { getCredentials } from './GenericFunctions';
import { getBoards } from './listSearch/getBoards';
import { getStacks } from './listSearch/getStacks';
import { boardDescription } from './resources/board';
import { boardCreate } from './resources/board/create';
import { boardDelete } from './resources/board/delete';
import { boardGet } from './resources/board/get';
import { boardGetAll } from './resources/board/getAll';
import { boardUpdate } from './resources/board/update';
import type { BoardOperationContext } from './resources/board/types';
import { cardDescription } from './resources/card';
import { cardCreate } from './resources/card/create';
import { cardDelete } from './resources/card/delete';
import { cardGet } from './resources/card/get';
import { cardGetAll } from './resources/card/getAll';
import { cardMove } from './resources/card/move';
import { cardUpdate } from './resources/card/update';
import type { CardOperationContext } from './resources/card/types';
import { resolveBoardFromInput } from './resources/shared/resolveInput';
import { stackDescription } from './resources/stack';
import { stackCreate } from './resources/stack/create';
import { stackGetAll } from './resources/stack/getAll';
import type { StackOperationContext } from './resources/stack/types';
import { formatDeckAccessErrorMessage, getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';

export class NextcloudDeck implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Deck',
		name: 'nextcloudDeck',
		icon: 'file:nextcloudDeck.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Automate Nextcloud Deck boards, stacks, and cards',
		defaults: {
			name: 'Nextcloud Deck',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nextcloudApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				// Card-first ordering matches primary workflow (cards → board → stack context)
				// eslint-disable-next-line @n8n/community-nodes/options-sorted-alphabetically
				options: [
					{ name: 'Card', value: 'card' },
					{ name: 'Board', value: 'board' },
					{ name: 'Stack', value: 'stack' },
				],
				default: 'card',
			},
			...cardDescription,
			...boardDescription,
			...stackDescription,
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getBoards,
			getStacks,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await getCredentials(this);

		for (let i = 0; i < items.length; i++) {
			const outputCountBefore = returnData.length;
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'board') {
					const opCtx: BoardOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'create':
							returnData.push(await boardCreate(this, opCtx));
							break;
						case 'get':
							returnData.push(await boardGet(this, opCtx));
							break;
						case 'getAll':
							returnData.push(...(await boardGetAll(this, opCtx)));
							break;
						case 'update':
							returnData.push(await boardUpdate(this, opCtx));
							break;
						case 'delete':
							returnData.push(await boardDelete(this, opCtx));
							break;
					}
				} else if (resource === 'stack') {
					const boardId = resolveBoardFromInput(this, i);
					const opCtx: StackOperationContext = { itemIndex: i, credentials, boardId };
					switch (operation) {
						case 'create':
							returnData.push(await stackCreate(this, opCtx));
							break;
						case 'getAll':
							returnData.push(...(await stackGetAll(this, opCtx)));
							break;
					}
				} else if (resource === 'card') {
					const boardId = resolveBoardFromInput(this, i);
					const opCtx: CardOperationContext = { itemIndex: i, credentials, boardId };
					switch (operation) {
						case 'create':
							returnData.push(await cardCreate(this, opCtx));
							break;
						case 'get':
							returnData.push(await cardGet(this, opCtx));
							break;
						case 'getAll':
							returnData.push(...(await cardGetAll(this, opCtx)));
							break;
						case 'update':
							returnData.push(await cardUpdate(this, opCtx));
							break;
						case 'delete':
							returnData.push(await cardDelete(this, opCtx));
							break;
						case 'move':
							returnData.push(await cardMove(this, opCtx));
							break;
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}

				if (returnData.length === outputCountBefore) {
					throw new NodeOperationError(
						this.getNode(),
						`The resource "${resource}" with operation "${operation}" is not supported.`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				const statusCode = getHttpStatusCode(error);
				const scrubbedMessage = scrubErrorMessage(error, {
					appPassword: credentials.appPassword,
					username: credentials.username,
				});
				const message = formatDeckAccessErrorMessage(statusCode, scrubbedMessage);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: message,
							...(statusCode !== undefined ? { statusCode } : {}),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(
					this.getNode(),
					{ message, ...(statusCode !== undefined ? { httpCode: statusCode } : {}) } as JsonObject,
					{
						itemIndex: i,
						...(statusCode !== undefined ? { httpCode: String(statusCode) } : {}),
					},
				);
			}
		}

		return [returnData];
	}
}
