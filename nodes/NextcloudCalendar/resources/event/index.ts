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
				operation: ['create'],
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
				operation: ['create'],
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
				operation: ['create'],
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
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Location',
		name: 'location',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['event'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'All Day',
				name: 'allDay',
				type: 'boolean',
				default: false,
				description:
					'Whether the event is an all-day event. When true, start/end are stored as dates only.',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
			},
			{
				displayName: 'End',
				name: 'end',
				type: 'dateTime',
				default: '',
				description: 'New end date/time. For all-day events, the calendar date is used.',
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Start',
				name: 'start',
				type: 'dateTime',
				default: '',
				description: 'New start date/time. For all-day events, the calendar date is used.',
			},
			{
				displayName: 'Summary',
				name: 'summary',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Warsaw',
				description:
					'IANA timezone for timed events (e.g. Europe/Warsaw). Ignored for all-day events. Leave unset to keep the current timezone.',
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
		// Default 10 mirrors observed Nextcloud PROPFIND truncation (see roadmap S-08).
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit
		default: 10,
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
