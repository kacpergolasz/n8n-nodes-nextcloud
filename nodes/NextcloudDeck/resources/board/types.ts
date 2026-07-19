import type { NextcloudCredentialData } from '../../DeckInterface';

export interface BoardOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
