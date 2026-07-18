import type { INodeProperties } from 'n8n-workflow';

import {
	destinationPathField,
	overwriteField,
	pathSelect,
} from '../../shared/descriptions';

const showOnlyForFile = {
	resource: ['file'],
};

export const fileDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForFile,
		},
		options: [
			{ name: 'Copy', value: 'copy', action: 'Copy a file' },
			{ name: 'Delete', value: 'delete', action: 'Delete a file' },
			{ name: 'Download', value: 'download', action: 'Download a file' },
			{ name: 'Move', value: 'move', action: 'Move a file' },
			{ name: 'Upload', value: 'upload', action: 'Upload a file' },
		],
		default: 'download',
	},
	{
		...pathSelect,
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['download', 'delete', 'move', 'copy'],
			},
		},
	},
	{
		...pathSelect,
		displayName: 'Target Path',
		description: 'Directory or full file path where the upload should be stored',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
			},
		},
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		description: 'Name of the binary property that contains the file to upload',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
			},
		},
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		description:
			'Optional file name when the target path is a directory. When empty, the binary metadata file name is used when available.',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
			},
		},
	},
	{
		displayName: 'Output Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		description: 'Name of the binary property to write the downloaded file into',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['download'],
			},
		},
	},
	{
		...destinationPathField,
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['move', 'copy'],
			},
		},
	},
	{
		...overwriteField,
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['move', 'copy'],
			},
		},
	},
];
