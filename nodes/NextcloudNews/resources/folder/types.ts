import type { NextcloudCredentialData } from '../../../shared/parse';

export interface FolderOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
