import type {
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
	getCredentials,
	parseUserIdAndCalendarIdFromCalendarUrl,
	resolveCalendarUrl,
} from './GenericFunctions';
import { getCalendars } from './listSearch/getCalendars';
import { eventDescription } from './resources/event';
import { eventCreate } from './resources/event/create';
import { eventDelete } from './resources/event/delete';
import { eventGet } from './resources/event/get';
import { eventGetAll } from './resources/event/getAll';
import { eventUpdate } from './resources/event/update';
import type { EventOperationContext } from './resources/event/types';
import { getHttpStatusCode } from './shared/httpStatus';
import { scrubErrorMessage } from './shared/scrubSecrets';

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
				const operation = this.getNodeParameter('operation', i);
				const selectedCalendar = resolveCalendarFromInput(this, i);
				const calendarUrl = resolveCalendarUrl(
					credentials.baseUrl,
					credentials.username,
					selectedCalendar,
				);
				const { userId, calendarId } = parseUserIdAndCalendarIdFromCalendarUrl(calendarUrl);
				const opCtx: EventOperationContext = {
					itemIndex: i,
					credentials,
					calendarUrl,
					calendarId,
					userId,
				};

				switch (operation) {
					case 'get':
						returnData.push(await eventGet(this, opCtx));
						break;
					case 'getAll':
						returnData.push(...(await eventGetAll(this, opCtx)));
						break;
					case 'create':
						returnData.push(await eventCreate(this, opCtx));
						break;
					case 'update':
						returnData.push(await eventUpdate(this, opCtx));
						break;
					case 'delete':
						returnData.push(await eventDelete(this, opCtx));
						break;
				}
			} catch (error) {
				const statusCode = getHttpStatusCode(error);
				const scrubbedMessage = scrubErrorMessage(error, {
					appPassword: credentials.appPassword,
					username: credentials.username,
				});
				const message =
					statusCode === 404 ? `Event not found (404)` : scrubbedMessage;

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: message,
							...(statusCode !== undefined ? { statusCode } : {}),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(
					this.getNode(),
					{ message, ...(statusCode !== undefined ? { httpCode: statusCode } : {}) } as JsonObject,
					{
						itemIndex: i,
						...(statusCode !== undefined ? { httpCode: String(statusCode) } : {}),
					},
				);
			}
		}

		return [returnData];
	}
}
