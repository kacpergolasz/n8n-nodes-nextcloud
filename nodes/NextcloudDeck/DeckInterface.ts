export type DeckPickerOption = {
	name: string;
	value: string;
};

export type DeckBoard = {
	id: number;
	title: string;
	color: string;
	archived?: boolean;
	deletedAt?: number | null;
};

export type DeckStack = {
	id: number;
	title: string;
	order: number;
	cards?: DeckCard[];
};

export type DeckCard = {
	id: number;
	title: string;
	type?: string;
	order?: number;
	description?: string;
	duedate?: string | null;
	stackId?: number;
};
