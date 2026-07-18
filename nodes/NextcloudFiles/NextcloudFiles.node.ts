import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	contentTypeFromFileName,
	fileNameFromPath,
	getCredentials,
	loadDirectoryListing,
	nextcloudRequest,
	normalizeFilesPath,
	resolveUploadPath,
} from './GenericFunctions';
import { getFolders } from './listSearch/getFolders';
import { fileDescription } from './resources/file';
import { folderDescription } from './resources/folder';
import { getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';

function resolvePathFromInput(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	itemIndex: number,
): string {
	const locator = context.getNodeParameter('path', itemIndex) as INodeParameterResourceLocator;
	return normalizeFilesPath(locator.value as string);
}

export class NextcloudFiles implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Files',
		name: 'nextcloudFiles',
		icon: 'file:nextcloudFiles.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Upload, download, and manage files and folders in Nextcloud via WebDAV',
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
				],
				default: 'file',
			},
			...fileDescription,
			...folderDescription,
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
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'file') {
					if (operation === 'upload') {
						const targetPath = resolvePathFromInput(this, i);
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const fileNameParam = this.getNodeParameter('fileName', i, '') as string;
						const inputItem = items[i];
						const binaryMeta = inputItem.binary?.[binaryPropertyName];
						const resolvedFileName =
							fileNameParam.trim() ||
							binaryMeta?.fileName ||
							`upload-${Date.now()}`;
						const uploadPath = resolveUploadPath(targetPath, resolvedFileName);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						const mimeType = binaryMeta?.mimeType ?? contentTypeFromFileName(resolvedFileName);
						const fileUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							uploadPath,
						);

						await nextcloudRequest(this, 'PUT', fileUrl, buffer, {
							'Content-Type': mimeType,
						});

						returnData.push({
							json: {
								path: uploadPath,
								fileName: fileNameFromPath(uploadPath),
								uploaded: true,
							},
							pairedItem: { item: i },
						});
					}

					if (operation === 'download') {
						const sourcePath = resolvePathFromInput(this, i);
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const fileUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							sourcePath,
						);
						const response = await nextcloudRequest(
							this,
							'GET',
							fileUrl,
							undefined,
							{},
							{ encoding: 'arraybuffer' },
						);
						const buffer = Buffer.from(response as ArrayBuffer);
						const fileName = fileNameFromPath(sourcePath);
						const mimeType = contentTypeFromFileName(fileName);
						const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, mimeType);

						returnData.push({
							json: {
								path: sourcePath,
								fileName,
								downloaded: true,
							},
							binary: {
								[binaryPropertyName]: binaryData,
							},
							pairedItem: { item: i },
						});
					}

					if (operation === 'delete') {
						const sourcePath = resolvePathFromInput(this, i);
						const fileUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							sourcePath,
						);
						await nextcloudRequest(this, 'DELETE', fileUrl);
						returnData.push({
							json: { path: sourcePath, deleted: true },
							pairedItem: { item: i },
						});
					}

					if (operation === 'move' || operation === 'copy') {
						const sourcePath = resolvePathFromInput(this, i);
						const destinationPath = normalizeFilesPath(
							this.getNodeParameter('destinationPath', i) as string,
						);
						const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;
						const sourceUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							sourcePath,
						);
						const method = operation === 'move' ? 'MOVE' : 'COPY';
						await nextcloudRequest(this, method, sourceUrl, undefined, {
							Destination: buildDestinationHeader(
								credentials.baseUrl,
								credentials.username,
								destinationPath,
							),
							Overwrite: buildOverwriteHeader(overwrite),
						});
						returnData.push({
							json: {
								path: sourcePath,
								destinationPath,
								[operation === 'move' ? 'moved' : 'copied']: true,
							},
							pairedItem: { item: i },
						});
					}
				}

				if (resource === 'folder') {
					const folderPath = resolvePathFromInput(this, i);

					if (operation === 'create') {
						const folderUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							folderPath,
						);
						await nextcloudRequest(this, 'MKCOL', folderUrl);
						returnData.push({
							json: { path: folderPath, created: true },
							pairedItem: { item: i },
						});
					}

					if (operation === 'delete') {
						const folderUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							folderPath,
						);
						await nextcloudRequest(this, 'DELETE', folderUrl);
						returnData.push({
							json: { path: folderPath, deleted: true },
							pairedItem: { item: i },
						});
					}

					if (operation === 'list') {
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = this.getNodeParameter('limit', i, 100) as number;
						const entries = await loadDirectoryListing(this, credentials, folderPath);
						const sliced = returnAll ? entries : entries.slice(0, limit);

						if (sliced.length === 0) {
							returnData.push({
								json: { path: folderPath, empty: true },
								pairedItem: { item: i },
							});
						} else {
							for (const entry of sliced) {
								returnData.push({
									json: entry as unknown as IDataObject,
									pairedItem: { item: i },
								});
							}
						}
					}

					if (operation === 'move' || operation === 'copy') {
						const destinationPath = normalizeFilesPath(
							this.getNodeParameter('destinationPath', i) as string,
						);
						const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;
						const sourceUrl = buildFilesUrl(
							credentials.baseUrl,
							credentials.username,
							folderPath,
						);
						const method = operation === 'move' ? 'MOVE' : 'COPY';
						await nextcloudRequest(this, method, sourceUrl, undefined, {
							Destination: buildDestinationHeader(
								credentials.baseUrl,
								credentials.username,
								destinationPath,
							),
							Overwrite: buildOverwriteHeader(overwrite),
						});
						returnData.push({
							json: {
								path: folderPath,
								destinationPath,
								[operation === 'move' ? 'moved' : 'copied']: true,
							},
							pairedItem: { item: i },
						});
					}
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
					{ message, ...(statusCode !== undefined ? { httpCode: statusCode } : {}) } as JsonObject,
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
