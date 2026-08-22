import type { DeckClient } from '../deck.client';
import { createStack, deckStackSchema } from '../repositories/DeckStack.repository';

const liveCreateStackWithoutCards = {
	id: 3,
	title: 'To do',
	boardId: 12,
	order: 0,
	deletedAt: 0,
	lastModified: 1627986420,
};

describe('deckStackSchema', () => {
	it('defaults missing cards to [] on stack create payloads', () => {
		expect(deckStackSchema.parse(liveCreateStackWithoutCards)).toMatchObject({
			id: 3,
			title: 'To do',
			cards: [],
		});
	});

	it('accepts embedded cards when present', () => {
		expect(
			deckStackSchema.parse({
				...liveCreateStackWithoutCards,
				cards: [],
			}),
		).toMatchObject({ cards: [] });
	});
});

describe('createStack', () => {
	it('parses a successful POST that omits cards', async () => {
		const client = {
			post: vi.fn(async () => ({
				success: true as const,
				response: liveCreateStackWithoutCards,
			})),
		};

		const result = await createStack(client as unknown as DeckClient, {
			boardId: 12,
			title: 'To do',
			order: 0,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response.cards).toEqual([]);
		}
	});
});
