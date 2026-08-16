import type { IDataObject } from 'n8n-workflow';

import { DeckClient } from './deck.client';
import type { DeckPickerOption } from './DeckInterface';
import {
	isPlainObject,
	parseNextcloudCredentials,
	parseRequiredNumber,
	type NextcloudCredentialData,
} from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import type { DeckCard } from './repositories/DeckCard.repository';
import type { DeckBoard } from './repositories/DeckBoard.repository';
import { getBoards } from './repositories/DeckBoard.repository';
import { getStacks } from './repositories/DeckStack.repository';
import { unwrapResult } from './shared/apiResponseHelpers';

export { parseBoardAdditionalFields, parseCardAdditionalFields } from './DeckSchemas';

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
	context: NextcloudRequestContext,
): Promise<NextcloudCredentialData> {
	const credentials = parseNextcloudCredentials(await context.getCredentials('nextcloudApi'));

	return {
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		username: credentials.username,
		appPassword: credentials.appPassword,
	};
}

/** Build a DeckClient that sends Deck REST calls through n8n's authenticated HTTP helper. */
export async function createDeckClient(context: NextcloudRequestContext): Promise<DeckClient> {
	return await DeckClient.fromN8nContext(context);
}

/** Locate a card on a board by id (summary from nested stack payloads). */
export async function loadBoards(context: NextcloudRequestContext): Promise<DeckPickerOption[]> {
	const boards = filterActiveBoards(
		unwrapResult(await getBoards(await createDeckClient(context))),
	);

	return boards.map((board) => ({
		name: board.title,
		value: String(board.id),
	}));
}

export async function loadStacks(
	context: NextcloudRequestContext,
	boardId: string,
): Promise<DeckPickerOption[]> {
	const stacks = unwrapResult(
		await getStacks(await createDeckClient(context), {
			boardId: parseRequiredNumber(boardId, 'Board'),
		}),
	);

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
export function mergeDefined(
	target: Record<string, unknown>,
	patch: Record<string, unknown>,
): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(target)) {
		if (isIDataObjectValue(value)) {
			result[key] = value;
		}
	}
	for (const [key, value] of Object.entries(patch)) {
		if (value !== undefined && isIDataObjectValue(value)) {
			result[key] = value;
		}
	}
	return result;
}

/** Copy a parsed Deck entity into n8n item JSON (drops non-JSON values). */
export function toNodeJson(entity: object): IDataObject {
	if (!isPlainObject(entity)) {
		return {};
	}
	return mergeDefined({}, entity);
}

function isIDataObjectValue(
	value: unknown,
): value is IDataObject[string] {
	if (value === null || value === undefined) {
		return true;
	}
	const t = typeof value;
	if (t === 'string' || t === 'number' || t === 'boolean') {
		return true;
	}
	if (Array.isArray(value)) {
		return value.every((item) => isIDataObjectValue(item));
	}
	return isPlainObject(value);
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

/** PUT /boards/{id} requires title, color, and archived together — not a sparse body. */
export type BoardUpdatePayload = {
	title: string;
	color: string;
	archived: boolean;
};

export function buildBoardUpdatePayload(
	current: DeckBoard,
	patch: BoardUpdatePatch = {},
): BoardUpdatePayload {
	return {
		title: patch.title?.trim() || current.title,
		color: patch.color?.trim()
			? normalizeDeckColor(patch.color)
			: normalizeDeckColor(current.color),
		archived: patch.archived ?? current.archived ?? false,
	};
}

export type CardUpdatePatch = {
	title?: string;
	description?: string;
	duedate?: string | null;
	type?: string;
	order?: number;
};

/** Deck PUT requires `owner` as a string UID; GET often returns a user object. */
function resolveCardOwnerUid(current: DeckCard): string {
	const owner = current.owner;
	if (typeof owner === 'string') {
		const uid = owner.trim();
		if (uid) {
			return uid;
		}
	} else if (owner) {
		const uid = owner.uid.trim() || owner.primaryKey.trim();
		if (uid) {
			return uid;
		}
	}
	throw new Error('Card owner is missing; cannot build update payload.');
}

/**
 * PUT .../cards/{id} writable scalars only. Nested/read-only GET fields
 * (labels, assignedUsers, id, stackId, …) must never enter the body.
 * `owner` is required by Deck as a string UID — coerced from GET, not UI.
 */
export type CardUpdatePayload = {
	title: string;
	description: string;
	duedate: string | null;
	type: string;
	order: number;
	owner: string;
};

export function buildCardUpdatePayload(
	current: DeckCard,
	patch: CardUpdatePatch = {},
): CardUpdatePayload {
	return {
		title: patch.title?.trim() || current.title,
		description: patch.description !== undefined ? patch.description : (current.description ?? ''),
		duedate: patch.duedate !== undefined ? patch.duedate : (current.duedate ?? null),
		type: patch.type ?? current.type ?? 'plain',
		order: patch.order ?? current.order ?? 0,
		owner: resolveCardOwnerUid(current),
	};
}
