export type NextcloudAuthenticationMode = 'basicAuth' | 'oAuth2';

export type NextcloudCredentialName = 'nextcloudApi' | 'nextcloudOAuth2Api';

export type NextcloudCredentialData = {
	baseUrl: string;
	username: string;
	credentialName: NextcloudCredentialName;
	authentication: NextcloudAuthenticationMode;
	appPassword?: string;
	accessToken?: string;
	refreshToken?: string;
	clientSecret?: string;
};

export type NextcloudCalendarOption = {
	name: string;
	value: string;
};

export type NextcloudEventInput = {
	summary: string;
	description?: string;
	start: string;
	end: string;
	timezone?: string;
	location?: string;
};

/**
 * Partial Calendar event Update Fields patch.
 * Only defined keys are applied; omitted keys leave existing ICS properties untouched.
 */
export type EventUpdatePatch = {
	summary?: string;
	description?: string;
	location?: string;
	/** ISO-8601-like datetime from n8n dateTime. */
	start?: string;
	/** ISO-8601-like datetime from n8n dateTime. */
	end?: string;
	/** When true, emit VALUE=DATE; when false, emit DATE-TIME. */
	allDay?: boolean;
	/** IANA TZID for timed events (e.g. Europe/Warsaw). Ignored when all-day. */
	timezone?: string;
};
