import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { buildEventUrl, nextcloudRequest, parseIcsEventVerbose } from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventGet(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId } = ctx;
	const eventId = context.getNodeParameter('eventId', itemIndex) as string;
	const eventUrl = buildEventUrl(calendarUrl, eventId);

	const response = await nextcloudRequest(context, 'GET', eventUrl, undefined, {
		Accept: 'text/calendar',
	});

	return {
		json: { eventId, calendarId, ...parseIcsEventVerbose(response as string) },
		pairedItem: { item: itemIndex },
	};
}
