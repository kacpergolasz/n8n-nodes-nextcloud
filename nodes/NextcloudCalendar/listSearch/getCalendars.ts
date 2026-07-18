import type { ILoadOptionsFunctions, INodeListSearchResult, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { getCredentials, loadCalendars } from '../GenericFunctions';
import { scrubErrorMessage } from '../shared/scrubSecrets';
import type { ScrubSecretsInput } from '../shared/scrubSecrets';

function toScrubSecretsInput(credentials: Awaited<ReturnType<typeof getCredentials>>): ScrubSecretsInput {
	return {
		username: credentials.username,
		appPassword: credentials.appPassword,
		accessToken: credentials.accessToken,
		refreshToken: credentials.refreshToken,
		clientSecret: credentials.clientSecret,
	};
}

export async function getCalendars(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	try {
		const calendars = await loadCalendars(this);
		return {
			results: calendars.map((calendar) => ({ name: calendar.name, value: calendar.value })),
		};
	} catch (error) {
		let secrets: ScrubSecretsInput = {};
		try {
			secrets = toScrubSecretsInput(await getCredentials(this));
		} catch {
			// ignore credential load failures while scrubbing
		}
		const scrubbedMessage = scrubErrorMessage(error, secrets);
		throw new NodeApiError(this.getNode(), { message: scrubbedMessage } as JsonObject);
	}
}
