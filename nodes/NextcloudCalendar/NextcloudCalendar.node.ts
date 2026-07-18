import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import {
	buildEventUrl,
	buildICalendarPayload,
	eventIdFromCalDavHref,
	getCredentials,
	nextcloudRequest,
	parseDtStartFromIcs,
	parseEventHrefAndIcsFromMultistatus,
	parseIcsEventVerbose,
	parseUserIdAndCalendarIdFromCalendarUrl,
	resolveCalendarUrl,
	unfoldIcsContent,
} from './GenericFunctions';
import { getCalendars } from './listSearch/getCalendars';
import { eventDescription } from './resources/event';
import { scrubErrorMessage } from './shared/scrubSecrets';

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

function resolveCalendarFromInput(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	itemIndex: number,
): string {
	const locator = context.getNodeParameter('calendar', itemIndex) as INodeParameterResourceLocator;
	return locator.value as string;
}

export class NextcloudCalendar implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Calendar',
		name: 'nextcloudCalendar',
		icon: 'file:nextcloudCalendar.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume events from the Nextcloud Calendar CalDAV API',
		defaults: {
			name: 'Nextcloud Calendar',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nextcloudApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Event', value: 'event' }],
				default: 'event',
			},
			...eventDescription,
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			getCalendars,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await getCredentials(this);

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const selectedCalendar = resolveCalendarFromInput(this, i);
				const calendarUrl = resolveCalendarUrl(
					credentials.baseUrl,
					credentials.username,
					selectedCalendar,
				);
				const { userId, calendarId } = parseUserIdAndCalendarIdFromCalendarUrl(calendarUrl);

				if (operation === 'get') {
					const eventId = this.getNodeParameter('eventId', i) as string;
					const eventUrl = buildEventUrl(calendarUrl, eventId);
					const response = await nextcloudRequest(this, 'GET', eventUrl, undefined, {
						Accept: 'text/calendar',
					});
					returnData.push({
						json: { eventId, calendarId, ...parseIcsEventVerbose(response as string) },
						pairedItem: { item: i },
					});
				}

				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = this.getNodeParameter('limit', i, 25) as number;
					const afterMs = nodeDateToFilterMs(this.getNodeParameter('after', i, ''));
					const beforeMs = nodeDateToFilterMs(this.getNodeParameter('before', i, ''));
					const hasTimeFilter = afterMs !== null || beforeMs !== null;

					const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
	<d:prop>
		<d:getetag />
		<cal:calendar-data />
	</d:prop>
</d:propfind>`;

					const response = await nextcloudRequest(this, 'PROPFIND', calendarUrl, propfindBody, {
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
					for (const { href, ics } of sliced) {
						returnData.push({
							json: {
								eventId: eventIdFromCalDavHref(href),
								calendarId,
								userId,
								...parseIcsEventVerbose(ics),
							} as IDataObject,
							pairedItem: { item: i },
						});
					}
				}

				if (operation === 'create') {
					const summary = this.getNodeParameter('summary', i) as string;
					const start = this.getNodeParameter('start', i) as string;
					const end = this.getNodeParameter('end', i) as string;
					const description = this.getNodeParameter('description', i, '') as string;
					const payload = buildICalendarPayload({ summary, start, end, description });
					const eventId = `${Date.now()}-${i}`;
					const eventUrl = buildEventUrl(calendarUrl, eventId);
					await nextcloudRequest(this, 'PUT', eventUrl, payload, {
						'Content-Type': 'text/calendar; charset=utf-8',
					});
					returnData.push({
						json: { eventId, calendarId, userId, created: true },
						pairedItem: { item: i },
					});
				}

				if (operation === 'update') {
					const eventId = this.getNodeParameter('eventId', i) as string;
					const summary = this.getNodeParameter('summary', i) as string;
					const start = this.getNodeParameter('start', i) as string;
					const end = this.getNodeParameter('end', i) as string;
					const description = this.getNodeParameter('description', i, '') as string;
					const eventUrl = buildEventUrl(calendarUrl, eventId);
					const payload = buildICalendarPayload({ summary, start, end, description }, eventId);
					await nextcloudRequest(this, 'PUT', eventUrl, payload, {
						'Content-Type': 'text/calendar; charset=utf-8',
					});
					returnData.push({
						json: { eventId, calendarId, userId, updated: true },
						pairedItem: { item: i },
					});
				}

				if (operation === 'delete') {
					const eventId = this.getNodeParameter('eventId', i) as string;
					const eventUrl = buildEventUrl(calendarUrl, eventId);
					await nextcloudRequest(this, 'DELETE', eventUrl);
					returnData.push({
						json: { eventId, calendarId, userId, deleted: true },
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				const scrubbedMessage = scrubErrorMessage(error, {
					appPassword: credentials.appPassword,
					username: credentials.username,
				});

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: scrubbedMessage,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), { message: scrubbedMessage } as JsonObject, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
