import type { INodeProperties } from 'n8n-workflow';

export const pathSelect: INodeProperties = {
	displayName: 'Path',
	name: 'path',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description:
		'File or folder path relative to your Nextcloud files root — e.g. /Documents/report.pdf. Search or scroll the list, or type a path manually.',
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'getFolders',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. /Documents/report.pdf',
		},
	],
};

export const destinationPathField: INodeProperties = {
	displayName: 'Destination Path',
	name: 'destinationPath',
	type: 'string',
	required: true,
	default: '',
	description: 'Target path relative to your Nextcloud files root',
};

export const overwriteField: INodeProperties = {
	displayName: 'Overwrite',
	name: 'overwrite',
	type: 'boolean',
	default: false,
	description: 'Whether to overwrite an existing resource at the destination',
};

export const sharePermissionsField: INodeProperties = {
	displayName: 'Permissions',
	name: 'permissions',
	type: 'multiOptions',
	options: [
		{ name: 'Create', value: 'create' },
		{ name: 'Delete', value: 'delete' },
		{ name: 'Read', value: 'read' },
		{ name: 'Share', value: 'share' },
		{ name: 'Update', value: 'update' },
	],
	default: ['read', 'update', 'create', 'delete', 'share'],
	description: 'Permissions granted on the shared resource',
};

export const sharePasswordFieldDescription =
	'Password for the public link. Must meet your Nextcloud server share password policy (commonly at least 10 characters).';

export const shareUpdatePasswordFieldDescription =
	'Password to set on the public link. Leave empty to remove password protection. Must meet your Nextcloud server share password policy.';

export const shareUpdateFieldsField: INodeProperties = {
	displayName: 'Fields to Update',
	name: 'updateFields',
	type: 'multiOptions',
	options: [
		{ name: 'Expire Date', value: 'expireDate' },
		{ name: 'Password', value: 'password' },
		{ name: 'Permissions', value: 'permissions' },
		{ name: 'Public Upload', value: 'publicUpload' },
	],
	default: [],
	required: true,
	description: 'Choose which share properties to change in this request',
};

export const shareUpdatePermissionsField: INodeProperties = {
	displayName: 'Permissions',
	name: 'updatePermissions',
	type: 'multiOptions',
	options: [
		{ name: 'Create', value: 'create' },
		{ name: 'Delete', value: 'delete' },
		{ name: 'Read', value: 'read' },
		{ name: 'Share', value: 'share' },
		{ name: 'Update', value: 'update' },
	],
	default: [],
	description:
		'Permissions to apply. Public link shares support Read only (Create for folder uploads). Leave empty to set Read-only on public links.',
};

export const shareIdField: INodeProperties = {
	displayName: 'Share ID',
	name: 'shareId',
	type: 'string',
	required: true,
	default: '',
	description: 'ID of the share to update or delete — e.g. from a previous Create or Get Many item',
};
