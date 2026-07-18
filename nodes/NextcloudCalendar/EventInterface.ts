export interface NextcloudCredentialData {
	baseUrl: string;
	username: string;
	appPassword: string;
}

export interface NextcloudCalendarOption {
	name: string;
	value: string;
}

export interface NextcloudEventInput {
	summary: string;
	description?: string;
	start: string;
	end: string;
	timezone?: string;
	location?: string;
}
