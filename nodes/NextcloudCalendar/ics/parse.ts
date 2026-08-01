import { unfoldIcsContent } from './dates';
import type { IcsComponent, IcsParam, IcsProperty } from './types';

function parseParams(paramSegment: string): IcsParam[] {
	if (!paramSegment) return [];
	const params: IcsParam[] = [];
	// Split on `;` outside quotes
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < paramSegment.length; i++) {
		const ch = paramSegment[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
			continue;
		}
		if (ch === ';' && !inQuotes) {
			if (current) params.push(parseOneParam(current));
			current = '';
			continue;
		}
		current += ch;
	}
	if (current) params.push(parseOneParam(current));
	return params;
}

function parseOneParam(raw: string): IcsParam {
	const eq = raw.indexOf('=');
	if (eq === -1) return { name: raw };
	return { name: raw.slice(0, eq), value: raw.slice(eq + 1) };
}

function parsePropertyLine(line: string): IcsProperty {
	let colon = -1;
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') inQuotes = !inQuotes;
		if (ch === ':' && !inQuotes) {
			colon = i;
			break;
		}
	}
	if (colon === -1) {
		return { name: line, params: [], value: '' };
	}

	const lhs = line.slice(0, colon);
	const value = line.slice(colon + 1);
	const semi = lhs.indexOf(';');
	const name = semi === -1 ? lhs : lhs.slice(0, semi);
	const paramSegment = semi === -1 ? '' : lhs.slice(semi + 1);
	return {
		name,
		params: parseParams(paramSegment),
		value,
	};
}

/**
 * Parse an ICS document into an ordered component tree.
 * Preserves unknown properties, X-*, nested VALARM, sibling VTIMEZONE, etc.
 */
export function parseIcs(raw: string): IcsComponent {
	const unfolded = unfoldIcsContent(raw.trim());
	const lines = unfolded.split(/\r?\n/).filter((l) => l.length > 0);

	const root: IcsComponent = { name: 'ROOT', properties: [], components: [] };
	const stack: IcsComponent[] = [root];

	for (const line of lines) {
		const upper = line.toUpperCase();
		if (upper.startsWith('BEGIN:')) {
			const name = line.slice(6).trim();
			const component: IcsComponent = { name, properties: [], components: [] };
			stack[stack.length - 1].components.push(component);
			stack.push(component);
			continue;
		}
		if (upper.startsWith('END:')) {
			if (stack.length > 1) stack.pop();
			continue;
		}
		stack[stack.length - 1].properties.push(parsePropertyLine(line));
	}

	if (root.components.length === 1 && root.properties.length === 0) {
		return root.components[0];
	}
	return root;
}

/** First VEVENT under a VCALENDAR (or the component itself if it is a VEVENT). */
export function findFirstVEvent(calendar: IcsComponent): IcsComponent | undefined {
	if (calendar.name.toUpperCase() === 'VEVENT') return calendar;
	for (const child of calendar.components) {
		if (child.name.toUpperCase() === 'VEVENT') return child;
		const nested = findFirstVEvent(child);
		if (nested) return nested;
	}
	return undefined;
}
