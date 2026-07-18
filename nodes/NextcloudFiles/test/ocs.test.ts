import {
	buildShareUpdateBody,
	parseShare,
	parseShareId,
	parseSharePasswordValidationResult,
	permissionsToBitmask,
	sanitizeSharePermissionLabels,
	OCS_SHARE_TYPE_PUBLIC,
	unwrapOcsResponse,
} from '../GenericFunctions';

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

describe('Nextcloud Files OCS helpers', () => {
	it('permissionsToBitmask ORs permission labels into the OCS bitmask', () => {
		expect(permissionsToBitmask(['read', 'share'])).toBe(17);
		expect(permissionsToBitmask(['read', 'update', 'create', 'delete', 'share'])).toBe(31);
		expect(permissionsToBitmask(['delete'])).toBe(8);
	});

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

	it('sanitizeSharePermissionLabels limits public link shares to read/create', () => {
		expect(
			sanitizeSharePermissionLabels(['read', 'update', 'share'], OCS_SHARE_TYPE_PUBLIC),
		).toEqual(['read']);
		expect(
			sanitizeSharePermissionLabels(['read', 'create'], OCS_SHARE_TYPE_PUBLIC),
		).toEqual(['read', 'create']);
		expect(sanitizeSharePermissionLabels(['update', 'share'], OCS_SHARE_TYPE_PUBLIC)).toEqual(
			[],
		);
	});

	it('buildShareUpdateBody rejects invalid public-link permission sets', () => {
		expect(() =>
			buildShareUpdateBody({
				fieldsToUpdate: ['permissions'],
				permissions: ['update', 'share'],
				shareType: OCS_SHARE_TYPE_PUBLIC,
			}),
		).toThrow('No valid permissions remain for this share type');
	});

	it('buildShareUpdateBody defaults public-link permissions to read when none selected', () => {
		expect(
			buildShareUpdateBody({
				fieldsToUpdate: ['permissions'],
				permissions: [],
				shareType: OCS_SHARE_TYPE_PUBLIC,
			}),
		).toEqual({
			permissions: 1,
		});
	});

	it('parseShareId accepts numeric strings from expressions', () => {
		expect(parseShareId('42')).toBe(42);
		expect(parseShareId(42)).toBe(42);
		expect(() => parseShareId('')).toThrow('Share ID is required');
		expect(() => parseShareId('abc')).toThrow('Share ID must be a positive number');
	});

	it('buildShareUpdateBody only sends selected fields', () => {
		expect(
			buildShareUpdateBody({
				fieldsToUpdate: ['permissions', 'expireDate'],
				permissions: ['read'],
				expireDate: '2026-12-31',
			}),
		).toEqual({
			permissions: 1,
			expireDate: '2026-12-31',
		});

		expect(
			buildShareUpdateBody({
				fieldsToUpdate: ['publicUpload'],
				publicUpload: true,
			}),
		).toEqual({
			publicUpload: 'true',
		});

		expect(
			buildShareUpdateBody({
				fieldsToUpdate: ['publicUpload'],
				publicUpload: false,
			}),
		).toEqual({
			publicUpload: 'false',
		});

		expect(
			buildShareUpdateBody({
				fieldsToUpdate: ['password'],
				password: '',
			}),
		).toEqual({
			password: '',
		});

		expect(() => buildShareUpdateBody({ fieldsToUpdate: [] })).toThrow(
			'Select at least one field to update',
		);
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
});
