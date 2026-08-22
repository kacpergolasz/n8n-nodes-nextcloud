/**
 * Repository for the Deck Card entity (REST API v1.0).
 *
 * Cards are single tasks inside a stack. The card repository owns all
 * card-level operations, including archive/unarchive, label assignment,
 * user assignment and reordering (moving a card between stacks).
 *
 * Reference: nodes/NextcloudDeck/context/api/documentation/openapi.md (Cards)
 */
import { z } from 'zod';

import type { DeckClient } from '../deck.client';
import { parseEmpty, parseWith, type Maybe } from '../../shared/apiResult';

const deckUserSchema = z
	.object({
		primaryKey: z.string(),
		uid: z.string(),
		displayname: z.string(),
	})
	.strict();

const deckLabelSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		color: z.string(),
		boardId: z.coerce.number(),
		cardId: z.union([z.coerce.number(), z.null()]),
	})
	.strict();

const deckCardAssignmentSchema = z
	.object({
		id: z.coerce.number(),
		participant: deckUserSchema,
		cardId: z.coerce.number(),
	})
	.strict();

/** GET owner is a uid string or a resolved user object. PUT owner must be a string uid. */
const deckCardOwnerSchema = z.union([z.string(), deckUserSchema]);

/** Live card GET JSON includes read-only keys such as `lastEditor` and `commentsCount`. */
export const deckCardSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		description: z.union([z.string(), z.null()]).optional(),
		stackId: z.coerce.number(),
		type: z.string(),
		owner: deckCardOwnerSchema,
		order: z.number(),
		archived: z.boolean(),
		done: z.union([z.string(), z.null()]).optional(),
		duedate: z.union([z.string(), z.null()]),
		labels: z.array(deckLabelSchema).nullable(),
		assignedUsers: z.array(deckCardAssignmentSchema).nullable(),
		attachments: z.array(z.unknown()).nullable(),
		attachmentCount: z.union([z.number(), z.null()]),
		commentsUnread: z.number(),
		commentsCount: z.number().optional(),
		overdue: z.number(),
		createdAt: z.number(),
		lastModified: z.number(),
		deletedAt: z.number(),
		lastEditor: z.union([z.string(), z.null()]).optional(),
		ETag: z.string().optional(),
	})
	.strict();

export type DeckCard = z.infer<typeof deckCardSchema>;
export type DeckCardAssignment = z.infer<typeof deckCardAssignmentSchema>;

function definedOnly<T extends Record<string, unknown>>(object: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export type CardPathOptions = {
	boardId: number;
	stackId: number;
	cardId: number;
};

export async function getCard(
	client: DeckClient,
	options: CardPathOptions,
): Promise<Maybe<DeckCard>> {
	return parseWith(
		await client.get(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}`,
		),
		deckCardSchema,
	);
}

export type CreateCardOptions = {
	boardId: number;
	stackId: number;
	title: string;
	type?: string;
	order?: number;
	description?: string;
	duedate?: string | null;
};

export async function createCard(
	client: DeckClient,
	options: CreateCardOptions,
): Promise<Maybe<DeckCard>> {
	return parseWith(
		await client.post(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards`,
			definedOnly({
				title: options.title,
				type: options.type,
				order: options.order,
				description: options.description,
				duedate: options.duedate,
			}),
		),
		deckCardSchema,
	);
}

export type UpdateCardOptions = CardPathOptions & {
	title?: string;
	description?: string;
	type?: string;
	owner?: string;
	order?: number;
	duedate?: string | null;
	archived?: boolean;
	done?: string | null;
};

export async function updateCard(
	client: DeckClient,
	options: UpdateCardOptions,
): Promise<Maybe<DeckCard>> {
	return parseWith(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}`,
			definedOnly({
				title: options.title,
				description: options.description,
				type: options.type,
				owner: options.owner,
				order: options.order,
				duedate: options.duedate,
				archived: options.archived,
				done: options.done,
			}),
		),
		deckCardSchema,
	);
}

export async function deleteCard(
	client: DeckClient,
	options: CardPathOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.delete(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}`,
		),
	);
}

export async function archiveCard(
	client: DeckClient,
	options: CardPathOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/archive`,
		),
	);
}

export async function unarchiveCard(
	client: DeckClient,
	options: CardPathOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/unarchive`,
		),
	);
}

export type AssignLabelOptions = CardPathOptions & {
	labelId: number;
};

export async function assignLabel(
	client: DeckClient,
	options: AssignLabelOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/assignLabel`,
			{ labelId: options.labelId },
		),
	);
}

export async function removeLabel(
	client: DeckClient,
	options: AssignLabelOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/removeLabel`,
			{ labelId: options.labelId },
		),
	);
}

export type AssignUserOptions = CardPathOptions & {
	userId: string;
};

export async function assignUser(
	client: DeckClient,
	options: AssignUserOptions,
): Promise<Maybe<DeckCardAssignment>> {
	return parseWith(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/assignUser`,
			{ userId: options.userId },
		),
		deckCardAssignmentSchema,
	);
}

export async function unassignUser(
	client: DeckClient,
	options: AssignUserOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/unassignUser`,
			{ userId: options.userId },
		),
	);
}

export type ReorderCardOptions = CardPathOptions & {
	/** The position in the destination stack. */
	order: number;
};

/**
 * Path `stackId` is the destination stack. Deck's REST controller binds
 * `$stackId` from the route, so a body `stackId` is ignored.
 */
export async function reorderCard(
	client: DeckClient,
	options: ReorderCardOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}/cards/${options.cardId}/reorder`,
			{
				order: options.order,
				stackId: options.stackId,
			},
		),
	);
}
