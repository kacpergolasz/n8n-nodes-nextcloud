import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class NextcloudOAuth2Api implements ICredentialType {
	name = 'nextcloudOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Nextcloud OAuth2 API';

	icon: Icon = { light: 'file:nextcloudOAuth2Api.svg', dark: 'file:nextcloudOAuth2Api.dark.svg' };

	documentationUrl =
		'https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/oauth2.html';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://nextcloud.example.com',
			description: 'Your Nextcloud server base URL',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description:
				'Same user id Nextcloud uses in CalDAV paths (e.g. ncuser in …/dav/calendars/ncuser/…). Not necessarily your login email.',
			placeholder: 'e.g. ncuser',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: '={{$self["baseUrl"]}}/apps/oauth2/authorize',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '={{$self["baseUrl"]}}/apps/oauth2/api/v1/token',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
