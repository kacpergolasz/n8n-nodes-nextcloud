import type { IExecuteFunctions } from 'n8n-workflow';
import type { INodeParameterResourceLocator } from 'n8n-workflow';

import { resolveBoardId, resolveStackId } from '../../GenericFunctions';

export function resolveBoardFromInput(context: IExecuteFunctions, itemIndex: number): string {
	const locator = context.getNodeParameter('board', itemIndex) as INodeParameterResourceLocator;
	return resolveBoardId(locator.value as string);
}

export function resolveStackFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName = 'stack',
): string {
	const locator = context.getNodeParameter(paramName, itemIndex) as INodeParameterResourceLocator;
	return resolveStackId(locator.value as string);
}

export function resolveOptionalStackFilter(
	context: IExecuteFunctions,
	itemIndex: number,
): string | undefined {
	const locator = context.getNodeParameter('stackFilter', itemIndex, {
		mode: 'id',
		value: '',
	}) as INodeParameterResourceLocator;
	const raw = locator?.value;
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}
	const value = String(raw).trim();
	return value || undefined;
}
