import type { IDataObject } from 'n8n-workflow';

import type { NewsFeed, NewsFolder, NewsItem } from '../../NewsInterface';

export function folderToJson(folder: NewsFolder): IDataObject {
	return { ...folder };
}

export function feedToJson(feed: NewsFeed): IDataObject {
	return { ...feed };
}

export function itemToJson(item: NewsItem): IDataObject {
	return { ...item };
}
