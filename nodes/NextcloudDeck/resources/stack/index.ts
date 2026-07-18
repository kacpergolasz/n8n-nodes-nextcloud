import type { INodeProperties } from 'n8n-workflow';
import { createBoardSelect } from '../../shared/descriptions';

const showOnlyForStack = {
	resource: ['stack'],
};

export const stackDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForStack,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a stack' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many stacks' },
		],
		default: 'getAll',
	},
	{
		...createBoardSelect(),
		displayOptions: {
			show: showOnlyForStack,
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
				resource: ['stack'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Order',
		name: 'order',
		type: 'number',
		default: 0,
		description: 'Position of the stack within the board',
		displayOptions: {
			show: {
				resource: ['stack'],
				operation: ['create'],
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
				resource: ['stack'],
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
				resource: ['stack'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
];
