import { parseShare, permissionsToBitmask, unwrapOcsResponse } from '../GenericFunctions';

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
