import type { FilesClient } from '../files.client';
import {
	createShare,
	listShares,
	parseShare,
	unwrapOcsResponse,
} from '../repositories/FilesShare.repository';

const CREATE_SHARE_DATA = {
	id: 42,
	share_type: 3,
	share_with: '',
	path: '/Documents/report.pdf',
	permissions: 1,
	url: 'https://cloud.example.com/s/AbCdEfGh',
	token: 'AbCdEfGh',
	expiration: '2026-12-31',
	note: 'Quarterly report',
	public_upload: 'false',
	uid_owner: 'alice',
	displayname_owner: 'Alice Example',
	item_type: 'file',
	mimetype: 'application/pdf',
};

describe('createShare', () => {
	it('posts form-urlencoded share body and parses the envelope', async () => {
		const client = {
			post: vi.fn(async () => ({
				success: true as const,
				response: {
					ocs: { meta: { status: 'ok', statuscode: 100 }, data: CREATE_SHARE_DATA },
				},
			})),
		};

		const result = await createShare(client as unknown as FilesClient, {
			body: { path: '/Documents/report.pdf', shareType: 3, permissions: 1 },
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response).toMatchObject({
				id: 42,
				shareType: 3,
				path: '/Documents/report.pdf',
				url: 'https://cloud.example.com/s/AbCdEfGh',
			});
		}
		expect(client.post).toHaveBeenCalledWith(
			'/ocs/v2.php/apps/files_sharing/api/v1/shares',
			'path=%2FDocuments%2Freport.pdf&shareType=3&permissions=1',
			{ format: 'json' },
			expect.objectContaining({
				'OCS-APIRequest': 'true',
				'Content-Type': 'application/x-www-form-urlencoded',
			}),
			{ json: true, ignoreHttpStatusErrors: true },
		);
	});

	it('surfaces OCS business failures as Maybe errors', async () => {
		const client = {
			post: vi.fn(async () => ({
				success: true as const,
				response: {
					ocs: {
						meta: { status: 'failure', statuscode: 404, message: 'Data ważności już minęła' },
						data: [],
					},
				},
			})),
		};

		const result = await createShare(client as unknown as FilesClient, {
			body: { path: '/x', shareType: 3, permissions: 1 },
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe('Data ważności już minęła');
		}
	});
});

describe('listShares', () => {
	it('maps an array of share payloads', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: true as const,
				response: {
					ocs: {
						meta: { status: 'ok', statuscode: 100 },
						data: [CREATE_SHARE_DATA],
					},
				},
			})),
		};

		const result = await listShares(client as unknown as FilesClient, {
			path: '/Documents/report.pdf',
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response).toHaveLength(1);
			expect(result.response[0]?.id).toBe(42);
		}
		expect(client.get).toHaveBeenCalledWith(
			'/ocs/v2.php/apps/files_sharing/api/v1/shares',
			{ format: 'json', path: '/Documents/report.pdf' },
			expect.any(Object),
			{ json: true, ignoreHttpStatusErrors: true },
		);
	});
});

describe('parseShare / unwrapOcsResponse', () => {
	it('parseShare normalizes create payloads', () => {
		expect(parseShare(CREATE_SHARE_DATA)).toMatchObject({
			id: 42,
			shareType: 3,
			path: '/Documents/report.pdf',
			publicUpload: false,
		});
	});

	it('unwrapOcsResponse accepts 100 and 200', () => {
		expect(
			unwrapOcsResponse({
				ocs: { meta: { status: 'ok', statuscode: 100 }, data: { id: 1 } },
			}),
		).toEqual({ id: 1 });
	});
});
