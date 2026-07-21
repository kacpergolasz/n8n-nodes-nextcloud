import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseRequiredString, parseString } from '../../../shared/parse';
import { buildEventUrl, buildICalendarPayload, nextcloudRequest } from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventUpdate(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId } = ctx;
	const eventId = parseRequiredString(context.getNodeParameter('eventId', itemIndex), 'Event ID');
	const summary = parseRequiredString(context.getNodeParameter('summary', itemIndex), 'Summary');
	const start = parseRequiredString(context.getNodeParameter('start', itemIndex), 'Start');
	const end = parseRequiredString(context.getNodeParameter('end', itemIndex), 'End');
	const description = parseString(context.getNodeParameter('description', itemIndex, ''), 'Description');
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
