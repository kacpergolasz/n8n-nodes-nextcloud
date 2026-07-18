import type { INodeProperties } from 'n8n-workflow';

export const boardSelect: INodeProperties = {
	displayName: 'Board',
	name: 'board',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description: 'The Deck board to operate on',
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'getBoards',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 42',
		},
	],
};
