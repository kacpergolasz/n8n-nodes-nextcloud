import type { NextcloudCredentialData } from '../../../shared/parse';

export interface CardOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
	boardId: string;
}
