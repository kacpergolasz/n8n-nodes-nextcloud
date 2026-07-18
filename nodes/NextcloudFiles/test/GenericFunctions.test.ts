import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	normalizeFilesPath,
	parseDirectoryListingFromMultistatus,
	relativePathFromFilesHref,
} from '../GenericFunctions';

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
});
