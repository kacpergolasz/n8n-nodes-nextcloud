import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	buildPathListSearchCacheKey,
	clearPathListSearchCache,
	directoryEntryToListOption,
	getCachedPathListOptions,
	matchesPathListFilter,
	normalizeFilesPath,
	paginatePathListOptions,
	parseDirectoryListingFromMultistatus,
	parentPath,
	relativePathFromFilesHref,
	resolvePathListSearchScope,
	resolveUploadPath,
	setCachedPathListOptions,
	sortDirectoryEntries,
} from '../GenericFunctions';
import type { DirectoryEntry } from '../FilesInterface';

const DIRECTORY_MULTISTATUS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:response>
    <d:href>/remote.php/dav/files/alice/Documents/</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"abc123"</d:getetag>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
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
    <d:href>/remote.php/dav/files/alice/Documents/unicode-%E6%97%A5%E6%9C%AC/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>
`;

describe('Nextcloud Files GenericFunctions', () => {
	it('buildFilesUrl encodes path segments individually', () => {
		expect(buildFilesUrl('https://cloud.example.com/', 'alice', '/Documents/report file.pdf')).toBe(
			'https://cloud.example.com/remote.php/dav/files/alice/Documents/report%20file.pdf',
		);
	});

	it('buildFilesUrl encodes username and nested unicode segments', () => {
		expect(
			buildFilesUrl('https://cloud.example.com', 'user@host.example', '/日本/notes.txt'),
		).toBe(
			'https://cloud.example.com/remote.php/dav/files/user%40host.example/%E6%97%A5%E6%9C%AC/notes.txt',
		);
	});

	it('buildFilesUrl handles root path without trailing slash', () => {
		expect(buildFilesUrl('https://cloud.example.com', 'alice', '/')).toBe(
			'https://cloud.example.com/remote.php/dav/files/alice',
		);
		expect(buildFilesUrl('https://cloud.example.com', 'alice', '')).toBe(
			'https://cloud.example.com/remote.php/dav/files/alice',
		);
	});

	it('buildDestinationHeader returns absolute encoded WebDAV URL', () => {
		expect(
			buildDestinationHeader('https://cloud.example.com', 'alice', '/Archive/moved file.txt'),
		).toBe('https://cloud.example.com/remote.php/dav/files/alice/Archive/moved%20file.txt');
	});

	it('buildOverwriteHeader maps boolean to T/F', () => {
		expect(buildOverwriteHeader(true)).toBe('T');
		expect(buildOverwriteHeader(false)).toBe('F');
	});

	it('relativePathFromFilesHref decodes user-relative paths', () => {
		expect(
			relativePathFromFilesHref('/remote.php/dav/files/alice/Documents/report.pdf', 'alice'),
		).toBe('/Documents/report.pdf');
		expect(
			relativePathFromFilesHref(
				'https://cloud.example.com/remote.php/dav/files/alice/日本/',
				'alice',
			),
		).toBe('/日本');
	});

	it('normalizeFilesPath standardizes leading slash and strips trailing slash', () => {
		expect(normalizeFilesPath('Documents/')).toBe('/Documents');
		expect(normalizeFilesPath('/')).toBe('/');
	});

	it('normalizeFilesPath rejects dot and parent-directory segments', () => {
		expect(() => normalizeFilesPath('/Documents/../Other')).toThrow(
			'Invalid path: "/Documents/../Other" contains "." or ".." segments',
		);
	});

	it('parses directory listing from multistatus XML fixture', () => {
		const entries = parseDirectoryListingFromMultistatus(
			DIRECTORY_MULTISTATUS_XML,
			'alice',
			'/Documents',
		);

		expect(entries).toEqual([
			{
				href: '/remote.php/dav/files/alice/Documents/report%20file.pdf',
				basename: 'report file.pdf',
				path: '/Documents/report file.pdf',
				isFolder: false,
				size: 2048,
				lastModified: 'Mon, 10 May 2026 09:00:00 GMT',
				contentType: 'application/pdf',
				etag: '"def456"',
			},
			{
				href: '/remote.php/dav/files/alice/Documents/unicode-%E6%97%A5%E6%9C%AC/',
				basename: 'unicode-日本',
				path: '/Documents/unicode-日本',
				isFolder: true,
				size: undefined,
				lastModified: undefined,
				contentType: undefined,
				etag: undefined,
			},
		]);
	});

	it('directoryEntryToListOption shows full path for nested entries', () => {
		expect(
			directoryEntryToListOption({
				href: '/remote.php/dav/files/alice/Documents/report.pdf',
				basename: 'report.pdf',
				path: '/Documents/report.pdf',
				isFolder: false,
			}),
		).toEqual({
			name: '📄 Documents/report.pdf',
			value: '/Documents/report.pdf',
		});
	});

	it('resolvePathListSearchScope limits file copy sources to files only', () => {
		expect(resolvePathListSearchScope('file', 'copy')).toEqual({
			includeFiles: true,
			includeFolders: false,
		});
		expect(resolvePathListSearchScope('folder', 'copy')).toEqual({
			includeFiles: false,
			includeFolders: true,
		});
	});

	it('matchesPathListFilter matches basename and full path', () => {
		expect(matchesPathListFilter('/Documents/report.pdf', 'report.pdf', 'report')).toBe(true);
		expect(matchesPathListFilter('/Documents/report.pdf', 'report.pdf', 'archive')).toBe(false);
	});

	it('resolveUploadPath writes alongside a selected file when the upload name differs', () => {
		expect(resolveUploadPath('/Documents/existing.pdf', 'newname.pdf')).toBe('/Documents/newname.pdf');
		expect(resolveUploadPath('/Documents/existing.pdf', 'existing.pdf')).toBe(
			'/Documents/existing.pdf',
		);
		expect(resolveUploadPath('/Documents', 'newname.pdf')).toBe('/Documents/newname.pdf');
		expect(resolveUploadPath('/', 'newname.pdf')).toBe('/newname.pdf');
	});

	it('parentPath returns the parent directory for nested paths', () => {
		expect(parentPath('/Documents/existing.pdf')).toBe('/Documents');
		expect(parentPath('/')).toBe('/');
	});

	it('path list search cache reuses collected options across pagination offsets', () => {
		clearPathListSearchCache();
		const credentials = {
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			appPassword: 'secret',
		};
		const cacheKey = buildPathListSearchCacheKey(credentials, 'file', 'upload', 'docs');
		const options = [
			{ name: '📁 Documents', value: '/Documents' },
			{ name: '📄 report.pdf', value: '/Documents/report.pdf' },
		];

		expect(getCachedPathListOptions(cacheKey)).toBeUndefined();
		setCachedPathListOptions(cacheKey, options);
		expect(getCachedPathListOptions(cacheKey)).toEqual(options);
	});

	it('paginatePathListOptions returns next offset token', () => {
		const entries = Array.from({ length: 3 }, (_, index) => ({
			name: `item-${index}`,
			value: `/item-${index}`,
		}));

		expect(paginatePathListOptions(entries, 0, 2)).toEqual({
			results: [
				{ name: 'item-0', value: '/item-0' },
				{ name: 'item-1', value: '/item-1' },
			],
			paginationToken: '2',
		});
		expect(paginatePathListOptions(entries, 2, 2)).toEqual({
			results: [{ name: 'item-2', value: '/item-2' }],
		});
	});

	it('sortDirectoryEntries lists folders before files and sorts by path', () => {
		const entries: DirectoryEntry[] = [
			{
				href: '/remote.php/dav/files/alice/z.txt',
				basename: 'z.txt',
				path: '/z.txt',
				isFolder: false,
			},
			{
				href: '/remote.php/dav/files/alice/Documents/',
				basename: 'Documents',
				path: '/Documents',
				isFolder: true,
			},
			{
				href: '/remote.php/dav/files/alice/a.txt',
				basename: 'a.txt',
				path: '/a.txt',
				isFolder: false,
			},
		];

		expect(sortDirectoryEntries(entries).map((entry) => entry.path)).toEqual([
			'/Documents',
			'/a.txt',
			'/z.txt',
		]);
	});
});
