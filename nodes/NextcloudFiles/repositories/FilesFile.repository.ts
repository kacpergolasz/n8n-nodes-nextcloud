/**
 * Repository for Nextcloud Files file resources (WebDAV).
 *
 * Reference: nodes/NextcloudFiles/context/api/documentation/openapi.md
 */
import type { FilesClient } from '../files.client';
import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	normalizeFilesPath,
} from '../shared/filesPaths';
import { parseEmpty, type Maybe } from '../../shared/apiResult';

export type UploadFileOptions = {
	uploadPath: string;
	body: Buffer;
	contentType: string;
};

export async function uploadFile(
	client: FilesClient,
	options: UploadFileOptions,
): Promise<Maybe<null>> {
	const uploadPath = normalizeFilesPath(options.uploadPath);
	const fileUrl = buildFilesUrl(client.baseUrl, client.username, uploadPath);
	return parseEmpty(
		await client.put(fileUrl, options.body, undefined, {
			'Content-Type': options.contentType,
		}, { json: false }),
	);
}

export type DownloadFileOptions = {
	sourcePath: string;
};

export async function downloadFile(
	client: FilesClient,
	options: DownloadFileOptions,
): Promise<Maybe<unknown>> {
	const sourcePath = normalizeFilesPath(options.sourcePath);
	const fileUrl = buildFilesUrl(client.baseUrl, client.username, sourcePath);
	return await client.get(fileUrl, undefined, {}, {
		json: false,
		encoding: 'arraybuffer',
	});
}

export type DeleteFileOptions = {
	sourcePath: string;
};

export async function deleteFile(
	client: FilesClient,
	options: DeleteFileOptions,
): Promise<Maybe<null>> {
	const sourcePath = normalizeFilesPath(options.sourcePath);
	const fileUrl = buildFilesUrl(client.baseUrl, client.username, sourcePath);
	return parseEmpty(await client.delete(fileUrl, undefined, undefined, { json: false }));
}

export type TransferFileOptions = {
	sourcePath: string;
	destinationPath: string;
	overwrite: boolean;
};

export async function moveFile(
	client: FilesClient,
	options: TransferFileOptions,
): Promise<Maybe<null>> {
	const sourcePath = normalizeFilesPath(options.sourcePath);
	const destinationPath = normalizeFilesPath(options.destinationPath);
	const sourceUrl = buildFilesUrl(client.baseUrl, client.username, sourcePath);
	return parseEmpty(
		await client.move(sourceUrl, {
			Destination: buildDestinationHeader(client.baseUrl, client.username, destinationPath),
			Overwrite: buildOverwriteHeader(options.overwrite),
		}),
	);
}

export async function copyFile(
	client: FilesClient,
	options: TransferFileOptions,
): Promise<Maybe<null>> {
	const sourcePath = normalizeFilesPath(options.sourcePath);
	const destinationPath = normalizeFilesPath(options.destinationPath);
	const sourceUrl = buildFilesUrl(client.baseUrl, client.username, sourcePath);
	return parseEmpty(
		await client.copy(sourceUrl, {
			Destination: buildDestinationHeader(client.baseUrl, client.username, destinationPath),
			Overwrite: buildOverwriteHeader(options.overwrite),
		}),
	);
}
