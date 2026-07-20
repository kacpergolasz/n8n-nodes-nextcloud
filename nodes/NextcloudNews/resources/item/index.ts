import type { INodeProperties } from 'n8n-workflow';

import { createFeedSelect, createFolderSelect } from '../../shared/descriptions';

const showOnlyForItem = {
	resource: ['item'],
};

const singleOps = ['markRead', 'markUnread', 'star', 'unstar'];
const bulkOps = ['markReadMultiple', 'markUnreadMultiple', 'starMultiple', 'unstarMultiple'];
const getAllOps = ['getAll'];

export const itemDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForItem,
		},
		options: [
			{ name: 'Get Many', value: 'getAll', action: 'Get many items' },
			{ name: 'Mark Read', value: 'markRead', action: 'Mark an item as read' },
			{ name: 'Mark Read Many', value: 'markReadMultiple', action: 'Mark many items as read' },
			{ name: 'Mark Unread', value: 'markUnread', action: 'Mark an item as unread' },
			{
				name: 'Mark Unread Many',
				value: 'markUnreadMultiple',
				action: 'Mark many items as unread',
			},
			{ name: 'Star', value: 'star', action: 'Star an item' },
			{ name: 'Star Many', value: 'starMultiple', action: 'Star many items' },
			{ name: 'Unstar', value: 'unstar', action: 'Unstar an item' },
			{ name: 'Unstar Many', value: 'unstarMultiple', action: 'Unstar many items' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description:
			'Max articles to return in this page (News batchSize). Output is one item: { items, nextOffset }. Split Out on items for one row per article.',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Offset (Item ID)',
		name: 'offset',
		type: 'number',
		default: 0,
		description:
			'Item ID cursor: return older items with ID less than or equal to this value. Use 0 for the newest page; then pass nextOffset from the previous response (null when there is no next page).',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		...createFolderSelect({
			name: 'folderFilter',
			displayName: 'Folder Filter',
			required: false,
			description: 'Optional folder to list items from. Leave empty to skip.',
			default: { mode: 'list', value: '' },
		}),
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		...createFeedSelect({
			name: 'feedFilter',
			displayName: 'Feed Filter',
			required: false,
			description: 'Optional feed to list items from. Leave empty to skip. Takes precedence over Folder Filter.',
			default: { mode: 'list', value: '' },
			typeOptions: {
				loadOptionsDependsOn: ['folderFilter.value'],
			},
		}),
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Starred Only',
		name: 'starredOnly',
		type: 'boolean',
		default: false,
		description:
			'Whether to list only starred items. Applied only when Feed Filter and Folder Filter are empty.',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Unread Only',
		name: 'unreadOnly',
		type: 'boolean',
		default: false,
		description: 'Whether to return only unread items',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Oldest First',
		name: 'oldestFirst',
		type: 'boolean',
		default: false,
		description: 'Whether to reverse sort order (oldest first)',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Item ID',
		name: 'itemId',
		type: 'number',
		default: 0,
		required: true,
		description: 'News article item ID',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: singleOps,
			},
		},
	},
	{
		displayName: 'Item IDs',
		name: 'itemIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated item IDs, or a JSON array of IDs',
		placeholder: '101, 102, 103',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: bulkOps,
			},
		},
	},
];
