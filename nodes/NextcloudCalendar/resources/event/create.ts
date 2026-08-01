import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseRequiredString, parseString } from '../../../shared/parse';
import {
	buildCalendarEventWebUrl,
	buildEventUrl,
	buildICalendarPayload,
	nextcloudRequest,
} from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventCreate(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId, credentials } = ctx;
	const summary = parseRequiredString(context.getNodeParameter('summary', itemIndex), 'Summary');
	const start = parseRequiredString(context.getNodeParameter('start', itemIndex), 'Start');
	const end = parseRequiredString(context.getNodeParameter('end', itemIndex), 'End');
	const description = parseString(context.getNodeParameter('description', itemIndex, ''), 'Description');
	const location = parseString(context.getNodeParameter('location', itemIndex, ''), 'Location');
	const payload = buildICalendarPayload({
		summary,
		start,
		end,
		...(description ? { description } : {}),
		...(location ? { location } : {}),
	});
	const eventId = `${Date.now()}-${itemIndex}`;
	const eventUrl = buildEventUrl(calendarUrl, eventId);

	await nextcloudRequest(context, 'PUT', eventUrl, payload, {
		'Content-Type': 'text/calendar; charset=utf-8',
	});

	return {
		json: {
			eventId,
			calendarId,
			userId,
			webUrl: buildCalendarEventWebUrl(credentials.baseUrl, userId, calendarId, eventId),
			created: true,
		},
		pairedItem: { item: itemIndex },
	};
}
