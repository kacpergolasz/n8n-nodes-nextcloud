import type { IDataObject } from 'n8n-workflow';

import type { DeckBoard, DeckCard, DeckStack } from '../../DeckInterface';

export function boardToJson(board: DeckBoard): IDataObject {
	return { ...board } as IDataObject;
}

export function stackToJson(stack: DeckStack): IDataObject {
	return { ...stack } as IDataObject;
}

export function cardToJson(card: DeckCard): IDataObject {
	return { ...card } as IDataObject;
}
