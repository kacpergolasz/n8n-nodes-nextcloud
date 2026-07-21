import type { IDataObject, INodeExecutionData, IPollFunctions } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	POLL_ERROR_NOTICE_SHOWN_KEY,
	clearSoftFailNotice,
	handlePollListingFailure,
	isPollErrorNoticeShown,
	pollErrorNoticeItem,
	returnManualSampleOrNull,
	runPollBootstrap,
	setPollErrorNoticeShown,
	throwPollError,
} from '../pollOrchestration';

function createPollContext(
	overrides: {
		debug?: ReturnType<typeof vi.fn>;
		returnJsonArray?: ReturnType<typeof vi.fn>;
	} = {},
): IPollFunctions {
	const debug = overrides.debug ?? vi.fn();
	const returnJsonArray =
		overrides.returnJsonArray ??
		vi.fn((items: IDataObject[]) => items.map((json) => ({ json }) as INodeExecutionData));

	return {
		getNode: () => ({ name: 'Test Trigger' }) as ReturnType<IPollFunctions['getNode']>,
		logger: { debug } as IPollFunctions['logger'],
		helpers: { returnJsonArray } as IPollFunctions['helpers'],
	} as IPollFunctions;
}

describe('pollOrchestration', () => {
	describe('throwPollError / runPollBootstrap', () => {
		it('rethrows bootstrap failures as scrubbed NodeApiError', async () => {
			const context = createPollContext();

			await expect(
				runPollBootstrap(
					context,
					async () => {
						throw new Error('raw secret-token');
					},
					(error) => String(error).replace('secret-token', '[REDACTED]'),
				),
			).rejects.toBeInstanceOf(NodeApiError);

			await expect(
				runPollBootstrap(
					context,
					async () => {
						throw new Error('raw secret-token');
					},
					(error) => String(error).replace('secret-token', '[REDACTED]'),
				),
			).rejects.toThrow(/\[REDACTED\]/);
		});

		it('returns bootstrap result on success', async () => {
			const context = createPollContext();
			const result = await runPollBootstrap(
				context,
				async () => ({ ok: true }),
				() => 'unused',
			);
			expect(result).toEqual({ ok: true });
		});

		it('throwPollError wraps the message in NodeApiError', () => {
			const context = createPollContext();
			expect(() => throwPollError(context, 'boom')).toThrow(NodeApiError);
			expect(() => throwPollError(context, 'boom')).toThrow(/boom/);
		});
	});

	describe('handlePollListingFailure', () => {
		const scrubSecret = (error: unknown) =>
			String(error instanceof Error ? error.message : error).replace(
				'secret-token',
				'[REDACTED]',
			);

		it('throws when not initialized, after scrubbing', () => {
			const context = createPollContext();
			expect(() =>
				handlePollListingFailure(context, {
					isInitialized: false,
					error: new Error('pre-init secret-token'),
					scrubError: scrubSecret,
					logLabel: 'Test Trigger',
					softFail: { mode: 'silent' },
				}),
			).toThrow(/\[REDACTED\]/);
			expect(() =>
				handlePollListingFailure(context, {
					isInitialized: false,
					error: new Error('pre-init secret-token'),
					scrubError: scrubSecret,
					logLabel: 'Test Trigger',
					softFail: { mode: 'silent' },
				}),
			).not.toThrow(/secret-token/);
		});

		it('returns null for silent soft-fail after init and logs scrubbed message', () => {
			const debug = vi.fn();
			const context = createPollContext({ debug });
			const result = handlePollListingFailure(context, {
				isInitialized: true,
				error: new Error('transient secret-token'),
				scrubError: scrubSecret,
				logLabel: 'Test Trigger',
				softFail: { mode: 'silent' },
			});

			expect(result).toBeNull();
			expect(debug).toHaveBeenCalledWith(
				expect.stringContaining('soft-failing poll (transient [REDACTED])'),
			);
			expect(String(debug.mock.calls[0]?.[0] ?? '')).not.toContain('secret-token');
		});

		it('emits one scrubbed notice then null on repeated oneShotNotice soft-fail', () => {
			const staticData: IDataObject = {};
			const context = createPollContext();

			const first = handlePollListingFailure(context, {
				isInitialized: true,
				error: new Error('down secret-token'),
				scrubError: scrubSecret,
				logLabel: 'Test Trigger',
				softFail: {
					mode: 'oneShotNotice',
					staticData,
					buildNoticeItem: pollErrorNoticeItem,
				},
			});

			expect(first?.[0]?.[0]?.json).toEqual({
				event: 'pollError',
				message: 'down [REDACTED]',
			});
			expect(isPollErrorNoticeShown(staticData)).toBe(true);

			const second = handlePollListingFailure(context, {
				isInitialized: true,
				error: new Error('still down secret-token'),
				scrubError: scrubSecret,
				logLabel: 'Test Trigger',
				softFail: {
					mode: 'oneShotNotice',
					staticData,
					buildNoticeItem: pollErrorNoticeItem,
				},
			});

			expect(second).toBeNull();
		});
	});

	describe('notice flag helpers', () => {
		it('set / clear notice shown flag', () => {
			const staticData: IDataObject = {};
			setPollErrorNoticeShown(staticData, true);
			expect(staticData[POLL_ERROR_NOTICE_SHOWN_KEY]).toBe(true);
			clearSoftFailNotice(staticData);
			expect(staticData[POLL_ERROR_NOTICE_SHOWN_KEY]).toBeUndefined();
		});
	});

	describe('returnManualSampleOrNull', () => {
		it('returns null and logs when sample is missing', () => {
			const debug = vi.fn();
			const context = createPollContext({ debug });
			expect(
				returnManualSampleOrNull(context, undefined, 'no sample available'),
			).toBeNull();
			expect(debug).toHaveBeenCalledWith('no sample available');
		});

		it('returns a single-item array when sample exists', () => {
			const returnJsonArray = vi.fn((items: IDataObject[]) =>
				items.map((json) => ({ json }) as INodeExecutionData),
			);
			const context = createPollContext({ returnJsonArray });
			const result = returnManualSampleOrNull(context, { id: 1 }, 'unused');

			expect(returnJsonArray).toHaveBeenCalledWith([{ id: 1 }]);
			expect(result).toEqual([[{ json: { id: 1 } }]]);
		});
	});
});
