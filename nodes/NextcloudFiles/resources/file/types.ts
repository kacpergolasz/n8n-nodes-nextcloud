import type { NextcloudCredentialData } from '../../FilesInterface';

export interface FileOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
}
