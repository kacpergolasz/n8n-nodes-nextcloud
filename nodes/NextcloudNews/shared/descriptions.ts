import type { INodeProperties } from 'n8n-workflow';

/** Fresh folder resourceLocator — each call gets its own modes array (no shared references). */
export function createFolderSelect(overrides: Partial<INodeProperties> = {}): INodeProperties {
	return {
		displayName: 'Folder',
		name: 'folder',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'The News folder to operate on',
		required: true,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getFolders',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 12',
			},
		],
		...overrides,
	};
}

/** Feed picker; optionally reloads when a folder filter changes. */
export function createFeedSelect(overrides: Partial<INodeProperties> = {}): INodeProperties {
	const { typeOptions: overrideTypeOptions, ...rest } = overrides;
	return {
		displayName: 'Feed',
		name: 'feed',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'The News feed to operate on',
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['folderFilter.value'],
			...overrideTypeOptions,
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getFeeds',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 67',
			},
		],
		...rest,
	};
}
