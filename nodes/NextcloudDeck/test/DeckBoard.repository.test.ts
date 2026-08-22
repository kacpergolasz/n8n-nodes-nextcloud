import type { DeckClient } from '../deck.client';
import { createBoard, deckBoardSchema } from '../repositories/DeckBoard.repository';

const liveCreateBoard = {
	id: 12,
	title: 'New board',
	color: '0082c9',
	owner: {
		primaryKey: 'alice',
		uid: 'alice',
		displayname: 'Alice',
		type: 0,
	},
	archived: false,
	labels: [
		{
			id: 1,
			title: 'Done',
			color: '31CC7C',
			boardId: 12,
			cardId: null,
			lastModified: 1627986420,
			ETag: 'c6bddc9dec21b630436527323bd3e042',
		},
	],
	acl: [],
	permissions: {
		PERMISSION_READ: true,
		PERMISSION_EDIT: true,
		PERMISSION_MANAGE: true,
		PERMISSION_SHARE: true,
	},
	users: [],
	shared: 0,
	deletedAt: 0,
	lastModified: 1627986420,
	settings: [],
	stacks: [],
	activeSessions: [],
	ETag: 'c6bddc9dec21b630436527323bd3e042',
};

describe('deckBoardSchema', () => {
	it('accepts live board create payloads with extra keys', () => {
		expect(deckBoardSchema.parse(liveCreateBoard)).toMatchObject({
			id: 12,
			owner: { uid: 'alice', type: 0 },
			settings: [],
			stacks: [],
			activeSessions: [],
			labels: [{ id: 1, ETag: 'c6bddc9dec21b630436527323bd3e042' }],
		});
	});

	it('accepts populated settings objects', () => {
		expect(
			deckBoardSchema.parse({
				...liveCreateBoard,
				settings: { 'notify-due': 'assigned', calendar: true },
			}),
		).toMatchObject({
			settings: { 'notify-due': 'assigned', calendar: true },
		});
	});

	it('accepts null lastModified on default labels from board create', () => {
		expect(
			deckBoardSchema.parse({
				...liveCreateBoard,
				labels: [
					{
						id: 1,
						title: 'Done',
						color: '31CC7C',
						boardId: 12,
						cardId: null,
						lastModified: null,
					},
					{
						id: 2,
						title: 'Todo',
						color: '0082c9',
						boardId: 12,
						cardId: null,
						lastModified: null,
					},
				],
			}),
		).toMatchObject({
			labels: [
				{ id: 1, lastModified: null },
				{ id: 2, lastModified: null },
			],
		});
	});
});

describe('createBoard', () => {
	it('parses a successful POST that includes undocumented board keys', async () => {
		const client = {
			post: vi.fn(async () => ({ success: true as const, response: liveCreateBoard })),
		};

		const result = await createBoard(client as unknown as DeckClient, {
			title: 'New board',
			color: '0082c9',
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response.id).toBe(12);
			expect(result.response).toMatchObject({ stacks: [], activeSessions: [] });
		}
	});
});
