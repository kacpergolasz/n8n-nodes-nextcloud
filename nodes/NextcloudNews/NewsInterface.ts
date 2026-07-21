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
	added?: number;
	folderId?: number | null;
	unreadCount?: number;
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
	pubDate?: number;
	body?: string | null;
	feedId?: number;
	unread?: boolean;
	starred?: boolean;
	lastModified?: number;
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
