import type { NextcloudCredentialData } from '../../DeckInterface';

export interface CardOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
	boardId: string;
}
