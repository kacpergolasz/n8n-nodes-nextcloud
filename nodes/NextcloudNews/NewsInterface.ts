export type NewsPickerOption = {
	name: string;
	value: string;
};

export type NewsFolder = {
	id: number;
	name: string;
};

export type NewsFeed = {
	id: number;
	url: string;
	title: string;
	faviconLink?: string | null;
	added?: number | null;
	folderId?: number | null;
	unreadCount?: number | null;
	nextUpdateTime?: number | null;
	link?: string | null;
	pinned?: boolean;
};

export type NewsItem = {
	id: number;
	guid?: string;
	guidHash?: string;
	url?: string | null;
	title?: string | null;
	author?: string | null;
	pubDate?: number | null;
	body?: string | null;
	feedId?: number;
	unread?: boolean;
	starred?: boolean;
	lastModified?: number | string | null;
};

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
