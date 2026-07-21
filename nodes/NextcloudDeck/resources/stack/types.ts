import type { NextcloudCredentialData } from '../../../shared/parse';

export interface StackOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
	boardId: string;
}
