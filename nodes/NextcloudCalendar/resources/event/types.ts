import type { NextcloudCredentialData } from '../../EventInterface';

export interface EventOperationContext {
	itemIndex: number;
	credentials: NextcloudCredentialData;
	calendarUrl: string;
	calendarId: string;
	userId: string;
}
