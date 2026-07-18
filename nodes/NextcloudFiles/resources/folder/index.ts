import type { INodeProperties } from 'n8n-workflow';

import {
	destinationPathField,
	overwriteField,
	pathSelect,
} from '../../shared/descriptions';

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
			{ name: 'Copy', value: 'copy', action: 'Copy a folder' },
			{ name: 'Create', value: 'create', action: 'Create a folder' },
			{ name: 'Delete', value: 'delete', action: 'Delete a folder' },
			{ name: 'List', value: 'list', action: 'List folder contents' },
			{ name: 'Move', value: 'move', action: 'Move a folder' },
		],
		default: 'list',
	},
	{
		...pathSelect,
		displayOptions: {
			show: showOnlyForFolder,
		},
	},
	{
		...destinationPathField,
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['move', 'copy'],
			},
		},
	},
	{
		...overwriteField,
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['move', 'copy'],
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
				operation: ['list'],
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
				resource: ['folder'],
				operation: ['list'],
				returnAll: [false],
			},
		},
	},
];
