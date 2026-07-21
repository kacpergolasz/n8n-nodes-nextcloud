import type { NextcloudCredentialData } from '../../../shared/parse';

export interface BoardOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
