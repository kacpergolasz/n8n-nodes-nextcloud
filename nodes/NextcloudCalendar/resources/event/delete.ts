import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseRequiredString } from '../../../shared/parse';
import { buildEventUrl, nextcloudRequest } from '../../GenericFunctions';
import type { EventOperationContext } from './types';

export async function eventDelete(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId } = ctx;
	const eventId = parseRequiredString(context.getNodeParameter('eventId', itemIndex), 'Event ID');
	const eventUrl = buildEventUrl(calendarUrl, eventId);

	await nextcloudRequest(context, 'DELETE', eventUrl);

	return {
		json: { eventId, calendarId, userId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
