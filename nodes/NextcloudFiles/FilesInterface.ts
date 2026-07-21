export type DirectoryEntry = {
	href: string;
	basename: string;
	path: string;
	isFolder: boolean;
	size?: number;
	lastModified?: string;
	contentType?: string;
	etag?: string;
};

export type FolderListOption = {
	name: string;
	value: string;
};

export type ParsedShare = {
	id: number;
	shareType: number;
	shareWith?: string;
	path: string;
	permissions: number;
	url?: string;
	token?: string;
	expiration?: string;
	note?: string;
	publicUpload?: boolean;
	uidOwner?: string;
	displaynameOwner?: string;
	itemType?: string;
	mimetype?: string;
};

export type OcsEnvelope<T = unknown> = {
	ocs: {
		meta: {
			status: string;
			statuscode: number;
			message?: string | null;
		};
		data: T;
	};
};
