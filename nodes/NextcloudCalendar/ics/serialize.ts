import type { IcsComponent, IcsParam, IcsProperty } from './types';

const FOLD_OCTETS = 75;

function utf8OctetLength(s: string): number {
	return new TextEncoder().encode(s).length;
}

/** RFC 5545 §3.1: fold lines longer than 75 octets with CRLF + single space. */
export function foldIcsLine(line: string, maxOctets = FOLD_OCTETS): string {
	if (utf8OctetLength(line) <= maxOctets) return line;

	const parts: string[] = [];
	let current = '';
	let limit = maxOctets;

	for (const ch of line) {
		const next = current + ch;
		if (utf8OctetLength(next) > limit) {
			parts.push(current);
			current = ch;
			limit = maxOctets - 1;
		} else {
			current = next;
		}
	}
	if (current) parts.push(current);
	return parts.join('\r\n ');
}

function formatParams(params: IcsParam[]): string {
	if (params.length === 0) return '';
	return (
		';' +
		params.map((p) => (p.value === undefined ? p.name : `${p.name}=${p.value}`)).join(';')
	);
}

function formatProperty(prop: IcsProperty): string {
	return foldIcsLine(`${prop.name}${formatParams(prop.params)}:${prop.value}`);
}

function serializeComponent(component: IcsComponent): string[] {
	const lines: string[] = [];
	lines.push(foldIcsLine(`BEGIN:${component.name}`));
	for (const prop of component.properties) {
		lines.push(formatProperty(prop));
	}
	for (const child of component.components) {
		lines.push(...serializeComponent(child));
	}
	lines.push(foldIcsLine(`END:${component.name}`));
	return lines;
}

/** Serialize an ICS AST to a folded CRLF document. */
export function serializeIcs(component: IcsComponent): string {
	if (component.name === 'ROOT') {
		const chunks: string[] = [];
		for (const child of component.components) {
			chunks.push(...serializeComponent(child));
		}
		for (const prop of component.properties) {
			chunks.push(formatProperty(prop));
		}
		return chunks.join('\r\n');
	}
	return serializeComponent(component).join('\r\n');
}
