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
	normalizeDeckColor,
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
					owner: { uid: 'admin' },
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
