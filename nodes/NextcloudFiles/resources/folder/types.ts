import type { NextcloudCredentialData } from '../../FilesInterface';

export interface FolderOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
