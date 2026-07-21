import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import { nodeApiErrorPayload, parseRequiredString } from '../shared/parse';
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
	const value = context.getNodeParameter('calendar', itemIndex, undefined, { extractValue: true });
	return parseRequiredString(value, 'Calendar');
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
		credentials: [
			{
				name: 'nextcloudApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['basicAuth'],
					},
				},
			},
			{
				name: 'nextcloudOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Basic Auth',
						value: 'basicAuth',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
				],
				default: 'basicAuth',
			},
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
					username: credentials.username,
					appPassword: credentials.appPassword,
					accessToken: credentials.accessToken,
					refreshToken: credentials.refreshToken,
					clientSecret: credentials.clientSecret,
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
					nodeApiErrorPayload(message, statusCode !== undefined ? { httpCode: statusCode } : undefined),
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
