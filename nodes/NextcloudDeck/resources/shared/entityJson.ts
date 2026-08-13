import type { IDataObject } from 'n8n-workflow';

import type { DeckBoard, DeckCard, DeckStack } from '../../DeckSchemas';
import { mergeDefined } from '../../GenericFunctions';

export function boardToJson(board: DeckBoard): IDataObject {
	return mergeDefined({ ...board }, {});
}

export function stackToJson(stack: DeckStack): IDataObject {
	return mergeDefined({ ...stack }, {});
}

export function cardToJson(card: DeckCard): IDataObject {
	return mergeDefined({ ...card }, {});
}
