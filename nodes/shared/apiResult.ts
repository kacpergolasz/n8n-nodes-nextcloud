/**
 * Suite-wide helpers for API repository results.
 *
 * `Maybe<T>` is the declarative result of every API operation: a call either
 * succeeds with the parsed, schema-validated response or fails with an Error —
 * it never throws. `parseWith` validates a successful client response against
 * a zod schema; `parseEmpty` accepts responses without a documented body.
 */
import { z } from 'zod';

export type Maybe<T> =
	| {
			success: true;
			response: T;
	  }
	| {
			success: false;
			error: Error;
	  };

const emptyResponseSchema = z.union([z.undefined(), z.record(z.unknown())]);

export function parseWith<S extends z.ZodTypeAny>(
	result: Maybe<unknown>,
	schema: S,
): Maybe<z.output<S>> {
	if (!result.success) {
		return result;
	}
	try {
		const parsed: z.output<S> = schema.parse(result.response);
		return { success: true, response: parsed };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function parseEmpty(result: Maybe<unknown>): Maybe<null> {
	if (!result.success) {
		return result;
	}
	try {
		emptyResponseSchema.parse(result.response);
		return { success: true, response: null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Unwrap a repository result at the resource layer. Repositories never throw;
 * resources throw the wrapped Error so node-level error handling applies.
 */
export function unwrapResult<T>(result: Maybe<T>): T {
	if (!result.success) {
		throw result.error;
	}
	return result.response;
}
