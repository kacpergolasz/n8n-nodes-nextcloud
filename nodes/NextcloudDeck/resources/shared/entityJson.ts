import type { IDataObject } from 'n8n-workflow';

import type { DeckBoard, DeckCard, DeckStack } from '../../DeckSchemas';

export function boardToJson(board: DeckBoard): IDataObject {
	// TODO
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return { ...board } as IDataObject;
}

export function stackToJson(stack: DeckStack): IDataObject {
	// TODO
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions	
	return { ...stack } as IDataObject;
}

export function cardToJson(card: DeckCard): IDataObject {
	// TODO
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return { ...card } as IDataObject;
}
