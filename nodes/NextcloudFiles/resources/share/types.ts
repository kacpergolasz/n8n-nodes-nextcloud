import type { NextcloudCredentialData } from '../../FilesInterface';

export interface ShareOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
