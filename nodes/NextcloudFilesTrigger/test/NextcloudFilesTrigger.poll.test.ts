import type { IDataObject, INodeExecutionData, IPollFunctions } from 'n8n-workflow';

import {
	getCredentials,
	loadDirectoryListing,
} from '../../NextcloudFiles/GenericFunctions';
import type { DirectoryEntry, NextcloudCredentialData } from '../../NextcloudFiles/FilesInterface';
import { LAST_TIME_CHECKED_KEY } from '../../shared/pollHelpers';

import {
	WATCHED_FOLDER_KEY,
	buildSnapshotFromListing,
	getSnapshot,
	getWatchedFolder,
	runDirectoryPoll,
	SNAPSHOT_KEY,
} from '../pollDirectory';

vi.mock('../../NextcloudFiles/GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../NextcloudFiles/GenericFunctions')>();
	return {
		...actual,
		getCredentials: vi.fn(),
		loadDirectoryListing: vi.fn(),
	};
});

const CREDENTIALS: NextcloudCredentialData = {
	baseUrl: 'https://cloud.example.com',
	username: 'alice',
	appPassword: 'secret-token',
};

function fileEntry(path: string, overrides: Partial<DirectoryEntry> = {}): DirectoryEntry {
	const basename = path.split('/').pop() ?? path;

	return {
		href: `/remote.php/dav/files/alice${path}`,
		basename,
		path,
		isFolder: false,
		...overrides,
	};
}

function folderEntry(path: string, overrides: Partial<DirectoryEntry> = {}): DirectoryEntry {
	const basename = path.split('/').filter(Boolean).pop() ?? path;

	return {
		href: `/remote.php/dav/files/alice${path}/`,
		basename,
		path,
		isFolder: true,
		...overrides,
	};
}

type PollContextOptions = {
	mode?: 'manual' | 'trigger';
	staticData?: IDataObject;
	folderToWatch?: string;
	events?: string[];
};

function createPollContext(options: PollContextOptions = {}): IPollFunctions {
	const staticData = options.staticData ?? {};

	return {
		getMode: () => options.mode ?? 'trigger',
		getNodeParameter: (name: string) => {
			if (name === 'folderToWatch') {
				return { mode: 'id', value: options.folderToWatch ?? '/Documents' };
			}
			if (name === 'event') {
				return (
					options.events ?? ['fileCreated', 'fileUpdated', 'folderCreated', 'folderUpdated']
				);
			}
			throw new Error(`Unknown parameter: ${name}`);
		},
		getWorkflowStaticData: () => staticData,
		getNode: () => ({ name: 'Nextcloud Files Trigger', type: 'nextcloudFilesTrigger' }),
		helpers: {
			returnJsonArray: (items: IDataObject[]) =>
				items.map((json) => ({ json, pairedItem: { item: 0 } })),
		},
		logger: {
			debug: vi.fn(),
		},
	} as unknown as IPollFunctions;
}

function outputEvents(result: INodeExecutionData[][] | null): string[] {
	return (result?.[0] ?? []).map((item) => String(item.json.event));
}

function initializedStaticData(
	entries: DirectoryEntry[],
	folderPath = '/Documents',
): IDataObject {
	return {
		[LAST_TIME_CHECKED_KEY]: '2026-07-20T06:00:00.000Z',
		[SNAPSHOT_KEY]: buildSnapshotFromListing(entries),
		[WATCHED_FOLDER_KEY]: folderPath,
	};
}

describe('runDirectoryPoll', () => {
	beforeEach(() => {
		vi.mocked(getCredentials).mockResolvedValue(CREDENTIALS);
		vi.mocked(loadDirectoryListing).mockReset();
	});

	it('seeds snapshot, cursor, and watched folder on first poll with empty static data', async () => {
		const listing = [fileEntry('/Documents/existing.pdf', { etag: '"existing"' })];
		vi.mocked(loadDirectoryListing).mockResolvedValue(listing);

		const staticData: IDataObject = {};
		const result = await runDirectoryPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(staticData[LAST_TIME_CHECKED_KEY]).toBeDefined();
		expect(getSnapshot(staticData)).toEqual(buildSnapshotFromListing(listing));
		expect(getWatchedFolder(staticData)).toBe('/Documents');
		expect(loadDirectoryListing).toHaveBeenCalledWith(
			expect.anything(),
			CREDENTIALS,
			'/Documents',
		);
	});

	it('re-seeds without emitting when the watched folder changes', async () => {
		const photosListing = [
			fileEntry('/Photos/vacation.jpg', { etag: '"vacation"' }),
			fileEntry('/Photos/family.jpg', { etag: '"family"' }),
		];
		const staticData = initializedStaticData([
			fileEntry('/Documents/existing.pdf', { etag: '"existing"' }),
		]);

		vi.mocked(loadDirectoryListing).mockResolvedValue(photosListing);

		const result = await runDirectoryPoll(
			createPollContext({
				staticData,
				folderToWatch: '/Photos',
				events: ['fileCreated'],
			}),
		);

		expect(result).toBeNull();
		expect(getWatchedFolder(staticData)).toBe('/Photos');
		expect(getSnapshot(staticData)).toEqual(buildSnapshotFromListing(photosListing));
		expect(staticData[LAST_TIME_CHECKED_KEY]).toBeDefined();
	});

	it('re-seeds when cursor exists but snapshot is missing', async () => {
		const listing = [fileEntry('/Documents/existing.pdf', { etag: '"existing"' })];
		const staticData: IDataObject = {
			[LAST_TIME_CHECKED_KEY]: '2026-07-20T06:00:00.000Z',
			[WATCHED_FOLDER_KEY]: '/Documents',
		};

		vi.mocked(loadDirectoryListing).mockResolvedValue(listing);

		const result = await runDirectoryPoll(
			createPollContext({ staticData, events: ['fileCreated'] }),
		);

		expect(result).toBeNull();
		expect(getSnapshot(staticData)).toEqual(buildSnapshotFromListing(listing));
	});

	it('re-seeds when snapshot exists but cursor is missing', async () => {
		const listing = [fileEntry('/Documents/existing.pdf', { etag: '"existing"' })];
		const staticData: IDataObject = {
			[SNAPSHOT_KEY]: buildSnapshotFromListing([]),
			[WATCHED_FOLDER_KEY]: '/Documents',
		};

		vi.mocked(loadDirectoryListing).mockResolvedValue(listing);

		const result = await runDirectoryPoll(
			createPollContext({ staticData, events: ['fileCreated'] }),
		);

		expect(result).toBeNull();
		expect(staticData[LAST_TIME_CHECKED_KEY]).toBeDefined();
		expect(getSnapshot(staticData)).toEqual(buildSnapshotFromListing(listing));
	});

	it('re-seeds without emitting when snapshot entries are invalid', async () => {
		const listing = [
			fileEntry('/Documents/ok.pdf', { etag: '"ok"' }),
			fileEntry('/Documents/bad.pdf', { etag: '"bad"' }),
		];
		const staticData: IDataObject = {
			[LAST_TIME_CHECKED_KEY]: '2026-07-20T06:00:00.000Z',
			[WATCHED_FOLDER_KEY]: '/Documents',
			[SNAPSHOT_KEY]: {
				'/Documents/ok.pdf': { isFolder: false, etag: '"ok"' },
				// Legacy/corrupt: non-boolean isFolder must not classify as created.
				'/Documents/bad.pdf': { isFolder: 'false', etag: '"bad"' },
			},
		};

		vi.mocked(loadDirectoryListing).mockResolvedValue(listing);

		const result = await runDirectoryPoll(
			createPollContext({ staticData, events: ['fileCreated'] }),
		);

		expect(result).toBeNull();
		expect(getSnapshot(staticData)).toEqual(buildSnapshotFromListing(listing));
	});

	it('emits created events for new children after initialization', async () => {
		const existing = fileEntry('/Documents/existing.pdf', { etag: '"existing"' });
		const created = fileEntry('/Documents/new.pdf', { etag: '"new"' });
		const staticData = initializedStaticData([existing]);

		vi.mocked(loadDirectoryListing).mockResolvedValue([existing, created]);

		const result = await runDirectoryPoll(
			createPollContext({ staticData, events: ['fileCreated', 'folderCreated'] }),
		);

		expect(outputEvents(result)).toEqual(['fileCreated']);
		expect(result?.[0]?.[0]?.json).toMatchObject({
			event: 'fileCreated',
			path: '/Documents/new.pdf',
			basename: 'new.pdf',
			isFolder: false,
			etag: '"new"',
		});
	});

	it('emits updated events when etag changes', async () => {
		const staticData = initializedStaticData([
			fileEntry('/Documents/report.pdf', { etag: '"old"' }),
		]);

		vi.mocked(loadDirectoryListing).mockResolvedValue([
			fileEntry('/Documents/report.pdf', { etag: '"new"' }),
		]);

		const result = await runDirectoryPoll(
			createPollContext({ staticData, events: ['fileUpdated'] }),
		);

		expect(outputEvents(result)).toEqual(['fileUpdated']);
		expect(result?.[0]?.[0]?.json).toMatchObject({
			event: 'fileUpdated',
			path: '/Documents/report.pdf',
			etag: '"new"',
		});
	});

	it('returns null when the listing is unchanged', async () => {
		const unchanged = fileEntry('/Documents/report.pdf', {
			etag: '"same"',
			lastModified: 'Mon, 10 May 2026 09:00:00 GMT',
		});
		const staticData = initializedStaticData([unchanged]);

		vi.mocked(loadDirectoryListing).mockResolvedValue([unchanged]);

		const result = await runDirectoryPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(getSnapshot(staticData)).toEqual(buildSnapshotFromListing([unchanged]));
	});

	it('soft-fails and returns null when listing throws after initialization', async () => {
		const existing = fileEntry('/Documents/existing.pdf', { etag: '"existing"' });
		const priorSnapshot = buildSnapshotFromListing([existing]);
		const staticData = initializedStaticData([existing]);

		vi.mocked(loadDirectoryListing).mockRejectedValue(
			new Error('Request failed: secret-token'),
		);

		const context = createPollContext({ staticData });
		const result = await runDirectoryPoll(context);

		expect(result).toBeNull();
		expect(getSnapshot(staticData)).toEqual(priorSnapshot);
		expect(context.logger.debug).toHaveBeenCalledWith(
			expect.stringContaining('soft-failing poll'),
		);
		const debugMessage = String(vi.mocked(context.logger.debug).mock.calls[0]?.[0] ?? '');
		expect(debugMessage).not.toContain('secret-token');
		expect(debugMessage).toContain('[REDACTED]');
	});

	it('keeps prior snapshot when a successful listing is empty after initialization', async () => {
		const existing = fileEntry('/Documents/existing.pdf', { etag: '"existing"' });
		const priorSnapshot = buildSnapshotFromListing([existing]);
		const staticData = initializedStaticData([existing]);

		vi.mocked(loadDirectoryListing).mockResolvedValue([]);

		const context = createPollContext({ staticData });
		const result = await runDirectoryPoll(context);

		expect(result).toBeNull();
		expect(getSnapshot(staticData)).toEqual(priorSnapshot);
		expect(context.logger.debug).toHaveBeenCalledWith(
			expect.stringContaining('keeping prior snapshot'),
		);
	});

	it('returns null in manual mode when the folder listing is empty', async () => {
		vi.mocked(loadDirectoryListing).mockResolvedValue([]);

		await expect(runDirectoryPoll(createPollContext({ mode: 'manual' }))).resolves.toBeNull();
	});

	it('returns one sample item in manual mode', async () => {
		const listing = [
			fileEntry('/Documents/report.pdf', { etag: '"sample"' }),
			folderEntry('/Documents/Projects', { etag: '"folder"' }),
		];
		vi.mocked(loadDirectoryListing).mockResolvedValue(listing);

		const result = await runDirectoryPoll(
			createPollContext({ mode: 'manual', events: ['fileCreated'] }),
		);

		expect(result).toHaveLength(1);
		expect(result?.[0]).toHaveLength(1);
		expect(result?.[0]?.[0]?.json).toMatchObject({
			event: 'fileCreated',
			path: '/Documents/report.pdf',
			basename: 'report.pdf',
		});
	});

	it('filters emitted events by selected event options', async () => {
		const existing = fileEntry('/Documents/existing.pdf', { etag: '"existing"' });
		const newFile = fileEntry('/Documents/new.pdf', { etag: '"new-file"' });
		const newFolder = folderEntry('/Documents/NewFolder', { etag: '"new-folder"' });
		const staticData = initializedStaticData([existing]);

		vi.mocked(loadDirectoryListing).mockResolvedValue([existing, newFile, newFolder]);

		const result = await runDirectoryPoll(
			createPollContext({ staticData, events: ['fileCreated'] }),
		);

		expect(outputEvents(result)).toEqual(['fileCreated']);
	});
});

describe('getSnapshot', () => {
	it('drops entries with non-boolean isFolder and logs the drop count', () => {
		const logger = { debug: vi.fn() };
		const staticData: IDataObject = {
			[SNAPSHOT_KEY]: {
				'/Documents/ok.pdf': { isFolder: false, etag: '"ok"' },
				'/Documents/bad.pdf': { isFolder: 'false', etag: '"bad"' },
			},
		};

		expect(getSnapshot(staticData, logger)).toEqual({
			'/Documents/ok.pdf': { isFolder: false, etag: '"ok"' },
		});
		expect(logger.debug).toHaveBeenCalledWith(
			'Nextcloud Files Trigger: dropped 1 invalid snapshot entry (expected object with boolean isFolder).',
		);
	});

	it('drops non-object entries and logs a plural drop count', () => {
		const logger = { debug: vi.fn() };
		const staticData: IDataObject = {
			[SNAPSHOT_KEY]: {
				'/Documents/ok.pdf': { isFolder: false },
				'/Documents/string': 'not-an-entry',
				'/Documents/null': null,
			},
		};

		expect(getSnapshot(staticData, logger)).toEqual({
			'/Documents/ok.pdf': { isFolder: false },
		});
		expect(logger.debug).toHaveBeenCalledWith(
			'Nextcloud Files Trigger: dropped 2 invalid snapshot entries (expected object with boolean isFolder).',
		);
	});
});
