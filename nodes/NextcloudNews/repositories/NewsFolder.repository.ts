/**
 * Repository for the News Folder entity (External API v1-3).
 *
 * Reference: nodes/NextcloudNews/context/api/documentation/openapi.md (Folders)
 */
import { z } from 'zod';

import type { NewsClient } from '../news.client';
import { isPlainObject } from '../../shared/parse';
import { parseEmpty, parseWith, type Maybe } from '../../shared/apiResult';

export const newsFolderSchema = z.object({
	id: z.coerce.number().int().positive(),
	name: z.string(),
});

const newsFoldersListSchema = z.array(newsFolderSchema);

export type NewsFolder = z.infer<typeof newsFolderSchema>;

function parseFoldersList(result: Maybe<unknown>): Maybe<NewsFolder[]> {
	if (!result.success) {
		return result;
	}
	const raw =
		isPlainObject(result.response) && Array.isArray(result.response.folders)
			? result.response.folders
			: result.response;
	return parseWith({ success: true, response: raw }, newsFoldersListSchema);
}

export async function getFolders(client: NewsClient): Promise<Maybe<NewsFolder[]>> {
	return parseFoldersList(await client.get('/folders'));
}

export type CreateFolderOptions = {
	name: string;
};

export async function createFolder(
	client: NewsClient,
	options: CreateFolderOptions,
): Promise<Maybe<NewsFolder>> {
	const result = parseFoldersList(await client.post('/folders', { name: options.name }));
	if (!result.success) {
		return result;
	}
	const folder = result.response[0];
	if (!folder) {
		return { success: false, error: new Error('Folder create returned an empty response') };
	}
	return { success: true, response: folder };
}

export type RenameFolderOptions = {
	folderId: number;
	name: string;
};

export async function renameFolder(
	client: NewsClient,
	options: RenameFolderOptions,
): Promise<Maybe<NewsFolder | null>> {
	const result = await client.put(`/folders/${options.folderId}`, { name: options.name });
	if (!result.success) {
		return result;
	}
	if (result.response === undefined || result.response === null) {
		return { success: true, response: null };
	}
	const parsed = parseFoldersList(result);
	if (parsed.success) {
		return { success: true, response: parsed.response[0] ?? null };
	}
	const single = parseWith(result, newsFolderSchema);
	if (single.success) {
		return single;
	}
	return { success: true, response: null };
}

export type DeleteFolderOptions = {
	folderId: number;
};

export async function deleteFolder(
	client: NewsClient,
	options: DeleteFolderOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.delete(`/folders/${options.folderId}`));
}
