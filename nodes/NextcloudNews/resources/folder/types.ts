import type { NextcloudCredentialData } from '../../NewsInterface';

export interface FolderOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
