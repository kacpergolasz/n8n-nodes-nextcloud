import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import type {
	DeckBoard,
	DeckCard,
	DeckPickerOption,
	DeckStack,
	NextcloudCredentialData,
} from './DeckInterface';

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

export function deckApiBase(baseUrl: string): string {
	return `${normalizeBaseUrl(baseUrl)}/index.php/apps/deck/api/v1.0`;
}

export function buildBoardsUrl(baseUrl: string): string {
	return `${deckApiBase(baseUrl)}/boards`;
}

export function buildBoardUrl(baseUrl: string, boardId: string | number): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}`;
}

export function buildBoardUndoDeleteUrl(baseUrl: string, boardId: string | number): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}/undo_delete`;
}

export function buildStacksUrl(baseUrl: string, boardId: string | number): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}/stacks`;
}

export function buildStackUrl(
	baseUrl: string,
	boardId: string | number,
	stackId: string | number,
): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}/stacks/${stackId}`;
}

export function buildCardsUrl(
	baseUrl: string,
	boardId: string | number,
	stackId: string | number,
): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}/stacks/${stackId}/cards`;
}

export function buildCardUrl(
	baseUrl: string,
	boardId: string | number,
	stackId: string | number,
	cardId: string | number,
): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}/stacks/${stackId}/cards/${cardId}`;
}

export function buildCardReorderUrl(
	baseUrl: string,
	boardId: string | number,
	stackId: string | number,
	cardId: string | number,
): string {
	return `${deckApiBase(baseUrl)}/boards/${boardId}/stacks/${stackId}/cards/${cardId}/reorder`;
}

export async function getCredentials(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<NextcloudCredentialData> {
	const credentials = (await context.getCredentials('nextcloudApi')) as NextcloudCredentialData;

	return {
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		username: credentials.username,
		appPassword: credentials.appPassword,
	};
}

export async function deckRequest(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
) {
	const credentials = await getCredentials(context);
	const url = path.startsWith('http') ? path : `${deckApiBase(credentials.baseUrl)}${path}`;

	return await context.helpers.httpRequestWithAuthentication.call(context, 'nextcloudApi', {
		method,
		url,
		body,
		json: true,
		headers: {
			'OCS-APIRequest': 'true',
			'Content-Type': 'application/json',
		},
	});
}

/** Locate a card on a board by id (summary from nested stack payloads). */
export function findCardInStacks(stacks: DeckStack[], cardId: string): DeckCard | undefined {
	return flattenCardsFromStacks(stacks).find((card) => String(card.id) === cardId);
}

/** Load a card by board + card id; stack is resolved from the board stacks payload. */
export async function findCardOnBoard(
	context: IExecuteFunctions,
	boardId: string,
	cardId: string,
): Promise<{ card: DeckCard; stackId: string }> {
	const stacks = (await deckRequest(context, 'GET', `/boards/${boardId}/stacks`)) as DeckStack[];
	const match = findCardInStacks(stacks, cardId);
	if (!match?.stackId) {
		throw new Error(`Card ${cardId} was not found on board ${boardId}.`);
	}

	const stackId = String(match.stackId);
	const card = (await deckRequest(
		context,
		'GET',
		`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
	)) as DeckCard;

	return { card, stackId };
}

/**
 * Move a card via REST PUT (Basic Auth). Deck's `/reorder` REST route ignores target stackId;
 * PUT to the destination stack URL with stackId + order in the body matches the web UI behavior.
 */
export async function deleteCard(
	context: IExecuteFunctions,
	boardId: string,
	cardId: string,
): Promise<void> {
	const { stackId } = await findCardOnBoard(context, boardId, cardId);
	await deckRequest(
		context,
		'DELETE',
		`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
	);
}

export async function moveCard(
	context: IExecuteFunctions,
	boardId: string,
	cardId: string,
	toStackId: string,
	order: number,
): Promise<DeckCard> {
	const { card } = await findCardOnBoard(context, boardId, cardId);
	const payload = mergeDefined(card as IDataObject, {
		stackId: Number(toStackId),
		order,
	});

	return (await deckRequest(
		context,
		'PUT',
		`/boards/${boardId}/stacks/${toStackId}/cards/${cardId}`,
		payload,
	)) as DeckCard;
}

export async function loadBoards(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<DeckPickerOption[]> {
	const boards = filterActiveBoards((await deckRequest(context, 'GET', '/boards')) as DeckBoard[]);

	return boards.map((board) => ({
		name: board.title,
		value: String(board.id),
	}));
}

export async function loadStacks(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	boardId: string,
): Promise<DeckPickerOption[]> {
	const stacks = (await deckRequest(context, 'GET', `/boards/${boardId}/stacks`)) as DeckStack[];

	return stacks.map((stack) => ({
		name: stack.title,
		value: String(stack.id),
	}));
}

function coerceResourceId(input: unknown, resourceLabel: string): string {
	if (input === undefined || input === null || input === '') {
		throw new Error(`${resourceLabel} id is empty.`);
	}
	const trimmed = String(input).trim();
	if (!trimmed) {
		throw new Error(`${resourceLabel} id is empty.`);
	}
	return trimmed;
}

export function resolveBoardId(boardInput: string | number): string {
	return coerceResourceId(boardInput, 'Board');
}

export function resolveStackId(stackInput: string | number): string {
	return coerceResourceId(stackInput, 'Stack');
}

export function resolveCardId(cardInput: string | number): string {
	return coerceResourceId(cardInput, 'Card');
}

/** Overlay patch keys that are not `undefined` onto target (partial-update safety). */
export function mergeDefined<T extends IDataObject>(target: T, patch: IDataObject): T {
	const result = { ...target };
	for (const [key, value] of Object.entries(patch)) {
		if (value !== undefined) {
			result[key as keyof T] = value as T[keyof T];
		}
	}
	return result;
}

/** Flatten nested `cards[]` from stack payloads; optional stack id filter. */
export function flattenCardsFromStacks(stacks: DeckStack[], stackFilter?: string): DeckCard[] {
	const cards: DeckCard[] = [];

	for (const stack of stacks) {
		if (stackFilter && String(stack.id) !== stackFilter) {
			continue;
		}
		for (const card of stack.cards ?? []) {
			cards.push({
				...card,
				stackId: card.stackId ?? stack.id,
			});
		}
	}

	return cards;
}

export function formatDeckDueDate(dueDate: string | undefined): string | null {
	if (!dueDate?.trim()) {
		return null;
	}
	const parsed = new Date(dueDate);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error('Due date is invalid. Provide a valid date/time value.');
	}
	return parsed.toISOString();
}

/** Deck API expects hex colors without a leading `#` (e.g. `ff0000`). */
export function normalizeDeckColor(color: string): string {
	return color.trim().replace(/^#/, '').toLowerCase();
}

/** Boards soft-deleted by Deck expose a non-zero `deletedAt` timestamp. */
export function isActiveBoard(board: DeckBoard): boolean {
	const deletedAt = board.deletedAt;
	return deletedAt === undefined || deletedAt === null || deletedAt === 0;
}

export function filterActiveBoards(boards: DeckBoard[]): DeckBoard[] {
	return boards.filter(isActiveBoard);
}

export type BoardUpdatePatch = {
	title?: string;
	color?: string;
	archived?: boolean;
};

/** PUT /boards/{id} accepts only title, color, and archived — not the full GET entity. */
export function buildBoardUpdatePayload(
	current: DeckBoard,
	patch: BoardUpdatePatch = {},
): IDataObject {
	return {
		title: patch.title?.trim() || current.title,
		color: patch.color?.trim()
			? normalizeDeckColor(patch.color)
			: normalizeDeckColor(current.color),
		archived: patch.archived ?? current.archived ?? false,
	};
}
