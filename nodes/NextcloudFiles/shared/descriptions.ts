import type { INodeProperties } from 'n8n-workflow';

export const pathSelect: INodeProperties = {
	displayName: 'Path',
	name: 'path',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description:
		'File or folder path relative to your Nextcloud files root — e.g. /Documents/report.pdf. Browse one directory level or type a path manually.',
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

export const shareIdField: INodeProperties = {
	displayName: 'Share ID',
	name: 'shareId',
	type: 'number',
	required: true,
	default: 0,
	description: 'ID of the share to update or delete',
};
