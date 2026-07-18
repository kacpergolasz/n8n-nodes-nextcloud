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

import type { DeckBoard, DeckCard, DeckStack } from './DeckInterface';
import {
	buildBoardUpdatePayload,
	deckRequest,
	filterActiveBoards,
	flattenCardsFromStacks,
	formatDeckDueDate,
	getCredentials,
	mergeDefined,
	normalizeDeckColor,
	resolveBoardId,
	resolveStackId,
} from './GenericFunctions';
import { getBoards } from './listSearch/getBoards';
import { getStacks } from './listSearch/getStacks';
import { boardDescription } from './resources/board';
import { cardDescription } from './resources/card';
import { stackDescription } from './resources/stack';
import { getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';

function resolveBoardFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
): string {
	const locator = context.getNodeParameter('board', itemIndex) as INodeParameterResourceLocator;
	return resolveBoardId(locator.value as string);
}

function resolveStackFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName = 'stack',
): string {
	const locator = context.getNodeParameter(paramName, itemIndex) as INodeParameterResourceLocator;
	return resolveStackId(locator.value as string);
}

function resolveOptionalStackFilter(
	context: IExecuteFunctions,
	itemIndex: number,
): string | undefined {
	const locator = context.getNodeParameter('stackFilter', itemIndex, {
		mode: 'id',
		value: '',
	}) as INodeParameterResourceLocator;
	const value = (locator?.value as string | undefined)?.trim();
	return value || undefined;
}

function boardToJson(board: DeckBoard): IDataObject {
	return { ...board } as IDataObject;
}

function stackToJson(stack: DeckStack): IDataObject {
	return { ...stack } as IDataObject;
}

function cardToJson(card: DeckCard): IDataObject {
	return { ...card } as IDataObject;
}

function notFoundMessage(resource: string, statusCode: number | undefined): string | undefined {
	if (statusCode !== 404) {
		return undefined;
	}
	switch (resource) {
		case 'board':
			return 'Board not found (404)';
		case 'stack':
			return 'Stack not found (404)';
		case 'card':
			return 'Card not found (404)';
		default:
			return 'Resource not found (404)';
	}
}

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
		const resource = this.getNodeParameter('resource', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'board') {
					if (operation === 'create') {
						const title = this.getNodeParameter('title', i) as string;
						const hexColor = this.getNodeParameter('hexColor', i, '') as string;
						if (!title.trim()) {
							throw new NodeOperationError(
								this.getNode(),
								'Title is required when creating a board',
								{ itemIndex: i },
							);
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
				} else if (resource === 'stack') {
					const boardId = resolveBoardFromInput(this, i);

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = this.getNodeParameter('limit', i, 10) as number;
						const stacks = (await deckRequest(
							this,
							'GET',
							`/boards/${boardId}/stacks`,
						)) as DeckStack[];
						const sliced = returnAll ? stacks : stacks.slice(0, limit);
						for (const stack of sliced) {
							returnData.push({
								json: stackToJson(stack),
								pairedItem: { item: i },
							});
						}
					}

					if (operation === 'create') {
						const title = this.getNodeParameter('title', i) as string;
						const order = this.getNodeParameter('order', i, 0) as number;
						if (!title.trim()) {
							throw new NodeOperationError(
								this.getNode(),
								'Title is required when creating a stack',
								{ itemIndex: i },
							);
						}
						const stack = (await deckRequest(this, 'POST', `/boards/${boardId}/stacks`, {
							title,
							order,
						})) as DeckStack;
						returnData.push({
							json: stackToJson(stack),
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'card') {
					const boardId = resolveBoardFromInput(this, i);

					if (operation === 'create') {
						const stackId = resolveStackFromInput(this, i);
						const title = this.getNodeParameter('title', i) as string;
						const description = this.getNodeParameter('description', i, '') as string;
						const dueDate = this.getNodeParameter('dueDate', i, '') as string;
						const type = this.getNodeParameter('type', i, 'plain') as string;
						const order = this.getNodeParameter('order', i, 0) as number;
						if (!title.trim()) {
							throw new NodeOperationError(
								this.getNode(),
								'Title is required when creating a card',
								{ itemIndex: i },
							);
						}
						const body: IDataObject = {
							title,
							type: type || 'plain',
							order,
							duedate: formatDeckDueDate(dueDate),
						};
						if (description.trim()) {
							body.description = description;
						}
						const card = (await deckRequest(
							this,
							'POST',
							`/boards/${boardId}/stacks/${stackId}/cards`,
							body,
						)) as DeckCard;
						returnData.push({
							json: cardToJson(card),
							pairedItem: { item: i },
						});
					}

					if (operation === 'get') {
						const stackId = resolveStackFromInput(this, i);
						const cardId = this.getNodeParameter('cardId', i) as string;
						const card = (await deckRequest(
							this,
							'GET',
							`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
						)) as DeckCard;
						returnData.push({
							json: cardToJson(card),
							pairedItem: { item: i },
						});
					}

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = this.getNodeParameter('limit', i, 10) as number;
						const stackFilter = resolveOptionalStackFilter(this, i);
						const stacks = (await deckRequest(
							this,
							'GET',
							`/boards/${boardId}/stacks`,
						)) as DeckStack[];
						const cards = flattenCardsFromStacks(stacks, stackFilter);
						const sliced = returnAll ? cards : cards.slice(0, limit);
						for (const card of sliced) {
							returnData.push({
								json: cardToJson(card),
								pairedItem: { item: i },
							});
						}
					}

					if (operation === 'update') {
						const stackId = resolveStackFromInput(this, i);
						const cardId = this.getNodeParameter('cardId', i) as string;
						const current = (await deckRequest(
							this,
							'GET',
							`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
						)) as DeckCard;
						const title = this.getNodeParameter('title', i, '') as string;
						const description = this.getNodeParameter('description', i, '') as string;
						const dueDate = this.getNodeParameter('dueDate', i, '') as string;
						const type = this.getNodeParameter('type', i, 'plain') as string;

						const patch: IDataObject = {};
						if (title.trim()) {
							patch.title = title;
						}
						if (description.trim()) {
							patch.description = description;
						}
						if (dueDate.trim()) {
							patch.duedate = formatDeckDueDate(dueDate);
						}
						if (type.trim()) {
							patch.type = type;
						}

						const payload = mergeDefined(current as IDataObject, patch);
						const card = (await deckRequest(
							this,
							'PUT',
							`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
							payload,
						)) as DeckCard;
						returnData.push({
							json: cardToJson(card),
							pairedItem: { item: i },
						});
					}

					if (operation === 'delete') {
						const stackId = resolveStackFromInput(this, i);
						const cardId = this.getNodeParameter('cardId', i) as string;
						await deckRequest(
							this,
							'DELETE',
							`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
						);
						returnData.push({
							json: { id: cardId, deleted: true },
							pairedItem: { item: i },
						});
					}

					if (operation === 'move') {
						const stackId = resolveStackFromInput(this, i);
						const cardId = this.getNodeParameter('cardId', i) as string;
						const toStackId = resolveStackFromInput(this, i, 'toStack');
						const order = this.getNodeParameter('order', i, 0) as number;
						const card = (await deckRequest(
							this,
							'PUT',
							`/boards/${boardId}/stacks/${stackId}/cards/${cardId}/reorder`,
							{
								order,
								stackId: Number(toStackId),
							},
						)) as DeckCard;
						returnData.push({
							json: cardToJson(card),
							pairedItem: { item: i },
						});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				const statusCode = getHttpStatusCode(error);
				const scrubbedMessage = scrubErrorMessage(error, {
					appPassword: credentials.appPassword,
					username: credentials.username,
				});
				const message = notFoundMessage(resource, statusCode) ?? scrubbedMessage;

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
