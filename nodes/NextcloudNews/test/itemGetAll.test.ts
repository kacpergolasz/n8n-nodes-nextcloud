import { buildNewsItemsQueryParams } from '../../shared/pagination';
import {
	itemGetAll,
	newsItemsNextOffsetHint,
	resolveNewsItemsListScope,
} from '../resources/item/getAll';

const CREDENTIALS = {
	baseUrl: 'https://cloud.example.com',
	username: 'alice',
	appPassword: 'secret',
};

describe('newsItemsNextOffsetHint', () => {
	it('returns the lowest id when the page is full', () => {
		expect(newsItemsNextOffsetHint([{ id: 50 }, { id: 43 }, { id: 60 }], 3)).toBe(43);
	});

	it('returns null for a partial page (end of list)', () => {
		expect(newsItemsNextOffsetHint([{ id: 50 }, { id: 43 }], 20)).toBeNull();
	});

	it('returns null for an empty page', () => {
		expect(newsItemsNextOffsetHint([], 20)).toBeNull();
	});

	it('returns null when batchSize is -1 (fetch all)', () => {
		expect(newsItemsNextOffsetHint([{ id: 1 }, { id: 2 }], -1)).toBeNull();
	});
});

describe('resolveNewsItemsListScope', () => {
	it('defaults to All when no filters are set', () => {
		expect(resolveNewsItemsListScope({ starredOnly: false })).toEqual({ type: 3, id: 0 });
	});

	it('uses feed when set (wins over folder and starred)', () => {
		expect(
			resolveNewsItemsListScope({ feedId: 67, folderId: 12, starredOnly: true }),
		).toEqual({ type: 0, id: 67 });
	});

	it('uses folder when feed is empty', () => {
		expect(resolveNewsItemsListScope({ folderId: 12, starredOnly: true })).toEqual({
			type: 1,
			id: 12,
		});
	});

	it('uses starred only when feed and folder are empty', () => {
		expect(resolveNewsItemsListScope({ starredOnly: true })).toEqual({ type: 2, id: 0 });
	});
});

describe('itemGetAll', () => {
	const httpRequestWithAuthentication = vi.fn();

	function makeContext(params: Record<string, unknown>) {
		return {
			getNodeParameter: (
				name: string,
				_index: number,
				fallback?: unknown,
				options?: { extractValue?: boolean; ensureType?: string },
			) => {
				let value = Object.prototype.hasOwnProperty.call(params, name)
					? params[name]
					: fallback;
				if (
					options?.extractValue &&
					value !== null &&
					typeof value === 'object' &&
					'value' in (value as object)
				) {
					value = (value as { value: unknown }).value;
				}
				if (options?.ensureType === 'string' && value !== undefined && value !== null) {
					return String(value);
				}
				return value;
			},
			getCredentials: async () => CREDENTIALS,
			helpers: {
				httpRequestWithAuthentication,
			},
		};
	}

	beforeEach(() => {
		httpRequestWithAuthentication.mockReset();
	});

	it('returns a single { items, nextOffset } envelope (no per-item offset)', async () => {
		httpRequestWithAuthentication.mockResolvedValue({
			items: [
				{ id: 60, title: 'Newer' },
				{ id: 50, title: 'Mid' },
				{ id: 43, title: 'Older' },
			],
		});

		const result = await itemGetAll(
			makeContext({
				limit: 3,
				offset: 0,
				folderFilter: { mode: 'list', value: '' },
				feedFilter: { mode: 'list', value: '' },
				starredOnly: false,
				unreadOnly: true,
				oldestFirst: false,
			}) as never,
			{ itemIndex: 0, credentials: CREDENTIALS },
		);

		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
			method: 'GET',
			url: 'https://cloud.example.com/index.php/apps/news/api/v1-3/items',
			qs: buildNewsItemsQueryParams({
				batchSize: 3,
				offset: 0,
				type: 3,
				id: 0,
				getRead: false,
				oldestFirst: false,
			}),
		});

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			items: [
				{ id: 60, title: 'Newer' },
				{ id: 50, title: 'Mid' },
				{ id: 43, title: 'Older' },
			],
			nextOffset: 43,
		});
		expect(result[0].pairedItem).toEqual({ item: 0 });
	});

	it('scopes by folder filter and sets nextOffset null on a partial page', async () => {
		httpRequestWithAuthentication.mockResolvedValue({
			items: [
				{ id: 42, title: 'A' },
				{ id: 30, title: 'B' },
			],
		});

		const result = await itemGetAll(
			makeContext({
				limit: 20,
				offset: 43,
				folderFilter: { mode: 'id', value: 12 },
				feedFilter: { mode: 'list', value: '' },
				starredOnly: false,
				unreadOnly: true,
				oldestFirst: false,
			}) as never,
			{ itemIndex: 1, credentials: CREDENTIALS },
		);

		expect(httpRequestWithAuthentication.mock.calls[0][1].qs).toEqual(
			buildNewsItemsQueryParams({
				batchSize: 20,
				offset: 43,
				type: 1,
				id: 12,
				getRead: false,
				oldestFirst: false,
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0].json.nextOffset).toBeNull();
		expect((result[0].json.items as unknown[]).map((row) => (row as { id: number }).id)).toEqual([
			42, 30,
		]);
		expect(result[0].pairedItem).toEqual({ item: 1 });
	});

	it('scopes by feed filter when set', async () => {
		httpRequestWithAuthentication.mockResolvedValue({ items: [{ id: 1, title: 'X' }] });

		await itemGetAll(
			makeContext({
				limit: 10,
				offset: 0,
				folderFilter: { mode: 'id', value: 12 },
				feedFilter: { mode: 'list', value: '67' },
				starredOnly: false,
				unreadOnly: false,
				oldestFirst: false,
			}) as never,
			{ itemIndex: 0, credentials: CREDENTIALS },
		);

		expect(httpRequestWithAuthentication.mock.calls[0][1].qs).toMatchObject({
			type: 0,
			id: 67,
			batchSize: 10,
			getRead: true,
		});
	});

	it('maps Unread Only to getRead=false for type All', async () => {
		httpRequestWithAuthentication.mockResolvedValue({
			items: [{ id: 9, title: 'Unread', unread: true }],
		});

		await itemGetAll(
			makeContext({
				limit: 50,
				offset: 0,
				folderFilter: '',
				feedFilter: '',
				starredOnly: false,
				unreadOnly: true,
				oldestFirst: false,
			}) as never,
			{ itemIndex: 0, credentials: CREDENTIALS },
		);

		expect(httpRequestWithAuthentication.mock.calls[0][1].qs).toMatchObject({
			type: 3,
			id: 0,
			getRead: false,
			batchSize: 50,
			offset: 0,
		});
	});

	it('returns { items: [], nextOffset: null } when News returns no items', async () => {
		httpRequestWithAuthentication.mockResolvedValue({ items: [] });

		const result = await itemGetAll(
			makeContext({
				limit: 10,
				offset: 0,
				folderFilter: { mode: 'list', value: '' },
				feedFilter: { mode: 'list', value: '' },
				starredOnly: false,
				unreadOnly: false,
				oldestFirst: false,
			}) as never,
			{ itemIndex: 0, credentials: CREDENTIALS },
		);

		expect(result).toEqual([
			{
				json: { items: [], nextOffset: null },
				pairedItem: { item: 0 },
			},
		]);
	});
});
