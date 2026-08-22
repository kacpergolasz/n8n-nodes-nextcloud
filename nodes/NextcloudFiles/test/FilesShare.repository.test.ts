
import type { FilesClient } from '../files.client';
import {
	buildOcsFormBody,
	createShare,
	listShares,
	parseShare,
	parseSharePasswordValidationResult,
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

const LIST_SHARE_DATA = [
	{
		id: 10,
		share_type: 0,
		share_with: 'bob',
		path: '/Documents/shared-folder',
		permissions: 31,
	},
	{
		id: 11,
		share_type: 3,
		share_with: '',
		path: '/Public/readme.txt',
		permissions: 1,
		url: 'https://cloud.example.com/s/XyZ123',
		token: 'XyZ123',
	},
];

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

describe('OCS share helpers', () => {
	it('parseShare normalizes a create-response object', () => {
		expect(parseShare(CREATE_SHARE_DATA)).toEqual({
			id: 42,
			shareType: 3,
			shareWith: undefined,
			path: '/Documents/report.pdf',
			permissions: 1,
			url: 'https://cloud.example.com/s/AbCdEfGh',
			token: 'AbCdEfGh',
			expiration: '2026-12-31',
			note: 'Quarterly report',
			publicUpload: false,
			uidOwner: 'alice',
			displaynameOwner: 'Alice Example',
			itemType: 'file',
			mimetype: 'application/pdf',
		});
	});

	it('parseShare normalizes each share in a list-response array', () => {
		const shares = LIST_SHARE_DATA.map((entry) => parseShare(entry));

		expect(shares).toEqual([
			{
				id: 10,
				shareType: 0,
				shareWith: 'bob',
				path: '/Documents/shared-folder',
				permissions: 31,
				url: undefined,
				token: undefined,
				expiration: undefined,
				note: undefined,
				publicUpload: undefined,
				uidOwner: undefined,
				displaynameOwner: undefined,
				itemType: undefined,
				mimetype: undefined,
			},
			{
				id: 11,
				shareType: 3,
				shareWith: undefined,
				path: '/Public/readme.txt',
				permissions: 1,
				url: 'https://cloud.example.com/s/XyZ123',
				token: 'XyZ123',
				expiration: undefined,
				note: undefined,
				publicUpload: undefined,
				uidOwner: undefined,
				displaynameOwner: undefined,
				itemType: undefined,
				mimetype: undefined,
			},
		]);
	});

	it('unwrapOcsResponse accepts OCS success codes 100 and 200', () => {
		expect(
			unwrapOcsResponse({
				ocs: { meta: { status: 'ok', statuscode: 100 }, data: { id: 1 } },
			}),
		).toEqual({ id: 1 });
		expect(
			unwrapOcsResponse({
				ocs: { meta: { status: 'ok', statuscode: 200 }, data: [{ id: 2 }] },
			}),
		).toEqual([{ id: 2 }]);
	});

	it('parseShare normalizes a GET-by-id array response', () => {
		expect(parseShare([CREATE_SHARE_DATA])).toEqual(parseShare(CREATE_SHARE_DATA));
	});

	it('parseShare falls back to file_target when path is missing', () => {
		expect(
			parseShare({
				id: 7,
				share_type: 3,
				file_target: '/Documents/report.pdf',
				permissions: 1,
			}),
		).toMatchObject({
			id: 7,
			shareType: 3,
			path: '/Documents/report.pdf',
		});
	});

	it('buildOcsFormBody retains empty password and expireDate for share clears', () => {
		expect(buildOcsFormBody({ password: '', expireDate: '' })).toBe('password=&expireDate=');
		expect(buildOcsFormBody({ permissions: 1, note: undefined })).toBe('permissions=1');
	});

	it('parseSharePasswordValidationResult returns the server reason when validation fails', () => {
		expect(
			parseSharePasswordValidationResult({
				ocs: {
					meta: { status: 'ok', statuscode: 200 },
					data: {
						passed: false,
						reason: 'Password must be at least 10 characters long.',
					},
				},
			}),
		).toBe('Password must be at least 10 characters long.');
	});

	it('parseSharePasswordValidationResult accepts a passing validation response', () => {
		expect(
			parseSharePasswordValidationResult({
				ocs: {
					meta: { status: 'ok', statuscode: 200 },
					data: { passed: true },
				},
			}),
		).toBeUndefined();
	});

	it('unwrapOcsResponse throws on OCS failure codes below 400', () => {
		expect(() =>
			unwrapOcsResponse({
				ocs: { meta: { status: 'failure', statuscode: 997, message: 'Unauthorized' }, data: [] },
			}),
		).toThrow('Unauthorized');

		const error = (() => {
			try {
				unwrapOcsResponse({
					ocs: { meta: { status: 'failure', statuscode: 404, message: 'Not found' }, data: [] },
				});
			} catch (caught) {
				return caught as Error & { statusCode?: number };
			}
			return undefined;
		})();

		expect(error?.message).toBe('Not found');
		expect(error?.statusCode).toBe(404);
	});

	it('unwrapOcsResponse surfaces localized expireDate validation messages', () => {
		const error = (() => {
			try {
				unwrapOcsResponse({
					ocs: {
						meta: { status: 'failure', statuscode: 404, message: 'Data ważności już minęła' },
						data: [],
					},
				});
			} catch (caught) {
				return caught as Error & { statusCode?: number };
			}
			return undefined;
		})();

		expect(error?.message).toBe('Data ważności już minęła');
		expect(error?.statusCode).toBe(404);
	});
});
