import type { NextcloudCredentialData } from '../../NewsInterface';

export interface ItemOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
