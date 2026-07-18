export interface NextcloudCredentialData {
	baseUrl: string;
	username: string;
	appPassword: string;
}

export interface DirectoryEntry {
	href: string;
	basename: string;
	path: string;
	isFolder: boolean;
	size?: number;
	lastModified?: string;
	contentType?: string;
	etag?: string;
}

export interface FolderListOption {
	name: string;
	value: string;
}
