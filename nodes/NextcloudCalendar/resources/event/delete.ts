import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { buildEventUrl, nextcloudRequest } from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventDelete(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId } = ctx;
	const eventId = context.getNodeParameter('eventId', itemIndex) as string;
	const eventUrl = buildEventUrl(calendarUrl, eventId);

	await nextcloudRequest(context, 'DELETE', eventUrl);

	return {
		json: { eventId, calendarId, userId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
