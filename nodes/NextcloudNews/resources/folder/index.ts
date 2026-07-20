import type { INodeProperties } from 'n8n-workflow';

import { createFolderSelect } from '../../shared/descriptions';

const showOnlyForFolder = {
	resource: ['folder'],
};

export const folderDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForFolder,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a folder' },
			{ name: 'Delete', value: 'delete', action: 'Delete a folder' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many folders' },
			{ name: 'Rename', value: 'rename', action: 'Rename a folder' },
		],
		default: 'getAll',
	},
	{
		...createFolderSelect(),
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['rename', 'delete'],
			},
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Folder name',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['create', 'rename'],
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
				resource: ['folder'],
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
		default: 10,
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
];
