import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

import { resolveBoardId, resolveStackId } from '../../GenericFunctions';
import { isPlainObject } from '../../../shared/parse';

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

/** Extract a locator `value` from `getCurrentNodeParameter` (full RLC or scalar). */
export function parseLocatorParamValue(raw: unknown): string | undefined {
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}

	if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
		const text = String(raw).trim();
		return text || undefined;
	}

	if (isPlainObject(raw) && 'value' in raw) {
		const value = raw.value;
		if (value === undefined || value === null || value === '') {
			return undefined;
		}
		const text = String(value).trim();
		return text || undefined;
	}

	return undefined;
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
