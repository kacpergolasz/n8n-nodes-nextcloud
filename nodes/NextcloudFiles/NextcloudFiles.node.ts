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
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	buildShareUpdateBody,
	contentTypeFromFileName,
	fileNameFromPath,
	getCredentials,
	loadDirectoryListing,
	nextcloudRequest,
	normalizeFilesPath,
	ocsRequest,
	parseShare,
	parseShareId,
	permissionsToBitmask,
	resolveUploadPath,
	validateSharePassword,
} from './GenericFunctions';
import { getFolders } from './listSearch/getFolders';
import { fileDescription } from './resources/file';
import { folderDescription } from './resources/folder';
import { shareDescription } from './resources/share';
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

				if (resource === 'share') {
					if (operation === 'create') {
						const sharePath = resolvePathFromInput(this, i);
						const shareType = this.getNodeParameter('shareType', i) as number;
						const shareWith = this.getNodeParameter('shareWith', i, '') as string;
						const permissions = permissionsToBitmask(
							this.getNodeParameter('permissions', i) as string[],
						);
						const password = this.getNodeParameter('password', i, '') as string;
						const expireDate = this.getNodeParameter('expireDate', i, '') as string;
						const publicUpload = this.getNodeParameter('publicUpload', i, false) as boolean;
						const note = this.getNodeParameter('note', i, '') as string;

						const body: IDataObject = {
							path: sharePath,
							shareType,
							permissions,
						};
						if (shareWith.trim()) body.shareWith = shareWith.trim();
						if (password.trim()) {
							const passwordPolicyError = await validateSharePassword(this, password);
							if (passwordPolicyError) {
								throw new NodeOperationError(this.getNode(), passwordPolicyError, {
									itemIndex: i,
								});
							}
							body.password = password.trim();
						}
						if (expireDate.trim()) body.expireDate = expireDate.trim();
						if (publicUpload) body.publicUpload = 'true';
						if (note.trim()) body.note = note.trim();

						const data = await ocsRequest(this, 'POST', 'shares', body);
						const share = parseShare(data);
						returnData.push({
							json: share as unknown as IDataObject,
							pairedItem: { item: i },
						});
					}

					if (operation === 'getAll') {
						const filterPath = this.getNodeParameter('filterPath', i, '') as string;
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = this.getNodeParameter('limit', i, 100) as number;
						const qs: IDataObject = {};
						if (filterPath.trim()) {
							qs.path = normalizeFilesPath(filterPath);
						}

						const data = await ocsRequest(this, 'GET', 'shares', undefined, qs);
						// OCS returns the full share list; limit is applied client-side.
						const rawShares = Array.isArray(data) ? data : data ? [data] : [];
						const shares = rawShares.map((entry) => parseShare(entry));
						const sliced = returnAll ? shares : shares.slice(0, limit);

						if (sliced.length === 0) {
							returnData.push({
								json: { empty: true },
								pairedItem: { item: i },
							});
						} else {
							for (const share of sliced) {
								returnData.push({
									json: share as unknown as IDataObject,
									pairedItem: { item: i },
								});
							}
						}
					}

					if (operation === 'update') {
						let shareId: number;
						try {
							shareId = parseShareId(this.getNodeParameter('shareId', i));
						} catch (error) {
							throw new NodeOperationError(this.getNode(), (error as Error).message, {
								itemIndex: i,
							});
						}

						const existingData = await ocsRequest(this, 'GET', `shares/${shareId}`);
						const existingShare = parseShare(existingData);

						const updateFields = this.getNodeParameter('updateFields', i, []) as string[];
						const updatePermissions = this.getNodeParameter('updatePermissions', i, []) as string[];
						const password = this.getNodeParameter('password', i, '') as string;
						const expireDate = this.getNodeParameter('expireDate', i, '') as string;
						const publicUpload = this.getNodeParameter('publicUpload', i, false) as boolean;

						let body: IDataObject;
						try {
							body = buildShareUpdateBody({
								fieldsToUpdate: updateFields,
								permissions: updatePermissions,
								password,
								expireDate,
								publicUpload,
								shareType: existingShare.shareType,
							});
						} catch (error) {
							throw new NodeOperationError(this.getNode(), (error as Error).message, {
								itemIndex: i,
							});
						}

						if (
							updateFields.includes('password') &&
							typeof body.password === 'string' &&
							body.password.length > 0
						) {
							const passwordPolicyError = await validateSharePassword(this, body.password);
							if (passwordPolicyError) {
								throw new NodeOperationError(this.getNode(), passwordPolicyError, {
									itemIndex: i,
								});
							}
						}

						const data = await ocsRequest(this, 'PUT', `shares/${shareId}`, body);
						const share = parseShare(data);
						returnData.push({
							json: share as unknown as IDataObject,
							pairedItem: { item: i },
						});
					}

					if (operation === 'delete') {
						let shareId: number;
						try {
							shareId = parseShareId(this.getNodeParameter('shareId', i));
						} catch (error) {
							throw new NodeOperationError(this.getNode(), (error as Error).message, {
								itemIndex: i,
							});
						}

						await ocsRequest(this, 'DELETE', `shares/${shareId}`);
						returnData.push({
							json: { shareId, deleted: true },
							pairedItem: { item: i },
						});
					}
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
