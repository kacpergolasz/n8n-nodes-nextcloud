import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { getCredentials } from './GenericFunctions';
import { nodeApiErrorPayload, parseRequiredString } from '../shared/parse';
import { getFeeds } from './listSearch/getFeeds';
import { getFolders } from './listSearch/getFolders';
import { feedDescription } from './resources/feed';
import { feedCreate } from './resources/feed/create';
import { feedDelete } from './resources/feed/delete';
import { feedFavicon } from './resources/feed/favicon';
import { feedGetAll } from './resources/feed/getAll';
import { feedMarkRead } from './resources/feed/markRead';
import { feedMove } from './resources/feed/move';
import { feedRename } from './resources/feed/rename';
import type { FeedOperationContext } from './resources/feed/types';
import { folderDescription } from './resources/folder';
import { folderCreate } from './resources/folder/create';
import { folderDelete } from './resources/folder/delete';
import { folderGetAll } from './resources/folder/getAll';
import { folderRename } from './resources/folder/rename';
import type { FolderOperationContext } from './resources/folder/types';
import { itemDescription } from './resources/item';
import { itemGetAll } from './resources/item/getAll';
import { itemMarkAction } from './resources/item/markAction';
import { itemMarkMultiple } from './resources/item/markMultiple';
import type { ItemOperationContext } from './resources/item/types';
import { formatNewsAccessErrorMessage, getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';

export class NextcloudNews implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud News',
		name: 'nextcloudNews',
		icon: { light: 'file:nextcloudNews.svg', dark: 'file:nextcloudNews.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Automate Nextcloud News folders, feeds, and items',
		defaults: {
			name: 'Nextcloud News',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nextcloudApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Feed', value: 'feed' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Item', value: 'item' },
				],
				default: 'item',
			},
			...feedDescription,
			...folderDescription,
			...itemDescription,
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getFolders,
			getFeeds,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await getCredentials(this);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = parseRequiredString(this.getNodeParameter('resource', i), 'Resource');
				const operation = parseRequiredString(this.getNodeParameter('operation', i), 'Operation');
				let handled = false;

				if (resource === 'folder') {
					const opCtx: FolderOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'create':
							returnData.push(await folderCreate(this, opCtx));
							handled = true;
							break;
						case 'getAll':
							returnData.push(...(await folderGetAll(this, opCtx)));
							handled = true;
							break;
						case 'rename':
							returnData.push(await folderRename(this, opCtx));
							handled = true;
							break;
						case 'delete':
							returnData.push(await folderDelete(this, opCtx));
							handled = true;
							break;
					}
				} else if (resource === 'feed') {
					const opCtx: FeedOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'create':
							returnData.push(await feedCreate(this, opCtx));
							handled = true;
							break;
						case 'getAll':
							returnData.push(...(await feedGetAll(this, opCtx)));
							handled = true;
							break;
						case 'delete':
							returnData.push(await feedDelete(this, opCtx));
							handled = true;
							break;
						case 'move':
							returnData.push(await feedMove(this, opCtx));
							handled = true;
							break;
						case 'rename':
							returnData.push(await feedRename(this, opCtx));
							handled = true;
							break;
						case 'markRead':
							returnData.push(await feedMarkRead(this, opCtx));
							handled = true;
							break;
						case 'favicon':
							returnData.push(await feedFavicon(this, opCtx));
							handled = true;
							break;
					}
				} else if (resource === 'item') {
					const opCtx: ItemOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'getAll':
							returnData.push(...(await itemGetAll(this, opCtx)));
							handled = true;
							break;
						case 'markRead':
							returnData.push(await itemMarkAction(this, opCtx, 'read'));
							handled = true;
							break;
						case 'markUnread':
							returnData.push(await itemMarkAction(this, opCtx, 'unread'));
							handled = true;
							break;
						case 'star':
							returnData.push(await itemMarkAction(this, opCtx, 'star'));
							handled = true;
							break;
						case 'unstar':
							returnData.push(await itemMarkAction(this, opCtx, 'unstar'));
							handled = true;
							break;
						case 'markReadMultiple':
							returnData.push(await itemMarkMultiple(this, opCtx, 'read'));
							handled = true;
							break;
						case 'markUnreadMultiple':
							returnData.push(await itemMarkMultiple(this, opCtx, 'unread'));
							handled = true;
							break;
						case 'starMultiple':
							returnData.push(await itemMarkMultiple(this, opCtx, 'star'));
							handled = true;
							break;
						case 'unstarMultiple':
							returnData.push(await itemMarkMultiple(this, opCtx, 'unstar'));
							handled = true;
							break;
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}

				if (!handled) {
					throw new NodeOperationError(
						this.getNode(),
						`The resource "${resource}" with operation "${operation}" is not supported.`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				const statusCode = getHttpStatusCode(error);
				const scrubbedMessage = scrubErrorMessage(error, {
					appPassword: credentials.appPassword,
					username: credentials.username,
				});
				const message = formatNewsAccessErrorMessage(statusCode, scrubbedMessage);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: message,
							...(statusCode !== undefined ? { statusCode } : {}),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(
					this.getNode(),
					nodeApiErrorPayload(message, statusCode !== undefined ? { httpCode: statusCode } : undefined),
					{
						itemIndex: i,
						...(statusCode !== undefined ? { httpCode: String(statusCode) } : {}),
					},
				);
			}
		}

		return [returnData];
	}
}
