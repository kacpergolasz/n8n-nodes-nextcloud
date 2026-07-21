import type { NextcloudCredentialData } from '../../GenericFunctions';

export type ShareOperationContext = {
	itemIndex: number;
	credentials: NextcloudCredentialData;
};
