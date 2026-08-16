import { z } from 'zod';

import { isPlainObject, throwParseError } from '../shared/parse';

// Schemas for node UI "Additional Fields" inputs. API response entities are
// validated strictly by their repositories (`DeckBoard.repository.ts`,
// `DeckCard.repository.ts`, `DeckStack.repository.ts`) and must not be
// re-declared here.
const boardAdditionalFieldsSchema = z
	.object({
		archived: z.boolean().optional(),
	})
	.passthrough();

const cardAdditionalFieldsSchema = z
	.object({
		clearDueDate: z.boolean().optional(),
	})
	.passthrough();

export function parseBoardAdditionalFields(raw: unknown): { archived?: boolean } {
	if (!isPlainObject(raw)) {
		return {};
	}
	try {
		const parsed = boardAdditionalFieldsSchema.parse(raw);
		return typeof parsed.archived === 'boolean' ? { archived: parsed.archived } : {};
	} catch (error) {
		throwParseError(error, 'Invalid board additional fields');
	}
}

export function parseCardAdditionalFields(raw: unknown): { clearDueDate?: boolean } {
	if (!isPlainObject(raw)) {
		return {};
	}
	try {
		const parsed = cardAdditionalFieldsSchema.parse(raw);
		return typeof parsed.clearDueDate === 'boolean' ? { clearDueDate: parsed.clearDueDate } : {};
	} catch (error) {
		throwParseError(error, 'Invalid card additional fields');
	}
}