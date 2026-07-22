import {
	buildBoardUndoDeleteUrl,
	buildBoardUpdatePayload,
	buildBoardUrl,
	buildBoardsUrl,
	buildCardReorderUrl,
	buildCardUrl,
	buildCardsUrl,
	buildStackUrl,
	buildStacksUrl,
	deckApiBase,
	filterActiveBoards,
	flattenCardsFromStacks,
	findCardInStacks,
	mergeDefined,
	normalizeDeckColor,
	parseDeckBoard,
	parseDeckCard,
	parseDeckStack,
	resolveBoardId,
	resolveCardId,
	resolveStackId,
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

describe('findCardInStacks', () => {
	it('finds a card by id across stacks', () => {
		const card = findCardInStacks(
			[
				{
					id: 1,
					title: 'Todo',
					order: 0,
					cards: [{ id: 10, title: 'A', order: 0 }],
				},
				{
					id: 2,
					title: 'Done',
					order: 1,
					cards: [{ id: 20, title: 'B', order: 0 }],
				},
			],
			'20',
		);
		expect(card?.id).toBe(20);
		expect(card?.stackId).toBe(2);
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
		]);
		expect(boards.map((board) => board.id)).toEqual([1, 3]);
	});

	it('builds PUT payload with only title, color, and archived', () => {
		expect(
			buildBoardUpdatePayload(
				{
					id: 10,
					title: 'Current',
					color: 'ff0000',
					archived: false,
				},
				{ title: 'Renamed', color: '#00ff00' },
			),
		).toEqual({
			title: 'Renamed',
			color: '00ff00',
			archived: false,
		});
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

describe('flattenCardsFromStacks', () => {
	it('returns cards across stacks in order', () => {
		const cards = flattenCardsFromStacks([
			{
				id: 1,
				title: 'Todo',
				order: 0,
				cards: [
					{ id: 10, title: 'A', order: 0 },
					{ id: 11, title: 'B', order: 1 },
				],
			},
			{
				id: 2,
				title: 'Done',
				order: 1,
				cards: [{ id: 20, title: 'C', order: 0 }],
			},
		]);
		expect(cards.map((card) => card.id)).toEqual([10, 11, 20]);
		expect(cards[0].stackId).toBe(1);
		expect(cards[2].stackId).toBe(2);
	});

	it('honors an optional stack filter', () => {
		const cards = flattenCardsFromStacks(
			[
				{
					id: 1,
					title: 'Todo',
					order: 0,
					cards: [{ id: 10, title: 'A', order: 0 }],
				},
				{
					id: 2,
					title: 'Done',
					order: 1,
					cards: [{ id: 20, title: 'C', order: 0 }],
				},
			],
			'2',
		);
		expect(cards.map((card) => card.id)).toEqual([20]);
	});
});

describe('loadBoards mapping', () => {
	it('maps board ids to string picker values', async () => {
		const { loadBoards } = await import('../GenericFunctions');

		const context = {
			getCredentials: async () => ({
				baseUrl: BASE,
				username: 'alice',
				appPassword: 'secret',
			}),
			helpers: {
				httpRequestWithAuthentication: async () => [
					{ id: 1, title: 'Personal', color: '0082c9', deletedAt: 0 },
					{ id: 99, title: 'Trash', color: 'ff0000', deletedAt: 1710000000 },
					{ id: 42, title: 'Work', color: 'ff0000', deletedAt: 0 },
				],
			},
		};

		const boards = await loadBoards(context as never);
		expect(boards).toEqual([
			{ name: 'Personal', value: '1' },
			{ name: 'Work', value: '42' },
		]);
	});
});

describe('loadStacks mapping', () => {
	it('maps stack ids to string picker values', async () => {
		const { loadStacks } = await import('../GenericFunctions');

		const context = {
			getCredentials: async () => ({
				baseUrl: BASE,
				username: 'alice',
				appPassword: 'secret',
			}),
			helpers: {
				httpRequestWithAuthentication: async () => [
					{ id: 3, title: 'Backlog', order: 0 },
					{ id: 7, title: 'In Progress', order: 1 },
				],
			},
		};

		const stacks = await loadStacks(context as never, '42');
		expect(stacks).toEqual([
			{ name: 'Backlog', value: '3' },
			{ name: 'In Progress', value: '7' },
		]);
	});
});

describe('Deck response parsers', () => {
	it('preserves unknown API fields on cards, stacks, and boards', () => {
		const card = parseDeckCard({
			id: 10,
			title: 'Task',
			labels: [{ id: 1, title: 'Bug' }],
			assignedUsers: [{ participant: { uid: 'alice' } }],
		});
		expect(card).toMatchObject({
			id: 10,
			title: 'Task',
			labels: [{ id: 1, title: 'Bug' }],
			assignedUsers: [{ participant: { uid: 'alice' } }],
		});

		const stack = parseDeckStack({
			id: 2,
			title: 'Todo',
			order: 0,
			acl: [{ participant: { uid: 'bob' }, permission: 1 }],
			cards: [
				{
					id: 10,
					title: 'Task',
					labels: [{ id: 1, title: 'Bug' }],
				},
			],
		});
		expect(stack).toMatchObject({
			id: 2,
			acl: [{ participant: { uid: 'bob' }, permission: 1 }],
		});
		expect(stack.cards?.[0]).toMatchObject({
			id: 10,
			labels: [{ id: 1, title: 'Bug' }],
		});

		const board = parseDeckBoard({
			id: 1,
			title: 'Work',
			color: '0082c9',
			permissions: { PERMISSION_READ: true },
		});
		expect(board).toMatchObject({
			id: 1,
			title: 'Work',
			color: '0082c9',
			permissions: { PERMISSION_READ: true },
		});
	});
});
