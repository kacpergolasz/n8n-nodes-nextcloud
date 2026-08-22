import type { FilesClient } from '../files.client';
import { downloadFile, uploadFile } from '../repositories/FilesFile.repository';

describe('uploadFile', () => {
	it('PUTs the buffer to the encoded WebDAV URL', async () => {
		const body = Buffer.from('hello');
		const client = {
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			put: vi.fn(async () => ({ success: true as const, response: undefined })),
		};

		const result = await uploadFile(client as unknown as FilesClient, {
			uploadPath: '/Documents/hello world.txt',
			body,
			contentType: 'text/plain',
		});

		expect(result).toEqual({ success: true, response: null });
		expect(client.put).toHaveBeenCalledWith(
			'https://cloud.example.com/remote.php/dav/files/alice/Documents/hello%20world.txt',
			body,
			undefined,
			{ 'Content-Type': 'text/plain' },
			{ json: false },
		);
	});
});

describe('downloadFile', () => {
	it('GETs with arraybuffer encoding', async () => {
		const bytes = Buffer.from([1, 2, 3]);
		const client = {
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			get: vi.fn(async () => ({ success: true as const, response: bytes })),
		};

		const result = await downloadFile(client as unknown as FilesClient, {
			sourcePath: '/Documents/a.bin',
		});

		expect(result).toEqual({ success: true, response: bytes });
		expect(client.get).toHaveBeenCalledWith(
			'https://cloud.example.com/remote.php/dav/files/alice/Documents/a.bin',
			undefined,
			{},
			{ json: false, encoding: 'arraybuffer' },
		);
	});
});
