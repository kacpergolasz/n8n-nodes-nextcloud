import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { z } from 'zod';

import type {
	DeckBoard,
	DeckCard,
	DeckPickerOption,
	DeckStack,
} from './DeckInterface';
import {
	isPlainObject,
	parseNextcloudCredentials,
	throwParseError,
	type NextcloudCredentialData,
} from '../shared/parse';

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
	const credentials = parseNextcloudCredentials(await context.getCredentials('nextcloudApi'));

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

const deckCardSchema = z.object({
	id: z.coerce.number(),
	title: z.string(),
	type: z.string().optional(),
	order: z.number().optional(),
	description: z.string().optional(),
	duedate: z.union([z.string(), z.null()]).optional(),
	stackId: z.number().optional(),
});

const deckStackSchema = z.object({
	id: z.coerce.number(),
	title: z.string(),
	order: z.number(),
	cards: z.array(deckCardSchema).optional(),
});

const deckBoardSchema = z.object({
	id: z.coerce.number(),
	title: z.string(),
	color: z.string(),
	archived: z.boolean().optional(),
	deletedAt: z.union([z.number(), z.null()]).optional(),
});

export function parseDeckCard(data: unknown): DeckCard {
	try {
		return deckCardSchema.parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid Deck card payload');
	}
}

export function parseDeckStack(data: unknown): DeckStack {
	try {
		return deckStackSchema.parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid Deck stack payload');
	}
}

export function parseDeckBoard(data: unknown): DeckBoard {
	try {
		return deckBoardSchema.parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid Deck board payload');
	}
}

export function parseDeckBoards(data: unknown): DeckBoard[] {
	try {
		return z.array(deckBoardSchema).parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid Deck boards payload');
	}
}

export function parseDeckStacks(data: unknown): DeckStack[] {
	try {
		return z.array(deckStackSchema).parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid Deck stacks payload');
	}
}

const boardAdditionalFieldsSchema = z
	.object({
		archived: z.boolean().optional(),
	})
	.passthrough();

const cardAdditionalFieldsSchema = z
	.object({
		clearDueDate: z.boolean().optional(),
	})
	.passthrough();

export function parseBoardAdditionalFields(raw: unknown): { archived?: boolean } {
	if (!isPlainObject(raw)) {
		return {};
	}
	try {
		const parsed = boardAdditionalFieldsSchema.parse(raw);
		return typeof parsed.archived === 'boolean' ? { archived: parsed.archived } : {};
	} catch (error) {
		throwParseError(error, 'Invalid board additional fields');
	}
}

export function parseCardAdditionalFields(raw: unknown): { clearDueDate?: boolean } {
	if (!isPlainObject(raw)) {
		return {};
	}
	try {
		const parsed = cardAdditionalFieldsSchema.parse(raw);
		return typeof parsed.clearDueDate === 'boolean'
			? { clearDueDate: parsed.clearDueDate }
			: {};
	} catch (error) {
		throwParseError(error, 'Invalid card additional fields');
	}
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
	const stacks = parseDeckStacks(await deckRequest(context, 'GET', `/boards/${boardId}/stacks`));
	const match = findCardInStacks(stacks, cardId);
	if (!match?.stackId) {
		throw new Error(`Card ${cardId} was not found on board ${boardId}.`);
	}

	const stackId = String(match.stackId);
	const card = parseDeckCard(
		await deckRequest(context, 'GET', `/boards/${boardId}/stacks/${stackId}/cards/${cardId}`),
	);

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
	const payload = mergeDefined(card, {
		stackId: Number(toStackId),
		order,
	});

	return parseDeckCard(
		await deckRequest(
			context,
			'PUT',
			`/boards/${boardId}/stacks/${toStackId}/cards/${cardId}`,
			payload,
		),
	);
}

export async function loadBoards(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<DeckPickerOption[]> {
	const boards = filterActiveBoards(parseDeckBoards(await deckRequest(context, 'GET', '/boards')));

	return boards.map((board) => ({
		name: board.title,
		value: String(board.id),
	}));
}

export async function loadStacks(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	boardId: string,
): Promise<DeckPickerOption[]> {
	const stacks = parseDeckStacks(await deckRequest(context, 'GET', `/boards/${boardId}/stacks`));

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

export function resolveBoardId(boardInput: unknown): string {
	return coerceResourceId(boardInput, 'Board');
}

export function resolveStackId(stackInput: unknown): string {
	return coerceResourceId(stackInput, 'Stack');
}

export function resolveCardId(cardInput: unknown): string {
	return coerceResourceId(cardInput, 'Card');
}

/** Overlay patch keys that are not `undefined` onto target (partial-update safety). */
export function mergeDefined(target: IDataObject, patch: IDataObject): IDataObject {
	const result: IDataObject = { ...target };
	for (const [key, value] of Object.entries(patch)) {
		if (value !== undefined) {
			result[key] = value;
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
