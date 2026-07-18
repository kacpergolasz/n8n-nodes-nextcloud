import type { ILoadOptionsFunctions, INodeListSearchResult, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadCalendars } from '../GenericFunctions';
import { scrubErrorMessage } from '../shared/scrubSecrets';

export async function getCalendars(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const calendars = await loadCalendars(this);
		return {
			results: calendars.map((calendar) => ({ name: calendar.name, value: calendar.value })),
		};
	} catch (error) {
		let secrets = {};
		try {
			secrets = await getCredentials(this);
		} catch {
			// ignore credential load failures while scrubbing
		}
		const scrubbedMessage = scrubErrorMessage(error, secrets);
		throw new NodeApiError(this.getNode(), { message: scrubbedMessage } as JsonObject);
	}
}
