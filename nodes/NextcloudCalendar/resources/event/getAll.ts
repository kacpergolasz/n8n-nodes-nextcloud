import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import {
	eventIdFromCalDavHref,
	nextcloudRequest,
	nodeDateToFilterMs,
	parseDtStartFromIcs,
	parseEventHrefAndIcsFromMultistatus,
	parseIcsEventVerbose,
	toCalDavUtcStamp,
	unfoldIcsContent,
} from '../../GenericFunctions';
import type { EventOperationContext } from './types';

/** Inclusive client-side DTSTART window; CalDAV `time-range` end is exclusive so bump by 1s. */
const CALDAV_END_INCLUSIVE_SLACK_MS = 1000;

export function buildListEventsRequest(
	afterMs: number | null,
	beforeMs: number | null,
): { method: 'PROPFIND' | 'REPORT'; body: string } {
	if (afterMs === null && beforeMs === null) {
		return {
			method: 'PROPFIND',
			body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
	<d:prop>
		<d:getetag />
		<cal:calendar-data />
	</d:prop>
</d:propfind>`,
		};
	}

	const startAttr = afterMs !== null ? ` start="${toCalDavUtcStamp(afterMs)}"` : '';
	const endAttr =
		beforeMs !== null
			? ` end="${toCalDavUtcStamp(beforeMs + CALDAV_END_INCLUSIVE_SLACK_MS)}"`
			: '';

	return {
		method: 'REPORT',
		body: `<?xml version="1.0" encoding="utf-8" ?>
<cal:calendar-query xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
	<d:prop>
		<d:getetag />
		<cal:calendar-data />
	</d:prop>
	<cal:filter>
		<cal:comp-filter name="VCALENDAR">
			<cal:comp-filter name="VEVENT">
				<cal:time-range${startAttr}${endAttr} />
			</cal:comp-filter>
		</cal:comp-filter>
	</cal:filter>
</cal:calendar-query>`,
	};
}

export async function eventGetAll(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, calendarUrl, calendarId, userId } = ctx;
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return All',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const afterMs = nodeDateToFilterMs(context.getNodeParameter('after', itemIndex, ''));
	const beforeMs = nodeDateToFilterMs(context.getNodeParameter('before', itemIndex, ''));
	const hasTimeFilter = afterMs !== null || beforeMs !== null;

	const { method, body } = buildListEventsRequest(afterMs, beforeMs);
	const response = await nextcloudRequest(context, method, calendarUrl, body, {
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
