export interface NextcloudCredentialData {
	baseUrl: string;
	username: string;
	appPassword: string;
}

export interface DeckPickerOption {
	name: string;
	value: string;
}

export interface DeckBoard {
	id: number;
	title: string;
	color: string;
	archived?: boolean;
	deletedAt?: number;
	[key: string]: unknown;
}

export interface DeckStack {
	id: number;
	title: string;
	order: number;
	cards?: DeckCard[];
	[key: string]: unknown;
}

export interface DeckCard {
	id: number;
	title: string;
	type?: string;
	order?: number;
	description?: string;
	duedate?: string | null;
	stackId?: number;
	[key: string]: unknown;
}
