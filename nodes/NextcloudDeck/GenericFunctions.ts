import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import type {
	DeckBoard,
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

export function resolveBoardId(boardInput: string): string {
	const trimmed = boardInput.trim();
	if (!trimmed) {
		throw new Error('Board id is empty.');
	}
	return trimmed;
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
