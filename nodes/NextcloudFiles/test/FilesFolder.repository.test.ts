import type { FilesClient } from '../files.client';
import {
	createFolder,
	listFolder,
	parseDirectoryListingFromMultistatus,
} from '../repositories/FilesFolder.repository';

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
</d:multistatus>
`;

describe('parseDirectoryListingFromMultistatus', () => {
	it('skips the parent self-response and normalizes children', () => {
		expect(parseDirectoryListingFromMultistatus(DIRECTORY_MULTISTATUS_XML, 'alice', '/Documents')).toEqual([
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
		]);
	});
});

describe('listFolder', () => {
	it('PROPFINDs the directory URL and returns parsed entries', async () => {
		const client = {
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			propfind: vi.fn(async () => ({
				success: true as const,
				response: DIRECTORY_MULTISTATUS_XML,
			})),
		};

		const result = await listFolder(client as unknown as FilesClient, {
			directoryPath: '/Documents',
		});

		expect(result).toEqual({
			success: true,
			response: [
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
			],
		});
		expect(client.propfind).toHaveBeenCalledWith(
			'https://cloud.example.com/remote.php/dav/files/alice/Documents',
			expect.stringContaining('d:propfind'),
			expect.objectContaining({ Depth: '1' }),
		);
	});

	it('passes through client failures', async () => {
		const client = {
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			propfind: vi.fn(async () => ({
				success: false as const,
				error: new Error('boom'),
			})),
		};

		const result = await listFolder(client as unknown as FilesClient, { directoryPath: '/' });
		expect(result).toEqual({ success: false, error: expect.any(Error) });
	});
});

describe('createFolder', () => {
	it('issues MKCOL against the folder URL', async () => {
		const client = {
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			mkcol: vi.fn(async () => ({ success: true as const, response: undefined })),
		};

		const result = await createFolder(client as unknown as FilesClient, {
			folderPath: '/Documents/New',
		});

		expect(result).toEqual({ success: true, response: null });
		expect(client.mkcol).toHaveBeenCalledWith(
			'https://cloud.example.com/remote.php/dav/files/alice/Documents/New',
		);
	});
});
