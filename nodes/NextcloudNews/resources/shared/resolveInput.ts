import type { IExecuteFunctions } from 'n8n-workflow';

import { resolveFeedId, resolveFolderId } from '../../GenericFunctions';

/**
 * Read a resourceLocator value, coercing numeric expression results
 * (e.g. `={{ $json.id }}` → number) to string so string-typed By-ID modes
 * do not fail type validation.
 */
export function getLocatorValue(
	context: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
	fallback: string = '',
): string {
	const value = context.getNodeParameter(paramName, itemIndex, fallback, {
		extractValue: true,
		ensureType: 'string',
		// Numeric expression results (={{ $json.id }}) fail string-mode RLC
		// validation before ensureType can coerce — skip and coerce ourselves.
		skipValidation: true,
	});

	if (value === undefined || value === null) {
		return '';
	}

	return String(value);
}

export function resolveFolderFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName = 'folder',
): string {
	return resolveFolderId(getLocatorValue(context, paramName, itemIndex));
}

export function resolveFeedFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName = 'feed',
): string {
	return resolveFeedId(getLocatorValue(context, paramName, itemIndex));
}

/** Optional folder → API `folderId` (`null` = root). */
export function resolveOptionalFolderId(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName = 'folder',
): number | null {
	const raw = getLocatorValue(context, paramName, itemIndex, '');
	if (!raw.trim()) {
		return null;
	}

	const id = Number(resolveFolderId(raw));
	if (!Number.isFinite(id)) {
		throw new Error(`Folder id is invalid: ${raw}`);
	}
	return Math.trunc(id);
}

export function resolveOptionalFolderFilter(
	context: IExecuteFunctions,
	itemIndex: number,
): string | undefined {
	const raw = getLocatorValue(context, 'folderFilter', itemIndex, '');
	const value = raw.trim();
	return value || undefined;
}
