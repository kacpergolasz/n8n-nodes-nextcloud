import type { INodeProperties } from 'n8n-workflow';
import { createBoardSelect, createStackSelect } from '../../shared/descriptions';

const showOnlyForCard = {
	resource: ['card'],
};

export const cardDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForCard,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a card' },
			{ name: 'Delete', value: 'delete', action: 'Delete a card' },
			{ name: 'Get', value: 'get', action: 'Get a card' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many cards' },
			{ name: 'Move', value: 'move', action: 'Move a card' },
			{ name: 'Update', value: 'update', action: 'Update a card' },
		],
		default: 'get',
	},
	{
		...createBoardSelect(),
		displayOptions: {
			show: showOnlyForCard,
		},
	},
	{
		...createStackSelect(),
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['create', 'get', 'delete'],
			},
		},
	},
	{
		...createStackSelect({
			displayName: 'Stack Filter',
			name: 'stackFilter',
			required: false,
			description:
				'Optionally limit results to a single stack. Get Many loads all stacks (with nested cards) for the board in one request, then filters and limits client-side',
		}),
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Card ID',
		name: 'cardId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['get', 'delete', 'update', 'move'],
			},
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'Leave empty on update to keep the current title',
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Due Date',
		name: 'dueDate',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Clear Due Date',
				name: 'clearDueDate',
				type: 'boolean',
				default: false,
				description: 'Whether to remove the card due date',
			},
		],
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'hidden',
		default: 'plain',
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Order',
		name: 'order',
		type: 'number',
		default: 0,
		description: 'Position of the card within the stack',
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['create', 'move'],
			},
		},
	},
	{
		...createStackSelect({
			displayName: 'Target Stack',
			name: 'toStack',
			description: 'The stack to move the card into',
		}),
		displayOptions: {
			show: {
				resource: ['card'],
				operation: ['move'],
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
				resource: ['card'],
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
				resource: ['card'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
];
