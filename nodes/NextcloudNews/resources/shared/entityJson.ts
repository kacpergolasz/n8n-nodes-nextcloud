import type { IDataObject } from 'n8n-workflow';

import type { NewsFeed, NewsFolder, NewsItem } from '../../NewsInterface';

export function folderToJson(folder: NewsFolder): IDataObject {
	return { ...folder } as IDataObject;
}

export function feedToJson(feed: NewsFeed): IDataObject {
	return { ...feed } as IDataObject;
}

export function itemToJson(item: NewsItem): IDataObject {
	return { ...item } as IDataObject;
}
