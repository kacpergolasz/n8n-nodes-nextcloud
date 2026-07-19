import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { buildEventUrl, buildICalendarPayload, nextcloudRequest } from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventUpdate(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId } = ctx;
	const eventId = context.getNodeParameter('eventId', itemIndex) as string;
	const summary = context.getNodeParameter('summary', itemIndex) as string;
	const start = context.getNodeParameter('start', itemIndex) as string;
	const end = context.getNodeParameter('end', itemIndex) as string;
	const description = context.getNodeParameter('description', itemIndex, '') as string;
	const eventUrl = buildEventUrl(calendarUrl, eventId);
	const payload = buildICalendarPayload({ summary, start, end, description }, eventId);

	await nextcloudRequest(context, 'PUT', eventUrl, payload, {
		'Content-Type': 'text/calendar; charset=utf-8',
	});

	return {
		json: { eventId, calendarId, userId, updated: true },
		pairedItem: { item: itemIndex },
	};
}
