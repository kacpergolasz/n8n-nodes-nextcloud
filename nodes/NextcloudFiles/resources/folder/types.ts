import type { NextcloudCredentialData } from '../../GenericFunctions';

export type FolderOperationContext = {
	itemIndex: number;
	credentials: NextcloudCredentialData;
};
