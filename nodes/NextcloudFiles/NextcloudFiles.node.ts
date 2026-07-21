import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { getCredentials } from './GenericFunctions';
import { getFolders } from './listSearch/getFolders';
import { fileDescription } from './resources/file';
import { fileCopy } from './resources/file/copy';
import { fileDelete } from './resources/file/delete';
import { fileDownload } from './resources/file/download';
import { fileMove } from './resources/file/move';
import type { FileOperationContext } from './resources/file/types';
import { fileUpload } from './resources/file/upload';
import { folderDescription } from './resources/folder';
import { folderCopy } from './resources/folder/copy';
import { folderCreate } from './resources/folder/create';
import { folderDelete } from './resources/folder/delete';
import { folderList } from './resources/folder/list';
import { folderMove } from './resources/folder/move';
import type { FolderOperationContext } from './resources/folder/types';
import { shareDescription } from './resources/share';
import { shareCreate } from './resources/share/create';
import { shareDelete } from './resources/share/delete';
import { shareGetAll } from './resources/share/getAll';
import { shareUpdate } from './resources/share/update';
import type { ShareOperationContext } from './resources/share/types';
import { getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';
import { nodeApiErrorPayload, parseRequiredString } from '../shared/parse';

export class NextcloudFiles implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Files',
		name: 'nextcloudFiles',
		icon: 'file:nextcloudFiles.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Upload, download, and manage files, folders, and shares in Nextcloud',
		defaults: {
			name: 'Nextcloud Files',
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
					{ name: 'File', value: 'file' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Share', value: 'share' },
				],
				default: 'file',
			},
			...fileDescription,
			...folderDescription,
			...shareDescription,
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getFolders,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await getCredentials(this);

		for (let i = 0; i < items.length; i++) {
			const outputCountBefore = returnData.length;
			try {
				const resource = parseRequiredString(this.getNodeParameter('resource', i), 'Resource');
				const operation = parseRequiredString(this.getNodeParameter('operation', i), 'Operation');

				if (resource === 'file') {
					const opCtx: FileOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'upload':
							returnData.push(await fileUpload(this, opCtx));
							break;
						case 'download':
							returnData.push(await fileDownload(this, opCtx));
							break;
						case 'delete':
							returnData.push(await fileDelete(this, opCtx));
							break;
						case 'move':
							returnData.push(await fileMove(this, opCtx));
							break;
						case 'copy':
							returnData.push(await fileCopy(this, opCtx));
							break;
					}
				} else if (resource === 'folder') {
					const opCtx: FolderOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'create':
							returnData.push(await folderCreate(this, opCtx));
							break;
						case 'delete':
							returnData.push(await folderDelete(this, opCtx));
							break;
						case 'list':
							returnData.push(...(await folderList(this, opCtx)));
							break;
						case 'move':
							returnData.push(await folderMove(this, opCtx));
							break;
						case 'copy':
							returnData.push(await folderCopy(this, opCtx));
							break;
					}
				} else if (resource === 'share') {
					const opCtx: ShareOperationContext = { itemIndex: i, credentials };
					switch (operation) {
						case 'create':
							returnData.push(await shareCreate(this, opCtx));
							break;
						case 'getAll':
							returnData.push(...(await shareGetAll(this, opCtx)));
							break;
						case 'update':
							returnData.push(await shareUpdate(this, opCtx));
							break;
						case 'delete':
							returnData.push(await shareDelete(this, opCtx));
							break;
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}

				if (returnData.length === outputCountBefore) {
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
				const message =
					statusCode === 404 ? 'Resource not found (404)' : scrubbedMessage;

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
					nodeApiErrorPayload(
						message,
						statusCode !== undefined ? { httpCode: statusCode } : undefined,
					),
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
