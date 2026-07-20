import type { DirectoryEntry } from '../NextcloudFiles/FilesInterface';

export type DirectorySnapshotEntry = {
	etag?: string;
	lastModified?: string;
	isFolder: boolean;
};

/** Path-keyed snapshot of direct children from the last successful poll. */
export type DirectorySnapshot = Record<string, DirectorySnapshotEntry>;

export type DirectoryChangeEvent =
	| 'fileCreated'
	| 'fileUpdated'
	| 'folderCreated'
	| 'folderUpdated';

export type DirectoryChange = {
	event: DirectoryChangeEvent;
	entry: DirectoryEntry;
};

function hasEntryChanged(previous: DirectorySnapshotEntry, current: DirectoryEntry): boolean {
	const currentEtag = current.etag;
	const previousEtag = previous.etag;

	if (currentEtag !== undefined && previousEtag !== undefined) {
		return currentEtag !== previousEtag;
	}

	return (current.lastModified ?? '') !== (previous.lastModified ?? '');
}

function changeEventForEntry(
	entry: DirectoryEntry,
	kind: 'created' | 'updated',
): DirectoryChangeEvent {
	if (kind === 'created') {
		return entry.isFolder ? 'folderCreated' : 'fileCreated';
	}

	return entry.isFolder ? 'folderUpdated' : 'fileUpdated';
}

/**
 * Diff a previous directory snapshot against the current Depth-1 listing.
 * Emits create/update events only; removals are ignored (no delete events).
 */
export function classifyDirectoryChanges(
	previous: DirectorySnapshot,
	current: DirectoryEntry[],
): DirectoryChange[] {
	const changes: DirectoryChange[] = [];

	for (const entry of current) {
		const prior = previous[entry.path];

		if (prior === undefined) {
			changes.push({
				event: changeEventForEntry(entry, 'created'),
				entry,
			});
			continue;
		}

		if (hasEntryChanged(prior, entry)) {
			changes.push({
				event: changeEventForEntry(entry, 'updated'),
				entry,
			});
		}
	}

	return changes;
}
