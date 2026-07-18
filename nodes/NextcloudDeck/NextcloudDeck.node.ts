import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { DeckBoard } from './DeckInterface';
import {
	buildBoardUpdatePayload,
	deckRequest,
	filterActiveBoards,
	getCredentials,
	normalizeDeckColor,
	resolveBoardId,
} from './GenericFunctions';
import { getBoards } from './listSearch/getBoards';
import { boardDescription } from './resources/board';
import { getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';

function resolveBoardFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
): string {
	const locator = context.getNodeParameter('board', itemIndex) as INodeParameterResourceLocator;
	return resolveBoardId(locator.value as string);
}

function boardToJson(board: DeckBoard): IDataObject {
	return { ...board } as IDataObject;
}

export class NextcloudDeck implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Deck',
		name: 'nextcloudDeck',
		icon: 'file:nextcloudDeck.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Automate Nextcloud Deck boards',
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
				options: [{ name: 'Board', value: 'board' }],
				default: 'board',
			},
			...boardDescription,
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getBoards,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await getCredentials(this);
		const resource = this.getNodeParameter('resource', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource !== 'board') {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}

				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'create') {
					const title = this.getNodeParameter('title', i) as string;
					const hexColor = this.getNodeParameter('hexColor', i, '') as string;
					if (!title.trim()) {
						throw new NodeOperationError(this.getNode(), 'Title is required when creating a board', {
							itemIndex: i,
						});
					}
					const board = (await deckRequest(this, 'POST', '/boards', {
						title,
						color: normalizeDeckColor(hexColor) || '0082c9',
					})) as DeckBoard;
					returnData.push({
						json: boardToJson(board),
						pairedItem: { item: i },
					});
				}

				if (operation === 'get') {
					const boardId = resolveBoardFromInput(this, i);
					const board = (await deckRequest(this, 'GET', `/boards/${boardId}`)) as DeckBoard;
					returnData.push({
						json: boardToJson(board),
						pairedItem: { item: i },
					});
				}

				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = this.getNodeParameter('limit', i, 10) as number;
					const boards = filterActiveBoards(
						(await deckRequest(this, 'GET', '/boards')) as DeckBoard[],
					);
					const sliced = returnAll ? boards : boards.slice(0, limit);
					for (const board of sliced) {
						returnData.push({
							json: boardToJson(board),
							pairedItem: { item: i },
						});
					}
				}

				if (operation === 'update') {
					const boardId = resolveBoardFromInput(this, i);
					const current = (await deckRequest(this, 'GET', `/boards/${boardId}`)) as DeckBoard;
					const title = this.getNodeParameter('title', i, '') as string;
					const hexColor = this.getNodeParameter('hexColor', i, '') as string;
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					const patch: {
						title?: string;
						color?: string;
						archived?: boolean;
					} = {};
					if (title.trim()) {
						patch.title = title;
					}
					if (hexColor.trim()) {
						patch.color = hexColor;
					}
					if (typeof additionalFields.archived === 'boolean') {
						patch.archived = additionalFields.archived;
					}

					const payload = buildBoardUpdatePayload(current, patch);

					const board = (await deckRequest(
						this,
						'PUT',
						`/boards/${boardId}`,
						payload,
					)) as DeckBoard;
					returnData.push({
						json: boardToJson(board),
						pairedItem: { item: i },
					});
				}

				if (operation === 'delete') {
					const boardId = resolveBoardFromInput(this, i);
					await deckRequest(this, 'DELETE', `/boards/${boardId}`);
					returnData.push({
						json: { id: boardId, deleted: true },
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				const statusCode = getHttpStatusCode(error);
				const scrubbedMessage = scrubErrorMessage(error, {
					appPassword: credentials.appPassword,
					username: credentials.username,
				});
				const message =
					statusCode === 404 ? 'Board not found (404)' : scrubbedMessage;

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
