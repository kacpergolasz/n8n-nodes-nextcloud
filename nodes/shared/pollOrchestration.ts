import type {
	IDataObject,
	INodeExecutionData,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { nodeApiErrorPayload } from './parse';

/** True after a soft-fail notice item was emitted for the current failure window. */
export const POLL_ERROR_NOTICE_SHOWN_KEY = 'pollErrorNoticeShown';

/** Soft-fail behavior once the trigger has completed its first successful seed. */
export type SoftFailPolicy =
	| { mode: 'silent' }
	| {
			mode: 'oneShotNotice';
			staticData: IDataObject;
			/** Defaults to {@link POLL_ERROR_NOTICE_SHOWN_KEY}. */
			noticeKey?: string;
			buildNoticeItem: (scrubbedMessage: string) => IDataObject;
	  };

export function throwPollError(context: IPollFunctions, message: string): never {
	throw new NodeApiError(context.getNode(), nodeApiErrorPayload(message));
}

export function isPollErrorNoticeShown(
	staticData: IDataObject,
	noticeKey: string = POLL_ERROR_NOTICE_SHOWN_KEY,
): boolean {
	return staticData[noticeKey] === true;
}

export function setPollErrorNoticeShown(
	staticData: IDataObject,
	shown: boolean,
	noticeKey: string = POLL_ERROR_NOTICE_SHOWN_KEY,
): void {
	if (shown) {
		staticData[noticeKey] = true;
	} else {
		delete staticData[noticeKey];
	}
}

/** Clear the one-shot notice window after a successful listing. */
export function clearSoftFailNotice(
	staticData: IDataObject,
	noticeKey: string = POLL_ERROR_NOTICE_SHOWN_KEY,
): void {
	setPollErrorNoticeShown(staticData, false, noticeKey);
}

export function pollErrorNoticeItem(message: string): IDataObject {
	return {
		event: 'pollError',
		message,
	};
}

/**
 * Run bootstrap work (credentials, params) and rethrow scrubbed NodeApiError on failure.
 * Pre-initialization errors must fail loudly so activation does not succeed with bad config.
 */
export async function runPollBootstrap<T>(
	context: IPollFunctions,
	bootstrap: () => Promise<T>,
	scrubError: (error: unknown) => string | Promise<string>,
): Promise<T> {
	try {
		return await bootstrap();
	} catch (error) {
		throwPollError(context, await Promise.resolve(scrubError(error)));
	}
}

/**
 * Handle a listing/API failure during poll.
 * Scrubs the error before any log, notice emit, or throw — callers supply app-specific
 * `scrubError` (secrets differ per credential type); this helper owns when scrubbing runs.
 * - Initialized: soft-fail per policy (`silent` → null, `oneShotNotice` → at most one notice).
 * - Not initialized: throw scrubbed NodeApiError (activation must fail loudly).
 */
export function handlePollListingFailure(
	context: IPollFunctions,
	options: {
		isInitialized: boolean;
		error: unknown;
		/** App-specific secret redaction; invoked here before log / notice / throw. */
		scrubError: (error: unknown) => string;
		/** Prefix for the debug log, e.g. `Nextcloud News Trigger`. */
		logLabel: string;
		softFail: SoftFailPolicy;
	},
): INodeExecutionData[][] | null {
	const { isInitialized, error, scrubError, logLabel, softFail } = options;
	const scrubbedMessage = scrubError(error);

	if (!isInitialized) {
		throwPollError(context, scrubbedMessage);
	}

	context.logger.debug(
		`${logLabel}: listing failed after initialization; soft-failing poll (${scrubbedMessage})`,
	);

	if (softFail.mode === 'silent') {
		return null;
	}

	const noticeKey = softFail.noticeKey ?? POLL_ERROR_NOTICE_SHOWN_KEY;
	if (isPollErrorNoticeShown(softFail.staticData, noticeKey)) {
		return null;
	}

	setPollErrorNoticeShown(softFail.staticData, true, noticeKey);
	return [
		context.helpers.returnJsonArray([softFail.buildNoticeItem(scrubbedMessage)]),
	];
}

/**
 * Manual / Test step: return one sample item, or null when nothing matches.
 * Never throws — a thrown poll error can deregister crons on some n8n versions.
 */
export function returnManualSampleOrNull(
	context: IPollFunctions,
	sampleJson: IDataObject | undefined,
	unavailableDebugMessage: string,
): INodeExecutionData[][] | null {
	if (!sampleJson) {
		context.logger.debug(unavailableDebugMessage);
		return null;
	}

	return [context.helpers.returnJsonArray([sampleJson])];
}
