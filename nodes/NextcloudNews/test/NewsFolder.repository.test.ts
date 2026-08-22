import type { NewsClient } from '../news.client';
import {
	createFolder,
	getFolders,
	newsFolderSchema,
} from '../repositories/NewsFolder.repository';

describe('newsFolderSchema', () => {
	it('accepts folder payloads', () => {
		expect(newsFolderSchema.parse({ id: 4, name: 'Media' })).toEqual({
			id: 4,
			name: 'Media',
		});
	});

	it('coerces string ids', () => {
		expect(newsFolderSchema.parse({ id: '12', name: 'Tech' })).toEqual({
			id: 12,
			name: 'Tech',
		});
	});
});

describe('getFolders', () => {
	it('unwraps a folders envelope', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: true as const,
				response: { folders: [{ id: 1, name: 'Tech' }] },
			})),
		};

		const result = await getFolders(client as unknown as NewsClient);
		expect(result).toEqual({
			success: true,
			response: [{ id: 1, name: 'Tech' }],
		});
	});

	it('rejects an unrecognized envelope', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: true as const,
				response: { notFolders: 1 },
			})),
		};

		const result = await getFolders(client as unknown as NewsClient);
		expect(result.success).toBe(false);
	});
});

describe('createFolder', () => {
	it('returns the first folder from a create envelope', async () => {
		const client = {
			post: vi.fn(async () => ({
				success: true as const,
				response: { folders: [{ id: 4, name: 'Media' }] },
			})),
		};

		const result = await createFolder(client as unknown as NewsClient, { name: 'Media' });
		expect(result).toEqual({
			success: true,
			response: { id: 4, name: 'Media' },
		});
	});

	it('fails when the create envelope is empty', async () => {
		const client = {
			post: vi.fn(async () => ({
				success: true as const,
				response: { folders: [] },
			})),
		};

		const result = await createFolder(client as unknown as NewsClient, { name: 'Empty' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe('Folder create returned an empty response');
		}
	});
});
