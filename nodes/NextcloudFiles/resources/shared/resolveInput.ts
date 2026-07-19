import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import type { INodeParameterResourceLocator } from 'n8n-workflow';

import { normalizeFilesPath } from '../../GenericFunctions';

export function resolvePathFromInput(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	itemIndex: number,
): string {
	const locator = context.getNodeParameter('path', itemIndex) as INodeParameterResourceLocator;
	return normalizeFilesPath(locator.value as string);
}
