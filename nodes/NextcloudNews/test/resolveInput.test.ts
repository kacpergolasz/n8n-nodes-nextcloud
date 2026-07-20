import type { IExecuteFunctions } from 'n8n-workflow';

import {
	getLocatorValue,
	resolveFeedFromInput,
	resolveFolderFromInput,
	resolveOptionalFeedId,
	resolveOptionalFolderId,
	resolveOptionalFolderIdFilter,
} from '../resources/shared/resolveInput';

function mockContext(param: unknown): IExecuteFunctions {
	return {
		getNodeParameter: (
			_name: string,
			_index: number,
			fallback?: unknown,
			options?: { extractValue?: boolean; ensureType?: string },
		) => {
			let value = param ?? fallback;
			if (
				options?.extractValue &&
				value !== null &&
				typeof value === 'object' &&
				'value' in (value as object)
			) {
				value = (value as { value: unknown }).value;
			}
			if (options?.ensureType === 'string' && value !== undefined && value !== null) {
				return String(value);
			}
			return value;
		},
	} as unknown as IExecuteFunctions;
}

describe('resolveInput locators', () => {
	it('coerces bare numeric expression results (e.g. {{ $json.id }})', () => {
		expect(resolveFolderFromInput(mockContext(42), 0)).toBe('42');
		expect(resolveFeedFromInput(mockContext(67), 0)).toBe('67');
		expect(resolveOptionalFolderId(mockContext(12), 0)).toBe(12);
	});

	it('reads resourceLocator objects with numeric or string values', () => {
		expect(resolveFolderFromInput(mockContext({ mode: 'id', value: 12 }), 0)).toBe('12');
		expect(resolveFeedFromInput(mockContext({ mode: 'list', value: '67' }), 0)).toBe('67');
	});

	it('treats empty optional folder as root (null)', () => {
		expect(resolveOptionalFolderId(mockContext(''), 0)).toBeNull();
		expect(resolveOptionalFolderId(mockContext({ mode: 'id', value: '' }), 0)).toBeNull();
	});

	it('treats empty optional filters as undefined (do not apply)', () => {
		expect(resolveOptionalFeedId(mockContext(''), 0)).toBeUndefined();
		expect(resolveOptionalFeedId(mockContext({ mode: 'list', value: '' }), 0)).toBeUndefined();
		expect(resolveOptionalFolderIdFilter(mockContext(''), 0)).toBeUndefined();
		expect(resolveOptionalFeedId(mockContext({ mode: 'id', value: 67 }), 0)).toBe(67);
		expect(resolveOptionalFolderIdFilter(mockContext({ mode: 'id', value: 12 }), 0)).toBe(12);
	});

	it('getLocatorValue stringifies extracted values', () => {
		expect(getLocatorValue(mockContext({ mode: 'id', value: 9 }), 'folder', 0)).toBe('9');
		expect(getLocatorValue(mockContext(9), 'folder', 0)).toBe('9');
	});
});
