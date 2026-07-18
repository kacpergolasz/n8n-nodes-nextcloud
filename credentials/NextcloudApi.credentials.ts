import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NextcloudApi implements ICredentialType {
	name = 'nextcloudApi';

	displayName = 'Nextcloud API';

	icon: Icon = 'file:nextcloudApi.svg';

	documentationUrl =
		'https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/basic.html';

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
				'Same user id Nextcloud uses in CalDAV paths (e.g. ext_662 in …/dav/calendars/ext_662/…). Not necessarily your login email.',
			placeholder: 'e.g. ext_662',
		},
		{
			displayName: 'App Password',
			name: 'appPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.appPassword}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			url: '={{$credentials.baseUrl}}/status.php',
			method: 'GET',
		},
	};
}
