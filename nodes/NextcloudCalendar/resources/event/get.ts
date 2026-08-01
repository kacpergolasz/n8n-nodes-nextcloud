import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseRequiredString } from '../../../shared/parse';
import {
	buildCalendarEventWebUrl,
	buildEventUrl,
	nextcloudRequest,
	parseIcsEventVerbose,
} from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventGet(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId, credentials } = ctx;
	const eventId = parseRequiredString(context.getNodeParameter('eventId', itemIndex), 'Event ID');
	const eventUrl = buildEventUrl(calendarUrl, eventId);

	const response = await nextcloudRequest(context, 'GET', eventUrl, undefined, {
		Accept: 'text/calendar',
	});

	const ics = parseRequiredString(response, 'ICS response');

	return {
		json: {
			eventId,
			calendarId,
			userId,
			webUrl: buildCalendarEventWebUrl(credentials.baseUrl, userId, calendarId, eventId),
			...parseIcsEventVerbose(ics),
		},
		pairedItem: { item: itemIndex },
	};
}
