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
