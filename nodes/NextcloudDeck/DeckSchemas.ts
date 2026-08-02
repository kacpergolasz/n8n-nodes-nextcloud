import { z } from 'zod';

import { isPlainObject, throwParseError } from '../shared/parse';

// `.passthrough()` keeps unknown Deck API fields (labels, assignees, …) on Get
// output for workflow users. Card Update PUTs must use buildCardUpdatePayload —
// never mergeDefined(fullGet, patch) — so nested/read-only fields are not sent.
// `owner` is first-class: GET returns an object; Update PUT needs a string UID.
const deckCardOwnerSchema = z.union([
	z.string(),
	z
		.object({
			uid: z.union([z.string(), z.number()]).optional(),
		})
		.passthrough(),
]);

const deckCardSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		type: z.string().optional(),
		order: z.number().optional(),
		description: z.string().optional(),
		duedate: z.union([z.string(), z.null()]).optional(),
		stackId: z.number().optional(),
		owner: deckCardOwnerSchema.optional(),
	})
	.passthrough();

export type DeckCard = z.infer<typeof deckCardSchema>;

const deckStackSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		order: z.number(),
		cards: z.array(deckCardSchema).optional(),
	})
	.passthrough();

export type DeckStack = z.infer<typeof deckStackSchema>;

const deckBoardSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		color: z.string(),
		archived: z.boolean().optional(),
		deletedAt: z.union([z.number(), z.null()]).optional(),
	})
	.passthrough();

export type DeckBoard = z.infer<typeof deckBoardSchema>;

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
		return typeof parsed.clearDueDate === 'boolean' ? { clearDueDate: parsed.clearDueDate } : {};
	} catch (error) {
		throwParseError(error, 'Invalid card additional fields');
	}
}
