import type { NextcloudCredentialData } from '../../NewsInterface';

export interface FeedOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
