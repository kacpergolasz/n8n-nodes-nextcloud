import type {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { getFeeds } from './listSearch/getFeeds';
import { getFolders } from './listSearch/getFolders';
import { runNewsPoll } from './pollNews';

export class NextcloudNewsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud News Trigger',
		name: 'nextcloudNewsTrigger',
		icon: 'file:nextcloudNews.svg',
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{$parameter["unreadOnly"] ? "Unread articles" : "All articles"}}{{$parameter["feed"].value ? " · feed " + $parameter["feed"].value : ($parameter["folder"].value ? " · folder " + $parameter["folder"].value : "")}}',
		description:
			'Starts the workflow when new articles appear in Nextcloud News (optional folder/feed scope)',
		defaults: {
			name: 'Nextcloud News Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		polling: true,
		credentials: [{ name: 'nextcloudApi', required: true }],
		properties: [
			{
				displayName: 'Folder',
				name: 'folder',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description:
					'Optional News folder to watch. Leave empty to watch all folders (or narrow with Feed).',
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
						placeholder: 'e.g. 12',
					},
				],
			},
			{
				displayName: 'Feed',
				name: 'feed',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description:
					'Optional News feed to watch. When set, takes precedence over Folder. Leave empty for all feeds in scope.',
				typeOptions: {
					loadOptionsDependsOn: ['folder.value'],
				},
				modes: [
					// eslint-disable-next-line @n8n/community-nodes/require-param-default -- resourceLocator mode; default is on parent
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getFeeds',
							searchable: true,
						},
					},
					// eslint-disable-next-line @n8n/community-nodes/require-param-default -- resourceLocator mode; default is on parent
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 67',
					},
				],
			},
			{
				displayName: 'Unread Only',
				name: 'unreadOnly',
				type: 'boolean',
				default: true,
				description:
					'Whether to only watch unread articles (inbox-style). When off, newly seen article IDs still fire once. Each poll loads up to Page Size newest matches and catch-up-pages if a full page is all new (burst), capped by Max Pages Per Poll.',
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				default: 100,
				typeOptions: {
					minValue: 1,
				},
				description:
					'How many articles to request per News API page (batchSize). Larger values reduce requests but raise memory/latency per poll.',
			},
			{
				displayName: 'Max Pages Per Poll',
				name: 'maxPagesPerPoll',
				type: 'number',
				default: 5,
				typeOptions: {
					minValue: 1,
				},
				description:
					'Maximum pages walked toward older articles in one poll when catching up after a burst. Unfinished catch-up resumes on the next poll (no permanent skips).',
			},
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getFolders,
			getFeeds,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		return await runNewsPoll(this);
	}
}
