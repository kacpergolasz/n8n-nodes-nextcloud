import type { DeckCard } from '../repositories/DeckCard.repository';
import type { DeckBoard } from '../repositories/DeckBoard.repository';
import {
	buildBoardUndoDeleteUrl,
	buildBoardUpdatePayload,
	buildBoardUrl,
	buildBoardsUrl,
	buildCardReorderUrl,
	buildCardUpdatePayload,
	buildCardUrl,
	buildCardsUrl,
	buildStackUrl,
	buildStacksUrl,
	deckApiBase,
	filterActiveBoards,
	mergeDefined,
	normalizeDeckColor,
	resolveBoardId,
	resolveCardId,
	resolveStackId,
	toNodeJson,
} from '../GenericFunctions';

const BASE = 'https://cloud.example.com';

describe('Nextcloud Deck GenericFunctions', () => {
	it('builds deck API base URL', () => {
		expect(deckApiBase('https://cloud.example.com/')).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0',
		);
		expect(deckApiBase('https://cloud.example.com')).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0',
		);
	});

	it('builds board URLs', () => {
		expect(buildBoardsUrl(BASE)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards',
		);
		expect(buildBoardUrl(BASE, 42)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/42',
		);
		expect(buildBoardUndoDeleteUrl(BASE, 42)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/42/undo_delete',
		);
	});

	it('builds stack URLs', () => {
		expect(buildStacksUrl(BASE, 1)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/1/stacks',
		);
		expect(buildStackUrl(BASE, 1, 7)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/1/stacks/7',
		);
	});

	it('builds card URLs', () => {
		expect(buildCardsUrl(BASE, 1, 7)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/1/stacks/7/cards',
		);
		expect(buildCardUrl(BASE, 1, 7, 99)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/1/stacks/7/cards/99',
		);
		expect(buildCardReorderUrl(BASE, 1, 7, 99)).toBe(
			'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards/1/stacks/7/cards/99/reorder',
		);
	});
});

describe('resolve resource ids', () => {
	it('coerces numeric ids from expressions', () => {
		expect(resolveBoardId(42)).toBe('42');
		expect(resolveStackId(7)).toBe('7');
		expect(resolveCardId(99)).toBe('99');
	});

	it('trims string ids', () => {
		expect(resolveBoardId(' 42 ')).toBe('42');
	});

	it('rejects empty ids', () => {
		expect(() => resolveBoardId('')).toThrow('Board id is empty.');
		expect(() => resolveStackId('   ')).toThrow('Stack id is empty.');
	});
});

describe('board helpers', () => {
	it('normalizes deck colors by stripping leading hash', () => {
		expect(normalizeDeckColor('#FF0000')).toBe('ff0000');
		expect(normalizeDeckColor('0082C9')).toBe('0082c9');
	});

	it('filters soft-deleted boards by deletedAt', () => {
		const boards = filterActiveBoards([
			{ id: 1, title: 'Active', color: 'ff0000', deletedAt: 0 },
			{ id: 2, title: 'Deleted', color: '00ff00', deletedAt: 1710000000 },
			{ id: 3, title: 'Legacy', color: '0000ff' },
		] as unknown as DeckBoard[]);
		expect(boards.map((board) => board.id)).toEqual([1, 3]);
	});
});

describe('buildBoardUpdatePayload', () => {
	const current: DeckBoard = {
		id: 10,
		title: 'Current',
		color: 'ff0000',
		owner: { primaryKey: 'alice', uid: 'alice', displayname: 'Alice' },
		archived: true,
		labels: [],
		acl: [],
		permissions: {
			PERMISSION_READ: true,
			PERMISSION_EDIT: true,
			PERMISSION_MANAGE: true,
			PERMISSION_SHARE: true,
		},
		users: [],
		deletedAt: 0,
	};

	it('always emits title, color, and archived', () => {
		expect(buildBoardUpdatePayload(current, { title: 'Renamed' })).toEqual({
			title: 'Renamed',
			color: 'ff0000',
			archived: true,
		});
	});

	it('keeps currents when patch is empty and does not unarchive', () => {
		expect(buildBoardUpdatePayload(current, {})).toEqual({
			title: 'Current',
			color: 'ff0000',
			archived: true,
		});
	});

	it('normalizes patched color and overlays archived', () => {
		expect(
			buildBoardUpdatePayload(current, { color: '#0082C9', archived: false }),
		).toEqual({
			title: 'Current',
			color: '0082c9',
			archived: false,
		});
	});
});

describe('buildCardUpdatePayload', () => {
	const current: DeckCard = {
		id: 10,
		title: 'Current',
		description: 'Keep me',
		duedate: '2026-07-18T12:00:00.000Z',
		type: 'plain',
		order: 3,
		stackId: 7,
		owner: 'alice',
		archived: false,
		done: null,
		labels: [],
		assignedUsers: [],
		attachments: [],
		attachmentCount: null,
		commentsUnread: 0,
		overdue: 0,
		createdAt: 0,
		lastModified: 0,
		deletedAt: 0,
	};
	const currentFromGet: DeckCard = {
		...current,
		labels: [{ id: 1, title: 'Bug', color: 'ff0000', boardId: 10, cardId: null }],
		assignedUsers: [
			{
				id: 1,
				participant: { primaryKey: 'alice', uid: 'alice', displayname: 'Alice' },
				cardId: 10,
			},
		],
	};

	it('emits only whitelist keys and drops nested GET fields', () => {
		const payload = buildCardUpdatePayload(currentFromGet, { title: 'Renamed' });
		expect(payload).toEqual({
			title: 'Renamed',
			description: 'Keep me',
			duedate: '2026-07-18T12:00:00.000Z',
			type: 'plain',
			order: 3,
			owner: 'alice',
		});
		expect(payload).not.toHaveProperty('id');
		expect(payload).not.toHaveProperty('stackId');
		expect(payload).not.toHaveProperty('labels');
		expect(payload).not.toHaveProperty('assignedUsers');
	});

	it('keeps currents when patch is empty', () => {
		expect(buildCardUpdatePayload(current, {})).toEqual({
			title: 'Current',
			description: 'Keep me',
			duedate: '2026-07-18T12:00:00.000Z',
			type: 'plain',
			order: 3,
			owner: 'alice',
		});
	});

	it('overlays title, description, and duedate including null clear', () => {
		expect(
			buildCardUpdatePayload(current, {
				title: 'New title',
				description: 'New desc',
				duedate: null,
			}),
		).toEqual({
			title: 'New title',
			description: 'New desc',
			duedate: null,
			type: 'plain',
			order: 3,
			owner: 'alice',
		});
	});

	it('defaults missing type and order from current or plain/0', () => {
		expect(
			buildCardUpdatePayload(
				{ id: 1, title: 'Bare', owner: 'bob' } as unknown as DeckCard,
				{ title: 'Still bare' },
			),
		).toEqual({
			title: 'Still bare',
			description: '',
			duedate: null,
			type: 'plain',
			order: 0,
			owner: 'bob',
		});
	});

	it('rejects cards without a resolvable owner uid', () => {
		expect(() =>
			buildCardUpdatePayload({ id: 1, title: 'No owner' } as unknown as DeckCard, {}),
		).toThrow('Card owner is missing');
	});

	it('coerces GET owner objects to a string uid for PUT', () => {
		expect(
			buildCardUpdatePayload(
				{
					...current,
					owner: { primaryKey: 'alice', uid: 'alice', displayname: 'Alice' },
				},
				{ title: 'Still alice' },
			),
		).toMatchObject({ owner: 'alice', title: 'Still alice' });
	});
});

describe('mergeDefined', () => {
	it('overlays only defined keys and drops undefined', () => {
		expect(
			mergeDefined({ title: 'Old', description: 'Keep', order: 1 }, {
				title: 'New',
				description: undefined,
				duedate: '2026-07-18T12:00:00.000Z',
			}),
		).toEqual({
			title: 'New',
			description: 'Keep',
			order: 1,
			duedate: '2026-07-18T12:00:00.000Z',
		});
	});
});

describe('toNodeJson', () => {
	it('keeps extra passthrough keys that are JSON-safe', () => {
		expect(toNodeJson({ id: 1, title: 'Card', commentsCount: 0, lastEditor: null })).toEqual({
			id: 1,
			title: 'Card',
			commentsCount: 0,
			lastEditor: null,
		});
	});
});

describe('loadBoards mapping', () => {
	it('maps board ids to string picker values', async () => {
		const { loadBoards } = await import('../GenericFunctions');

		const board = (id: number, title: string, deletedAt: number) => ({
			id,
			title,
			color: '0082c9',
			owner: { primaryKey: 'alice', uid: 'alice', displayname: 'Alice' },
			archived: false,
			labels: [],
			acl: [],
			permissions: {
				PERMISSION_READ: true,
				PERMISSION_EDIT: true,
				PERMISSION_MANAGE: true,
				PERMISSION_SHARE: true,
			},
			users: [],
			deletedAt,
		});

		const httpRequestWithAuthentication = vi.fn(async () => [
			board(1, 'Personal', 0),
			board(99, 'Trash', 1710000000),
			board(42, 'Work', 0),
		]);
		const context = {
			getCredentials: async () => ({
				baseUrl: BASE,
				username: 'alice',
				appPassword: 'secret',
			}),
			helpers: { httpRequestWithAuthentication },
		};

		const boards = await loadBoards(context as never);
		expect(boards).toEqual([
			{ name: 'Personal', value: '1' },
			{ name: 'Work', value: '42' },
		]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				url: `${deckApiBase(BASE)}/boards`,
				json: true,
				headers: expect.objectContaining({ 'OCS-APIRequest': 'true' }),
			}),
		);
	});
});

describe('loadStacks mapping', () => {
	it('maps stack ids to string picker values', async () => {
		const { loadStacks } = await import('../GenericFunctions');

		const stack = (id: number, title: string) => ({
			id,
			title,
			boardId: 42,
			cards: [],
			order: 0,
			deletedAt: 0,
			lastModified: 0,
		});

		const httpRequestWithAuthentication = vi.fn(async () => [
			stack(3, 'Backlog'),
			stack(7, 'In Progress'),
		]);
		const context = {
			getCredentials: async () => ({
				baseUrl: BASE,
				username: 'alice',
				appPassword: 'secret',
			}),
			helpers: { httpRequestWithAuthentication },
		};

		const stacks = await loadStacks(context as never, '42');
		expect(stacks).toEqual([
			{ name: 'Backlog', value: '3' },
			{ name: 'In Progress', value: '7' },
		]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				url: `${deckApiBase(BASE)}/boards/42/stacks`,
				json: true,
			}),
		);
	});
});
