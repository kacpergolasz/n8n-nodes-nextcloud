import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

import type { DeckClient } from '../../deck.client';
import { resolveBoardId, resolveStackId } from '../../GenericFunctions';
import { getStacks } from '../../repositories/DeckStack.repository';
import { unwrapResult } from '../../../shared/apiResult';

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

/**
 * Locate the stack that owns a card by scanning the board stacks payload.
 * Card paths are stack-scoped, so operations need the parent stack id first.
 */
export async function resolveCardStackId(
	client: DeckClient,
	boardId: number,
	cardId: string,
): Promise<number> {
	const stacks = unwrapResult(await getStacks(client, { boardId }));
	for (const stack of stacks) {
		const match = (stack.cards ?? []).find((card) => String(card.id) === cardId);
		if (match) {
			return match.stackId;
		}
	}
	throw new Error(`Card ${cardId} was not found on board ${boardId}.`);
}
