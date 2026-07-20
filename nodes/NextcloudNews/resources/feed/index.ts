import type { INodeProperties } from 'n8n-workflow';

import { createFeedSelect, createFolderSelect } from '../../shared/descriptions';

const showOnlyForFeed = {
	resource: ['feed'],
};

export const feedDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForFeed,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a feed' },
			{ name: 'Delete', value: 'delete', action: 'Delete a feed' },
			{ name: 'Get Favicon', value: 'favicon', action: 'Get a feed favicon' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many feeds' },
			{ name: 'Mark Read', value: 'markRead', action: 'Mark a feed as read' },
			{ name: 'Move', value: 'move', action: 'Move a feed' },
			{ name: 'Rename', value: 'rename', action: 'Rename a feed' },
		],
		default: 'getAll',
	},
	{
		...createFolderSelect({
			name: 'folderFilter',
			displayName: 'Folder Filter',
			required: false,
			description: 'Optional folder used to filter the feed list',
			default: { mode: 'list', value: '' },
		}),
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['getAll', 'delete', 'move', 'rename', 'markRead', 'favicon'],
			},
		},
	},
	{
		...createFeedSelect(),
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['delete', 'move', 'rename', 'markRead', 'favicon'],
			},
		},
	},
	{
		displayName: 'Feed URL',
		name: 'feedUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'RSS/Atom feed URL to subscribe to',
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['create'],
			},
		},
	},
	{
		...createFolderSelect({
			name: 'folder',
			displayName: 'Folder',
			required: false,
			description: 'Destination folder (empty = root)',
			default: { mode: 'list', value: '' },
		}),
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['create', 'move'],
			},
		},
	},
	{
		displayName: 'Feed Title',
		name: 'feedTitle',
		type: 'string',
		default: '',
		required: true,
		description: 'New title for the feed',
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['rename'],
			},
		},
	},
	{
		displayName: 'Newest Item ID',
		name: 'newestItemId',
		type: 'number',
		default: 0,
		required: true,
		description: 'Mark all items up to this ID as read',
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['markRead'],
			},
		},
	},
	{
		displayName: 'Binary Property',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		description: 'Name of the binary property to write the favicon into',
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['favicon'],
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
				resource: ['feed'],
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
				resource: ['feed'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
];
