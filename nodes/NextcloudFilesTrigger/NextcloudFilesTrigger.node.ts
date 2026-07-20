import type {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { getFolders } from './listSearch/getFolders';

export class NextcloudFilesTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Files Trigger',
		name: 'nextcloudFilesTrigger',
		icon: 'file:nextcloudFiles.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["folderToWatch"].value || "Select folder"}}',
		description:
			'Starts the workflow when files or folders are created or updated in a Nextcloud folder',
		defaults: {
			name: 'Nextcloud Files Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		polling: true,
		credentials: [{ name: 'nextcloudApi', required: true }],
		properties: [
			{
				displayName: 'Folder to Watch',
				name: 'folderToWatch',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description:
					'Folder whose immediate children are watched for create and update events — e.g. /Documents',
				required: true,
				modes: [
					// eslint-disable-next-line @n8n/community-nodes/require-param-default -- resourceLocator mode; default is on parent
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getFolders',
							searchable: true,
						},
					},
					// eslint-disable-next-line @n8n/community-nodes/require-param-default -- resourceLocator mode; default is on parent
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. /Documents',
					},
				],
			},
			{
				displayName:
					'Only direct children of the watched folder are detected. Changes in subfolders are not watched.',
				name: 'depthNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'event',
				type: 'multiOptions',
				options: [
					{ name: 'File Created', value: 'fileCreated' },
					{ name: 'File Updated', value: 'fileUpdated' },
					{ name: 'Folder Created', value: 'folderCreated' },
					{ name: 'Folder Updated', value: 'folderUpdated' },
				],
				default: ['fileCreated', 'fileUpdated'],
				description: 'Which create and update events should trigger the workflow',
			},
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getFolders,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		return null;
	}
}
