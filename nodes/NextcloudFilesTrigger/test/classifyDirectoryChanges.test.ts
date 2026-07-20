import { parseDirectoryListingFromMultistatus } from '../../NextcloudFiles/GenericFunctions';
import type { DirectoryEntry } from '../../NextcloudFiles/FilesInterface';
import {
	classifyDirectoryChanges,
	type DirectoryChange,
	type DirectorySnapshot,
} from '../classifyDirectoryChanges';

const DIRECTORY_MULTISTATUS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:response>
    <d:href>/remote.php/dav/files/alice/Documents/</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"self"</d:getetag>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Documents/report%20file.pdf</d:href>
    <d:propstat>
      <d:prop>
        <d:getcontentlength>2048</d:getcontentlength>
        <d:getcontenttype>application/pdf</d:getcontenttype>
        <d:getlastmodified>Mon, 10 May 2026 09:00:00 GMT</d:getlastmodified>
        <d:getetag>"def456"</d:getetag>
        <d:resourcetype/>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Documents/Projects/</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"folder-etag"</d:getetag>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>
`;

function fileEntry(
	path: string,
	overrides: Partial<DirectoryEntry> = {},
): DirectoryEntry {
	const basename = path.split('/').pop() ?? path;

	return {
		href: `/remote.php/dav/files/alice${path}`,
		basename,
		path,
		isFolder: false,
		...overrides,
	};
}

function folderEntry(
	path: string,
	overrides: Partial<DirectoryEntry> = {},
): DirectoryEntry {
	const basename = path.split('/').filter(Boolean).pop() ?? path;

	return {
		href: `/remote.php/dav/files/alice${path}/`,
		basename,
		path,
		isFolder: true,
		...overrides,
	};
}

function snapshotFromEntries(entries: DirectoryEntry[]): DirectorySnapshot {
	return Object.fromEntries(
		entries.map((entry) => [
			entry.path,
			{
				etag: entry.etag,
				lastModified: entry.lastModified,
				isFolder: entry.isFolder,
			},
		]),
	);
}

function events(changes: DirectoryChange[]): DirectoryChange['event'][] {
	return changes.map((change) => change.event);
}

describe('classifyDirectoryChanges', () => {
	it('classifies all current entries as created when the snapshot is empty', () => {
		const current = [
			fileEntry('/Documents/report.pdf', { etag: '"a"' }),
			folderEntry('/Documents/Projects', { etag: '"b"' }),
		];

		const changes = classifyDirectoryChanges({}, current);

		expect(events(changes)).toEqual(['fileCreated', 'folderCreated']);
		expect(changes.map((change) => change.entry.path)).toEqual([
			'/Documents/report.pdf',
			'/Documents/Projects',
		]);
	});

	it('classifies etag changes as file or folder updated events', () => {
		const previous = snapshotFromEntries([
			fileEntry('/Documents/report.pdf', { etag: '"old-file"' }),
			folderEntry('/Documents/Projects', { etag: '"old-folder"' }),
		]);
		const current = [
			fileEntry('/Documents/report.pdf', { etag: '"new-file"' }),
			folderEntry('/Documents/Projects', { etag: '"new-folder"' }),
		];

		const changes = classifyDirectoryChanges(previous, current);

		expect(events(changes)).toEqual(['fileUpdated', 'folderUpdated']);
	});

	it('omits unchanged entries', () => {
		const unchanged = [
			fileEntry('/Documents/report.pdf', {
				etag: '"same"',
				lastModified: 'Mon, 10 May 2026 09:00:00 GMT',
			}),
			folderEntry('/Documents/Projects', { etag: '"folder"' }),
		];
		const previous = snapshotFromEntries(unchanged);

		expect(classifyDirectoryChanges(previous, unchanged)).toEqual([]);
	});

	it('falls back to lastModified when etag is missing on either side', () => {
		const previous = snapshotFromEntries([
			fileEntry('/Documents/report.pdf', { lastModified: 'Mon, 10 May 2026 09:00:00 GMT' }),
		]);

		const unchanged = [
			fileEntry('/Documents/report.pdf', { lastModified: 'Mon, 10 May 2026 09:00:00 GMT' }),
		];
		expect(classifyDirectoryChanges(previous, unchanged)).toEqual([]);

		const updated = [
			fileEntry('/Documents/report.pdf', { lastModified: 'Tue, 11 May 2026 09:00:00 GMT' }),
		];
		expect(events(classifyDirectoryChanges(previous, updated))).toEqual(['fileUpdated']);
	});

	it('handles mixed create, update, and unchanged batches', () => {
		const previous = snapshotFromEntries([
			fileEntry('/Documents/unchanged.pdf', { etag: '"same"' }),
			fileEntry('/Documents/stale.pdf', { etag: '"old"' }),
		]);
		const current = [
			fileEntry('/Documents/unchanged.pdf', { etag: '"same"' }),
			fileEntry('/Documents/stale.pdf', { etag: '"new"' }),
			fileEntry('/Documents/new.pdf', { etag: '"brand-new"' }),
			folderEntry('/Documents/new-folder', { etag: '"folder-new"' }),
		];

		const changes = classifyDirectoryChanges(previous, current);

		expect(events(changes)).toEqual(['fileUpdated', 'fileCreated', 'folderCreated']);
		expect(changes.map((change) => change.entry.path)).toEqual([
			'/Documents/stale.pdf',
			'/Documents/new.pdf',
			'/Documents/new-folder',
		]);
	});

	it('ignores entries removed from the listing (no delete events)', () => {
		const previous = snapshotFromEntries([
			fileEntry('/Documents/gone.pdf', { etag: '"gone"' }),
			fileEntry('/Documents/still-here.pdf', { etag: '"same"' }),
		]);
		const current = [fileEntry('/Documents/still-here.pdf', { etag: '"same"' })];

		expect(classifyDirectoryChanges(previous, current)).toEqual([]);
	});

	it('classifies parsed multistatus listings against an empty snapshot', () => {
		const entries = parseDirectoryListingFromMultistatus(
			DIRECTORY_MULTISTATUS_XML,
			'alice',
			'/Documents',
		);

		const changes = classifyDirectoryChanges({}, entries);

		expect(events(changes)).toEqual(['fileCreated', 'folderCreated']);
		expect(changes.map((change) => change.entry.basename)).toEqual([
			'report file.pdf',
			'Projects',
		]);
	});
});
