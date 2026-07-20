import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	getCredentials,
	loadDirectoryListing,
	normalizeFilesPath,
} from '../NextcloudFiles/GenericFunctions';
import type { DirectoryEntry, NextcloudCredentialData } from '../NextcloudFiles/FilesInterface';
import { scrubErrorMessage } from '../NextcloudFiles/shared/scrubSecrets';
import { getLastTimeChecked, seedLastTimeChecked } from '../shared/pollHelpers';

import {
	type DirectoryChange,
	type DirectoryChangeEvent,
	type DirectorySnapshot,
	classifyDirectoryChanges,
} from './classifyDirectoryChanges';

export const SNAPSHOT_KEY = 'snapshot';

function asLoadOptionsContext(context: IPollFunctions): ILoadOptionsFunctions {
	return context as unknown as ILoadOptionsFunctions;
}

export function resolveFolderToWatch(context: IPollFunctions): string {
	const locator = context.getNodeParameter('folderToWatch') as INodeParameterResourceLocator;
	const value = locator?.value;
	if (value === undefined || value === null || String(value).trim() === '') {
		throw new Error('Folder to Watch is required');
	}

	return normalizeFilesPath(String(value));
}

export function getSnapshot(staticData: IDataObject): DirectorySnapshot {
	const raw = staticData[SNAPSHOT_KEY];
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return {};
	}

	return raw as DirectorySnapshot;
}

export function setSnapshot(staticData: IDataObject, snapshot: DirectorySnapshot): void {
	staticData[SNAPSHOT_KEY] = snapshot as IDataObject;
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

function throwPollError(context: IPollFunctions, message: string): never {
	throw new NodeApiError(context.getNode(), { message } as JsonObject);
}

export async function runDirectoryPoll(
	context: IPollFunctions,
): Promise<INodeExecutionData[][] | null> {
	const staticData = context.getWorkflowStaticData('node');
	const isManual = context.getMode() === 'manual';
	const selectedEvents = context.getNodeParameter('event') as string[];
	const requestContext = asLoadOptionsContext(context);

	let credentials: NextcloudCredentialData;
	let folderPath: string;

	try {
		credentials = await getCredentials(requestContext);
		folderPath = resolveFolderToWatch(context);
	} catch (error) {
		throwPollError(context, scrubErrorMessage(error));
	}

	const isInitialized = getLastTimeChecked(staticData) !== undefined;

	let listing: DirectoryEntry[];
	try {
		listing = await loadDirectoryListing(requestContext, credentials, folderPath);
	} catch (error) {
		const scrubbedMessage = scrubErrorMessage(error, credentials);

		if (isInitialized) {
			context.logger.debug(
				`Nextcloud Files Trigger: listing failed after initialization; soft-failing poll (${scrubbedMessage})`,
			);
			return null;
		}

		throwPollError(context, scrubbedMessage);
	}

	if (isManual) {
		const sample = pickManualSample(listing, selectedEvents);
		if (!sample) {
			context.logger.debug(
				'Nextcloud Files Trigger: manual sample unavailable (empty folder or selected event types do not match). Returning null.',
			);
			return null;
		}

		const item = changeToOutputItem(sample);
		return [context.helpers.returnJsonArray([item])];
	}

	if (!isInitialized) {
		seedLastTimeChecked(staticData, Date.now());
		setSnapshot(staticData, buildSnapshotFromListing(listing));
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
