import type { INodeProperties } from 'n8n-workflow';
import { boardSelect } from '../../shared/descriptions';

const showOnlyForBoard = {
	resource: ['board'],
};

export const boardDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForBoard,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a board' },
			{ name: 'Delete', value: 'delete', action: 'Delete a board' },
			{ name: 'Get', value: 'get', action: 'Get a board' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many boards' },
			{ name: 'Update', value: 'update', action: 'Update a board' },
		],
		default: 'getAll',
	},
	{
		...boardSelect,
		displayOptions: {
			show: {
				resource: ['board'],
				operation: ['get', 'update', 'delete'],
			},
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description:
			'Board title. Required when creating a board; leave empty on update to keep the current title.',
		displayOptions: {
			show: {
				resource: ['board'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Board Color',
		name: 'hexColor',
		type: 'color',
		default: '',
		placeholder: '#0082c9',
		description:
			'Hex color. Required when creating a board; leave empty on update to keep the current color.',
		displayOptions: {
			show: {
				resource: ['board'],
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
				resource: ['board'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Archived',
				name: 'archived',
				type: 'boolean',
				default: false,
				description: 'Whether the board is archived',
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		description: 'Whether to return all results or only up to a given limit',
		default: false,
		displayOptions: {
			show: {
				resource: ['board'],
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
				resource: ['board'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
];
