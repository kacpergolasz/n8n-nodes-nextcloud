import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

import { isPlainObject } from '../../../shared/parse';
import { normalizeFilesPath } from '../../GenericFunctions';

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

/** Extract a locator `value` from a raw param (full RLC object or scalar). */
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

export function resolvePathFromInput(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	itemIndex: number,
): string {
	return normalizeFilesPath(getLocatorValue(context, 'path', itemIndex));
}
