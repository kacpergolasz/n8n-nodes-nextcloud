import type { NextcloudCredentialData } from '../../GenericFunctions';

export type FileOperationContext = {
	itemIndex: number;
	credentials: NextcloudCredentialData;
};
