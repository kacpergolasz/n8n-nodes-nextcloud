export interface NextcloudCredentialData {
	baseUrl: string;
	username: string;
	appPassword: string;
}

export interface NewsPickerOption {
	name: string;
	value: string;
}

export interface NewsFolder {
	id: number;
	name: string;
	[key: string]: unknown;
}

export interface NewsFeed {
	id: number;
	url: string;
	title: string;
	faviconLink?: string | null;
	added?: number;
	folderId?: number | null;
	unreadCount?: number;
	link?: string | null;
	pinned?: boolean;
	[key: string]: unknown;
}

export interface NewsItem {
	id: number;
	guid?: string;
	guidHash?: string;
	url?: string | null;
	title?: string | null;
	author?: string | null;
	pubDate?: number;
	body?: string | null;
	feedId?: number;
	unread?: boolean;
	starred?: boolean;
	lastModified?: number;
	[key: string]: unknown;
}

export type NewsFoldersResponse = {
	folders?: NewsFolder[];
};

export type NewsFeedsResponse = {
	feeds?: NewsFeed[];
	starredCount?: number;
	newestItemId?: number;
};

export type NewsItemsResponse = {
	items?: NewsItem[];
};
