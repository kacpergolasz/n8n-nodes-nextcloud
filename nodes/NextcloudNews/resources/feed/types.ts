import type { NextcloudCredentialData } from '../../../shared/parse';

export interface FeedOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
