/**
 * Repository for the Deck Board entity (REST API v1.0).
 *
 * Boards are the top-level project grouping. The board repository owns all
 * board-level operations, including ACL rules (the rules belong to a board)
 * and board clone/restore. Nested entities (stacks, cards, labels) have their
 * own repositories.
 *
 * Reference: nodes/NextcloudDeck/context/api/documentation/openapi.md (Boards)
 */
import { z } from 'zod';

import type { DeckClient } from '../deck.client';
import { parseEmpty, parseWith, type Maybe } from '../shared/apiResponseHelpers';

export type DeckAclParticipantType = 0 | 1 | 7;

/** Live user objects include participant `type` (0 user, 1 group, 7 circle). */
const deckUserSchema = z
	.object({
		primaryKey: z.string(),
		uid: z.string(),
		displayname: z.string(),
		type: z.union([z.literal(0), z.literal(1), z.literal(7)]).optional(),
	})
	.strict();

const deckLabelSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		color: z.string(),
		boardId: z.coerce.number(),
		cardId: z.union([z.coerce.number(), z.null()]),
		lastModified: z.number().optional(),
		ETag: z.string().optional(),
	})
	.strict();

const deckAclRuleSchema = z
	.object({
		id: z.coerce.number(),
		participant: deckUserSchema,
		type: z.union([z.literal(0), z.literal(1), z.literal(7)]),
		boardId: z.coerce.number(),
		permissionEdit: z.boolean(),
		permissionShare: z.boolean(),
		permissionManage: z.boolean(),
		owner: z.boolean(),
	})
	.strict();

const deckBoardPermissionsSchema = z
	.object({
		PERMISSION_READ: z.boolean(),
		PERMISSION_EDIT: z.boolean(),
		PERMISSION_MANAGE: z.boolean(),
		PERMISSION_SHARE: z.boolean(),
	})
	.strict();

const deckBoardSettingsObjectSchema = z
	.object({
		'notify-due': z.union([z.literal('off'), z.literal('assigned'), z.literal('all')]).optional(),
		calendar: z.boolean().optional(),
		cardDetailsInModal: z.boolean().optional(),
		cardIdBadge: z.boolean().optional(),
	})
	.strict();

/** Board create responses may return `settings` as an empty array before config is set. */
const deckBoardSettingsSchema = z.union([deckBoardSettingsObjectSchema, z.array(z.unknown())]);

/** Live board JSON includes embedded stacks and active sessions on create/detail responses. */
export const deckBoardSchema = z
	.object({
		id: z.coerce.number(),
		title: z.string(),
		color: z.string(),
		owner: deckUserSchema,
		archived: z.boolean(),
		labels: z.array(deckLabelSchema),
		acl: z.array(deckAclRuleSchema),
		permissions: deckBoardPermissionsSchema,
		users: z.array(deckUserSchema),
		shared: z.number().optional(),
		deletedAt: z.number(),
		lastModified: z.number().optional(),
		settings: deckBoardSettingsSchema.optional(),
		stacks: z.array(z.unknown()).optional(),
		activeSessions: z.array(z.unknown()).optional(),
		ETag: z.string().optional(),
	})
	.strict();

const deckBoardsSchema = z.array(deckBoardSchema);

const deckAclRulesSchema = z.array(deckAclRuleSchema);

export type DeckUser = z.infer<typeof deckUserSchema>;
export type DeckLabel = z.infer<typeof deckLabelSchema>;
export type DeckAclRule = z.infer<typeof deckAclRuleSchema>;
export type DeckBoard = z.infer<typeof deckBoardSchema>;

function definedOnly<T extends Record<string, unknown>>(object: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export type GetBoardsOptions = {
	/** Enhance boards with details about labels, stacks and users. */
	details?: boolean;
};

export async function getBoards(
	client: DeckClient,
	options: GetBoardsOptions = {},
): Promise<Maybe<DeckBoard[]>> {
	const query = options.details !== undefined ? { details: String(options.details) } : undefined;
	return parseWith(await client.get('/boards', query), deckBoardsSchema);
}

export type GetBoardOptions = {
	boardId: number;
};

export async function getBoard(
	client: DeckClient,
	options: GetBoardOptions,
): Promise<Maybe<DeckBoard>> {
	return parseWith(await client.get(`/boards/${options.boardId}`), deckBoardSchema);
}

export type CreateBoardOptions = {
	title: string;
	color: string;
};

export async function createBoard(
	client: DeckClient,
	options: CreateBoardOptions,
): Promise<Maybe<DeckBoard>> {
	return parseWith(
		await client.post('/boards', {
			title: options.title,
			color: options.color,
		}),
		deckBoardSchema,
	);
}

export type UpdateBoardOptions = {
	boardId: number;
	title: string;
	color: string;
	archived: boolean;
};

export async function updateBoard(
	client: DeckClient,
	options: UpdateBoardOptions,
): Promise<Maybe<DeckBoard>> {
	return parseWith(
		await client.put(`/boards/${options.boardId}`, {
			title: options.title,
			color: options.color,
			archived: options.archived,
		}),
		deckBoardSchema,
	);
}

export type DeleteBoardOptions = {
	boardId: number;
};

export async function deleteBoard(
	client: DeckClient,
	options: DeleteBoardOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.delete(`/boards/${options.boardId}`));
}

export type RestoreBoardOptions = {
	boardId: number;
};

export async function restoreBoard(
	client: DeckClient,
	options: RestoreBoardOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.post(`/boards/${options.boardId}/undo_delete`));
}

export type CloneBoardOptions = {
	boardId: number;
	withCards?: boolean;
	withAssignments?: boolean;
	withLabels?: boolean;
	withDueDate?: boolean;
	moveCardsToLeftStack?: boolean;
	restoreArchivedCards?: boolean;
};

export async function cloneBoard(
	client: DeckClient,
	options: CloneBoardOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.post(
			`/boards/${options.boardId}/clone`,
			definedOnly({
				withCards: options.withCards,
				withAssignments: options.withAssignments,
				withLabels: options.withLabels,
				withDueDate: options.withDueDate,
				moveCardsToLeftStack: options.moveCardsToLeftStack,
				restoreArchivedCards: options.restoreArchivedCards,
			}),
		),
	);
}

export type AddAclRuleOptions = {
	boardId: number;
	type: DeckAclParticipantType;
	participant: string;
	permissionEdit: boolean;
	permissionShare: boolean;
	permissionManage: boolean;
};

export async function addAclRule(
	client: DeckClient,
	options: AddAclRuleOptions,
): Promise<Maybe<DeckAclRule[]>> {
	return parseWith(
		await client.post(`/boards/${options.boardId}/acl`, {
			type: options.type,
			participant: options.participant,
			permissionEdit: options.permissionEdit,
			permissionShare: options.permissionShare,
			permissionManage: options.permissionManage,
		}),
		deckAclRulesSchema,
	);
}

export type UpdateAclRuleOptions = {
	boardId: number;
	aclId: number;
	permissionEdit: boolean;
	permissionShare: boolean;
	permissionManage: boolean;
};

export async function updateAclRule(
	client: DeckClient,
	options: UpdateAclRuleOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.put(`/boards/${options.boardId}/acl/${options.aclId}`, {
			permissionEdit: options.permissionEdit,
			permissionShare: options.permissionShare,
			permissionManage: options.permissionManage,
		}),
	);
}

export type DeleteAclRuleOptions = {
	boardId: number;
	aclId: number;
};

export async function deleteAclRule(
	client: DeckClient,
	options: DeleteAclRuleOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.delete(`/boards/${options.boardId}/acl/${options.aclId}`));
}