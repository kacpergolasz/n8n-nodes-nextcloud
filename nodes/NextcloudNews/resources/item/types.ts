import type { NextcloudCredentialData } from '../../../shared/parse';

export interface ItemOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
