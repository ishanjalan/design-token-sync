import { buildTokenGraph, resolveToken } from './resolve-tokens.js';

export interface DuplicateGroup {
	value: string;
	tokens: string[];
}

export function detectDuplicateValues(
	tokens: Record<string, unknown>,
	allTokens?: Record<string, unknown>
): DuplicateGroup[] {
	const valueMap = new Map<string, string[]>();
	const source = allTokens ?? tokens;
	const graph = buildTokenGraph(source);

	function walk(obj: Record<string, unknown>, prefix: string) {
		for (const [key, val] of Object.entries(obj)) {
			const path = prefix ? `${prefix}/${key}` : key;
			if (val && typeof val === 'object' && !Array.isArray(val)) {
				const rec = val as Record<string, unknown>;
				if (rec.$type === 'color' && rec.$value) {
					const resolved = resolveToken(path, graph);
					const resolvedValue = resolved?.value ?? rec.$value;
					const resolvedStr =
						typeof resolvedValue === 'string' ? resolvedValue : JSON.stringify(resolvedValue);
					const existing = valueMap.get(resolvedStr) ?? [];
					existing.push(path);
					valueMap.set(resolvedStr, existing);
				} else {
					walk(rec, path);
				}
			}
		}
	}

	walk(tokens, '');

	return Array.from(valueMap.entries())
		.filter(([, names]) => names.length >= 2)
		.map(([value, tokenNames]) => ({ value, tokens: tokenNames }))
		.sort((a, b) => b.tokens.length - a.tokens.length);
}
