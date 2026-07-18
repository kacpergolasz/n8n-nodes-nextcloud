import type { INodeProperties } from 'n8n-workflow';

export const calendarSelect: INodeProperties = {
	displayName: 'Calendar',
	name: 'calendar',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description:
		'Use the calendar URI name (often the slug in Nextcloud URLs), not the display title — e.g. personal → …/dav/calendars/{username}/personal/. You may still paste a full /remote.php/dav/calendars/… path.',
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'getCalendars',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. personal',
		},
	],
};
