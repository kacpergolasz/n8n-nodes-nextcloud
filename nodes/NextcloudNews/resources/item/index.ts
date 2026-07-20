import type { INodeProperties } from 'n8n-workflow';

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
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		default: 50,
		description:
			'Number of items to return. Use -1 for all matching items (can be very large).',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Offset',
		name: 'offset',
		type: 'number',
		default: 0,
		description:
			'Item ID cursor: return older items with ID less than or equal to this value. Use 0 for the newest page; then pass nextOffset from the previous page.',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Scope',
		name: 'itemsType',
		type: 'options',
		options: [
			{ name: 'All', value: 3 },
			{ name: 'Feed', value: 0 },
			{ name: 'Folder', value: 1 },
			{ name: 'Starred', value: 2 },
		],
		default: 3,
		description: 'Which items to list',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Scope ID',
		name: 'scopeId',
		type: 'number',
		default: 0,
		description: 'Feed or folder ID when Scope is Feed or Folder; use 0 for All or Starred',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: getAllOps,
			},
		},
	},
	{
		displayName: 'Include Read',
		name: 'getRead',
		type: 'boolean',
		default: true,
		description: 'Whether to include already-read items (false = unread only)',
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
