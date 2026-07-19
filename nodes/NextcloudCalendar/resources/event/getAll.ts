import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	eventIdFromCalDavHref,
	nextcloudRequest,
	parseDtStartFromIcs,
	parseEventHrefAndIcsFromMultistatus,
	parseIcsEventVerbose,
	unfoldIcsContent,
} from '../../GenericFunctions';
import type { EventOperationContext } from './types';

function nodeDateToFilterMs(value: unknown): number | null {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return null;
		return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
	}
	if (typeof value === 'string') {
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? null : parsed;
	}
	return null;
}

export async function eventGetAll(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, calendarUrl, calendarId, userId } = ctx;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 10) as number;
	const afterMs = nodeDateToFilterMs(context.getNodeParameter('after', itemIndex, ''));
	const beforeMs = nodeDateToFilterMs(context.getNodeParameter('before', itemIndex, ''));
	const hasTimeFilter = afterMs !== null || beforeMs !== null;

	const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
	<d:prop>
		<d:getetag />
		<cal:calendar-data />
	</d:prop>
</d:propfind>`;

	const response = await nextcloudRequest(context, 'PROPFIND', calendarUrl, propfindBody, {
		Depth: '1',
		'Content-Type': 'application/xml; charset=utf-8',
		Accept: 'application/xml',
	});

	const data = typeof response === 'string' ? response : JSON.stringify(response);
	const entries = parseEventHrefAndIcsFromMultistatus(data);

	const filtered: { href: string; ics: string }[] = [];
	for (const { href, ics } of entries) {
		if (!ics) continue;
		if (hasTimeFilter) {
			const startMs = parseDtStartFromIcs(unfoldIcsContent(ics));
			if (startMs === undefined) continue;
			if (afterMs !== null && startMs < afterMs) continue;
			if (beforeMs !== null && startMs > beforeMs) continue;
		}
		filtered.push({ href, ics });
	}

	const sliced = returnAll ? filtered : filtered.slice(0, limit);
	return sliced.map(({ href, ics }) => ({
		json: {
			eventId: eventIdFromCalDavHref(href),
			calendarId,
			userId,
			...parseIcsEventVerbose(ics),
		},
		pairedItem: { item: itemIndex },
	}));
}
