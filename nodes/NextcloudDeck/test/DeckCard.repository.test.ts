import type { DeckClient } from '../deck.client';
import { deckCardSchema, getCard, reorderCard } from '../repositories/DeckCard.repository';

const liveCard = {
	id: 78,
	title: 'tz4',
	description: '',
	stackId: 16,
	type: 'plain',
	owner: { primaryKey: 'test', uid: 'test', displayname: 'Test' },
	order: 0,
	archived: false,
	duedate: '2023-06-06T06:15:30+02:00',
	labels: null,
	assignedUsers: null,
	attachments: null,
	attachmentCount: null,
	commentsUnread: 0,
	overdue: 0,
	createdAt: 1686024933,
	lastModified: 1686024933,
	deletedAt: 0,
	lastEditor: null,
	commentsCount: 0,
};

describe('deckCardSchema', () => {
	it('accepts live GET payloads with extra keys and object owners', () => {
		expect(deckCardSchema.parse(liveCard)).toMatchObject({
			id: 78,
			owner: { uid: 'test' },
			lastEditor: null,
			commentsCount: 0,
		});
	});

	it('accepts CardAssignment-shaped assignedUsers', () => {
		expect(
			deckCardSchema.parse({
				...liveCard,
				assignedUsers: [
					{
						id: 70,
						participant: { primaryKey: 'alice', uid: 'alice', displayname: 'Alice' },
						cardId: 78,
					},
				],
			}),
		).toMatchObject({
			assignedUsers: [{ participant: { uid: 'alice' } }],
		});
	});
});

describe('reorderCard', () => {
	it('puts the destination stack id in the URL path', async () => {
		const client = {
			put: vi.fn(async () => ({ success: true as const, response: undefined })),
		};

		await reorderCard(client as unknown as DeckClient, {
			boardId: 1,
			stackId: 37,
			cardId: 99,
			order: 0,
		});

		expect(client.put).toHaveBeenCalledWith('/boards/1/stacks/37/cards/99/reorder', {
			order: 0,
			stackId: 37,
		});
	});
});

describe('getCard', () => {
	it('parses a successful GET that includes undocumented card keys', async () => {
		const client = {
			get: vi.fn(async () => ({ success: true as const, response: liveCard })),
		};

		const result = await getCard(client as unknown as DeckClient, {
			boardId: 1,
			stackId: 16,
			cardId: 78,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response.id).toBe(78);
			expect(result.response).toMatchObject({ commentsCount: 0 });
		}
	});
});
