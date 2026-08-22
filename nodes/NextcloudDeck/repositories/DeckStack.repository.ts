/**
 * Repository for the Deck Stack entity (REST API v1.0).
 *
 * Stacks group cards into vertical columns on a board. Every operation is
 * scoped to a parent board; stack responses embed their cards.
 *
 * Reference: nodes/NextcloudDeck/context/api/documentation/openapi.md (Stacks)
 */
import { z } from 'zod';

import type { DeckClient } from '../deck.client';
import { deckCardSchema } from './DeckCard.repository';
import { parseEmpty, parseWith, type Maybe } from '../../shared/apiResult';

const deckStackSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		boardId: z.coerce.number(),
		/** Create responses often omit `cards` until the stack is fetched with details. */
		cards: z.array(deckCardSchema).default([]),
		order: z.number(),
		deletedAt: z.number(),
		lastModified: z.number(),
		ETag: z.string().optional(),
	})
	.strict();

const deckStacksSchema = z.array(deckStackSchema);

export type DeckStack = z.infer<typeof deckStackSchema>;
export { deckStackSchema };

function definedOnly<T extends Record<string, unknown>>(object: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export type GetStacksOptions = {
	boardId: number;
};

export async function getStacks(
	client: DeckClient,
	options: GetStacksOptions,
): Promise<Maybe<DeckStack[]>> {
	return parseWith(await client.get(`/boards/${options.boardId}/stacks`), deckStacksSchema);
}

export type GetArchivedStacksOptions = {
	boardId: number;
};

export async function getArchivedStacks(
	client: DeckClient,
	options: GetArchivedStacksOptions,
): Promise<Maybe<DeckStack[]>> {
	return parseWith(
		await client.get(`/boards/${options.boardId}/stacks/archived`),
		deckStacksSchema,
	);
}

export type GetStackOptions = {
	boardId: number;
	stackId: number;
};

export async function getStack(
	client: DeckClient,
	options: GetStackOptions,
): Promise<Maybe<DeckStack>> {
	return parseWith(
		await client.get(`/boards/${options.boardId}/stacks/${options.stackId}`),
		deckStackSchema,
	);
}

export type CreateStackOptions = {
	boardId: number;
	title: string;
	order: number;
};

export async function createStack(
	client: DeckClient,
	options: CreateStackOptions,
): Promise<Maybe<DeckStack>> {
	return parseWith(
		await client.post(`/boards/${options.boardId}/stacks`, {
			title: options.title,
			order: options.order,
		}),
		deckStackSchema,
	);
}

export type UpdateStackOptions = {
	boardId: number;
	stackId: number;
	title?: string;
	order?: number;
};

export async function updateStack(
	client: DeckClient,
	options: UpdateStackOptions,
): Promise<Maybe<DeckStack>> {
	return parseWith(
		await client.put(
			`/boards/${options.boardId}/stacks/${options.stackId}`,
			definedOnly({
				title: options.title,
				order: options.order,
			}),
		),
		deckStackSchema,
	);
}

export type DeleteStackOptions = {
	boardId: number;
	stackId: number;
};

export async function deleteStack(
	client: DeckClient,
	options: DeleteStackOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.delete(`/boards/${options.boardId}/stacks/${options.stackId}`));
}