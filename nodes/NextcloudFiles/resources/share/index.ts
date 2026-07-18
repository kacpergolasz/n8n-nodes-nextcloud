import type { INodeProperties } from 'n8n-workflow';

import {
	pathSelect,
	shareIdField,
	sharePermissionsField,
} from '../../shared/descriptions';

const showOnlyForShare = {
	resource: ['share'],
};

export const shareDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForShare,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a share' },
			{ name: 'Delete', value: 'delete', action: 'Delete a share' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many shares' },
			{ name: 'Update', value: 'update', action: 'Update a share' },
		],
		default: 'getAll',
	},
	{
		...pathSelect,
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Share Type',
		name: 'shareType',
		type: 'options',
		options: [
			{ name: 'Email', value: 4 },
			{ name: 'Group', value: 1 },
			{ name: 'Public Link', value: 3 },
			{ name: 'User', value: 0 },
		],
		default: 3,
		description: 'Type of share to create',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Share With',
		name: 'shareWith',
		type: 'string',
		default: '',
		description: 'User ID, group ID, or email address to share with',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create'],
				shareType: [0, 1, 4],
			},
		},
	},
	{
		...sharePermissionsField,
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Password',
		name: 'password',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		description: 'Optional password to protect a public link share',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Expire Date',
		name: 'expireDate',
		type: 'string',
		default: '',
		placeholder: 'YYYY-MM-DD',
		description: 'Optional expiration date for public link shares',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Public Upload',
		name: 'publicUpload',
		type: 'boolean',
		default: false,
		description: 'Whether to allow uploads to a public shared folder',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Note',
		name: 'note',
		type: 'string',
		default: '',
		description: 'Optional note for the share recipient',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Path Filter',
		name: 'filterPath',
		type: 'string',
		default: '',
		placeholder: 'e.g. /Documents',
		description: 'Optional path to filter shares (relative to your files root)',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		description: 'Whether to return all results or only up to a given limit',
		default: false,
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		description: 'Max number of results to return',
		typeOptions: { minValue: 1 },
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit
		default: 100,
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
	{
		...shareIdField,
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['update', 'delete'],
			},
		},
	},
];
