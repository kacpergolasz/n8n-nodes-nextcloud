import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	IPollFunctions,
} from 'n8n-workflow';

import {
	getCredentials,
	loadDirectoryListing,
	normalizeFilesPath,
} from '../NextcloudFiles/GenericFunctions';
import type { DirectoryEntry } from '../NextcloudFiles/FilesInterface';
import { scrubErrorMessage } from '../NextcloudFiles/shared/scrubSecrets';
import { isPlainObject, parseStringArray } from '../shared/parse';
import { LAST_TIME_CHECKED_KEY, getLastTimeChecked } from '../shared/pollHelpers';
import {
	handlePollListingFailure,
	returnManualSampleOrNull,
	runPollBootstrap,
} from '../shared/pollOrchestration';
import { parseLocatorParamValue } from '../NextcloudFiles/resources/shared/resolveInput';

import {
	type DirectoryChange,
	type DirectoryChangeEvent,
	type DirectorySnapshot,
	classifyDirectoryChanges,
} from './classifyDirectoryChanges';

export const SNAPSHOT_KEY = 'snapshot';
/** Normalized path of the folder the current snapshot was seeded for. */
export const WATCHED_FOLDER_KEY = 'watchedFolder';

function asLoadOptionsContext(context: IPollFunctions): ILoadOptionsFunctions {
	return context as unknown as ILoadOptionsFunctions;
}

export function resolveFolderToWatch(context: IPollFunctions): string {
	const raw = context.getNodeParameter('folderToWatch', undefined);
	const value = parseLocatorParamValue(raw);
	if (!value) {
		throw new Error('Folder to Watch is required');
	}

	return normalizeFilesPath(value);
}

export function hasSnapshot(staticData: IDataObject): boolean {
	const raw = staticData[SNAPSHOT_KEY];
	return raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw);
}

export function getSnapshot(staticData: IDataObject): DirectorySnapshot {
	const raw = staticData[SNAPSHOT_KEY];
	if (!isPlainObject(raw)) {
		return {};
	}

	const snapshot: DirectorySnapshot = {};
	for (const [path, entry] of Object.entries(raw)) {
		if (!isPlainObject(entry)) continue;
		const isFolder = entry['isFolder'];
		if (typeof isFolder !== 'boolean') continue;
		const etag = entry['etag'];
		const lastModified = entry['lastModified'];
		snapshot[path] = {
			isFolder,
			...(typeof etag === 'string' ? { etag } : {}),
			...(typeof lastModified === 'string' ? { lastModified } : {}),
		};
	}
	return snapshot;
}

export function setSnapshot(staticData: IDataObject, snapshot: DirectorySnapshot): void {
	const record: IDataObject = {};
	for (const [path, entry] of Object.entries(snapshot)) {
		const snapshotEntry: IDataObject = {
			isFolder: entry.isFolder,
			...(entry.etag !== undefined ? { etag: entry.etag } : {}),
			...(entry.lastModified !== undefined ? { lastModified: entry.lastModified } : {}),
		};
		record[path] = snapshotEntry;
	}
	staticData[SNAPSHOT_KEY] = record;
}

export function getWatchedFolder(staticData: IDataObject): string | undefined {
	const value = staticData[WATCHED_FOLDER_KEY];
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	return String(value);
}

/**
 * Initialized only when cursor, snapshot, and watched-folder path all match the
 * current poll target. Missing any piece (or a folder change) triggers re-seed.
 */
export function isDirectoryPollInitialized(
	staticData: IDataObject,
	folderPath: string,
): boolean {
	return (
		getLastTimeChecked(staticData) !== undefined &&
		hasSnapshot(staticData) &&
		getWatchedFolder(staticData) === folderPath
	);
}

export function seedDirectoryPollState(
	staticData: IDataObject,
	folderPath: string,
	listing: DirectoryEntry[],
	now: number = Date.now(),
): void {
	staticData[LAST_TIME_CHECKED_KEY] = new Date(now).toISOString();
	setSnapshot(staticData, buildSnapshotFromListing(listing));
	staticData[WATCHED_FOLDER_KEY] = folderPath;
}

export function buildSnapshotFromListing(entries: DirectoryEntry[]): DirectorySnapshot {
	const snapshot: DirectorySnapshot = {};

	for (const entry of entries) {
		snapshot[entry.path] = {
			etag: entry.etag,
			lastModified: entry.lastModified,
			isFolder: entry.isFolder,
		};
	}

	return snapshot;
}

export function changeToOutputItem(change: DirectoryChange): IDataObject {
	const { event, entry } = change;

	return {
		event,
		path: entry.path,
		basename: entry.basename,
		isFolder: entry.isFolder,
		etag: entry.etag,
		lastModified: entry.lastModified,
		href: entry.href,
		size: entry.size,
		contentType: entry.contentType,
	};
}

function pickManualSample(
	listing: DirectoryEntry[],
	selectedEvents: string[],
): DirectoryChange | undefined {
	// Manual mode is used for "Test step" UX. If the folder is empty (or the
	// selected event types don't match any entry type), returning `null` is
	// safer than throwing — otherwise the error can destabilize polling.
	for (const entry of listing) {
		const createdEvent: DirectoryChangeEvent = entry.isFolder
			? 'folderCreated'
			: 'fileCreated';
		if (selectedEvents.includes(createdEvent)) {
			return { event: createdEvent, entry };
		}

		const updatedEvent: DirectoryChangeEvent = entry.isFolder
			? 'folderUpdated'
			: 'fileUpdated';
		if (selectedEvents.includes(updatedEvent)) {
			return { event: updatedEvent, entry };
		}
	}

	return undefined;
}

export async function runDirectoryPoll(
	context: IPollFunctions,
): Promise<INodeExecutionData[][] | null> {
	const staticData = context.getWorkflowStaticData('node');
	const isManual = context.getMode() === 'manual';
	const selectedEvents = parseStringArray(context.getNodeParameter('event'), 'Events');
	const requestContext = asLoadOptionsContext(context);

	const { credentials, folderPath } = await runPollBootstrap(
		context,
		async () => {
			const credentials = await getCredentials(requestContext);
			const folderPath = resolveFolderToWatch(context);
			return { credentials, folderPath };
		},
		(error) => scrubErrorMessage(error),
	);

	const isInitialized = isDirectoryPollInitialized(staticData, folderPath);

	let listing: DirectoryEntry[];
	try {
		listing = await loadDirectoryListing(requestContext, credentials, folderPath);
	} catch (error) {
		return handlePollListingFailure(context, {
			isInitialized,
			error,
			scrubError: (err) => scrubErrorMessage(err, credentials),
			logLabel: 'Nextcloud Files Trigger',
			softFail: { mode: 'silent' },
		});
	}

	if (isManual) {
		const sample = pickManualSample(listing, selectedEvents);
		return returnManualSampleOrNull(
			context,
			sample ? changeToOutputItem(sample) : undefined,
			'Nextcloud Files Trigger: manual sample unavailable (empty folder or selected event types do not match). Returning null.',
		);
	}

	if (!isInitialized) {
		seedDirectoryPollState(staticData, folderPath, listing);
		return null;
	}

	const priorSnapshot = getSnapshot(staticData);
	const priorCount = Object.keys(priorSnapshot).length;

	// A successful empty listing after we already tracked children is suspicious
	// (transient parse/HTTP quirks). Advancing to {} would make the next real
	// listing emit every child as created. Soft-fail: keep prior snapshot.
	if (priorCount > 0 && listing.length === 0) {
		context.logger.debug(
			`Nextcloud Files Trigger: empty listing after ${priorCount} known children; keeping prior snapshot (soft-fail).`,
		);
		return null;
	}

	const changes = classifyDirectoryChanges(priorSnapshot, listing);
	const filtered = changes.filter((change) => selectedEvents.includes(change.event));

	setSnapshot(staticData, buildSnapshotFromListing(listing));

	if (filtered.length === 0) {
		return null;
	}

	return [context.helpers.returnJsonArray(filtered.map(changeToOutputItem))];
}
