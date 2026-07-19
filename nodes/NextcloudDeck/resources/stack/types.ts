import type { NextcloudCredentialData } from '../../DeckInterface';

export interface StackOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
	boardId: string;
}
