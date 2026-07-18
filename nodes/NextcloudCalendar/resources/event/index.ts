import type { INodeProperties } from 'n8n-workflow';
import { calendarSelect } from '../../shared/descriptions';

const showOnlyForEvents = {
	resource: ['event'],
};

export const eventDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForEvents,
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create an event' },
			{ name: 'Delete', value: 'delete', action: 'Delete an event' },
			{ name: 'Get', value: 'get', action: 'Get an event' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many events' },
			{ name: 'Update', value: 'update', action: 'Update an event' },
		],
		default: 'get',
	},
	{
		...calendarSelect,
		displayOptions: {
			show: showOnlyForEvents,
		},
	},
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['get', 'delete', 'update'],
			},
		},
	},
	{
		displayName: 'Summary',
		name: 'summary',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'Start Date Time',
		name: 'start',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['create', 'update'],
			},
		},
	},
	{
		displayName: 'End Date Time',
		name: 'end',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['create', 'update'],
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
				resource: ['event'],
				operation: ['create', 'update'],
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
				resource: ['event'],
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
		default: 50,
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'After',
		name: 'after',
		type: 'dateTime',
		default: '',
		description:
			'Only include events whose start is at or after this time. Leave empty for no lower bound.',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Before',
		name: 'before',
		type: 'dateTime',
		default: '',
		description:
			'Only include events whose start is at or before this time. Leave empty for no upper bound.',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['getAll'],
			},
		},
	},
];
