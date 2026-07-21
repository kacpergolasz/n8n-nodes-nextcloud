import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

import { resolveBoardId, resolveStackId } from '../../GenericFunctions';

/**
 * Read a resourceLocator value, coercing numeric expression results
 * (e.g. `={{ $json.id }}` → number) to string so string-typed By-ID modes
 * do not fail type validation.
 */
export function getLocatorValue(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	paramName: string,
	itemIndex: number,
	fallback: string = '',
): string {
	const value = context.getNodeParameter(paramName, itemIndex, fallback, {
		extractValue: true,
		ensureType: 'string',
		// Numeric expression results (={{ $json.id }}) fail string-mode RLC
		// validation before ensureType can coerce — skip and coerce ourselves.
		skipValidation: true,
	});

	if (value === undefined || value === null) {
		return '';
	}

	return String(value);
}

export function resolveBoardFromInput(context: IExecuteFunctions, itemIndex: number): string {
	return resolveBoardId(getLocatorValue(context, 'board', itemIndex));
}

export function resolveStackFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName = 'stack',
): string {
	return resolveStackId(getLocatorValue(context, paramName, itemIndex));
}

export function resolveOptionalStackFilter(
	context: IExecuteFunctions,
	itemIndex: number,
): string | undefined {
	const raw = getLocatorValue(context, 'stackFilter', itemIndex, '');
	const value = raw.trim();
	return value || undefined;
}
