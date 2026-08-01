import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { EventUpdatePatch } from '../../EventInterface';
import {
	getErrorMessage,
	isPlainObject,
	parseOptionalString,
	parseRequiredBoolean,
	parseRequiredString,
	parseString,
} from '../../../shared/parse';
import {
	buildCalendarEventWebUrl,
	buildEventUrl,
	nextcloudRequest,
} from '../../GenericFunctions';
import { parseIcs, patchEventCalendar, serializeIcs } from '../../ics';
import type { EventOperationContext } from './types';

function parseUpdateFields(raw: unknown): EventUpdatePatch {
	if (!isPlainObject(raw) || Object.keys(raw).length === 0) {
		throw new Error(
			'Select at least one field to update (summary, description, start, end, location, all day, or timezone)',
		);
	}

	const patch: EventUpdatePatch = {};

	if ('summary' in raw) {
		patch.summary = parseString(raw.summary, 'Summary');
	}
	if ('description' in raw) {
		patch.description = parseString(raw.description, 'Description');
	}
	if ('location' in raw) {
		patch.location = parseString(raw.location, 'Location');
	}
	if ('start' in raw) {
		patch.start = parseRequiredString(raw.start, 'Start');
	}
	if ('end' in raw) {
		patch.end = parseRequiredString(raw.end, 'End');
	}
	if ('allDay' in raw) {
		patch.allDay = parseRequiredBoolean(raw.allDay, 'All Day');
	}
	if ('timezone' in raw) {
		const timezone = parseOptionalString(raw.timezone, 'Timezone');
		if (timezone !== undefined && timezone.trim().length > 0) {
			patch.timezone = timezone.trim();
		}
	}

	if (Object.keys(patch).length === 0) {
		throw new Error(
			'Select at least one field to update (summary, description, start, end, location, all day, or timezone)',
		);
	}

	return patch;
}

export async function eventUpdate(
	context: IExecuteFunctions,
	ctx: EventOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, calendarUrl, calendarId, userId, credentials } = ctx;
	const eventId = parseRequiredString(context.getNodeParameter('eventId', itemIndex), 'Event ID');

	let patch: EventUpdatePatch;
	try {
		patch = parseUpdateFields(context.getNodeParameter('updateFields', itemIndex, {}));
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}

	const eventUrl = buildEventUrl(calendarUrl, eventId);

	const response = await nextcloudRequest(context, 'GET', eventUrl, undefined, {
		Accept: 'text/calendar',
	});
	const ics = parseRequiredString(response, 'ICS response');

	let payload: string;
	try {
		const calendar = parseIcs(ics);
		patchEventCalendar(calendar, patch);
		payload = serializeIcs(calendar);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}

	await nextcloudRequest(context, 'PUT', eventUrl, payload, {
		'Content-Type': 'text/calendar; charset=utf-8',
	});

	return {
		json: {
			eventId,
			calendarId,
			userId,
			webUrl: buildCalendarEventWebUrl(credentials.baseUrl, userId, calendarId, eventId),
			updated: true,
		},
		pairedItem: { item: itemIndex },
	};
}
