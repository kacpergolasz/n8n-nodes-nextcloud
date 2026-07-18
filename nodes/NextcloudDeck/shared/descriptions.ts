import type { INodeProperties } from 'n8n-workflow';

/** Fresh board resourceLocator — each call gets its own modes array (no shared references). */
export function createBoardSelect(overrides: Partial<INodeProperties> = {}): INodeProperties {
	return {
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
		...overrides,
	};
}

/** Stack picker; reloads when the selected board changes (board-dependent list). */
export function createStackSelect(overrides: Partial<INodeProperties> = {}): INodeProperties {
	const { typeOptions: overrideTypeOptions, ...rest } = overrides;
	return {
		displayName: 'Stack',
		name: 'stack',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'The Deck stack (column) the card is currently in',
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['board.value'],
			...overrideTypeOptions,
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getStacks',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 7',
			},
		],
		...rest,
	};
}
