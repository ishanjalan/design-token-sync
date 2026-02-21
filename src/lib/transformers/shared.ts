/**
 * Shared utilities for all transformers.
 *
 * Centralizes tree walkers, type guards, naming helpers, and composite token
 * utilities used by color transformers (scss, ts-web, css, swift, kotlin) and
 * composite transformers (shadow, border, opacity).
 */

import type { FigmaColorToken } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';

// ─── Tree Walkers (color-specific) ───────────────────────────────────────────

/** Walk all color tokens in a tree (flat, no path). */
export function walkColorTokens(obj: unknown, fn: (token: FigmaColorToken) => void): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(o as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkColorTokens(val, fn);
	}
}

/** Walk color tokens with path. */
export function walkColorTokensWithPath(
	obj: unknown,
	fn: (path: string[], token: FigmaColorToken) => void,
	path: string[] = []
): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(path, o as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkColorTokensWithPath(val, fn, [...path, key]);
	}
}

/** Get color token at specific path. */
export function getColorTokenAtPath(obj: unknown, path: string[]): FigmaColorToken | null {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = (cur as Record<string, unknown>)[key];
	}
	if (!cur || typeof cur !== 'object') return null;
	const o = cur as Record<string, unknown>;
	return o.$type === 'color' ? (o as FigmaColorToken) : null;
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

export function isFigmaColorToken(obj: unknown): obj is FigmaColorToken {
	if (!obj || typeof obj !== 'object') return false;
	const o = obj as Record<string, unknown>;
	return o.$type === 'color' && o.$value !== undefined && typeof o.$value === 'object';
}

// ─── Naming Helpers (color transformers) ───────────────────────────────────────

/** Convert Figma name segments to kebab (with separator support). */
export function figmaSegmentsToKebab(segments: string[]): string {
	return segments
		.map((p) =>
			p
				.replace(/_/g, '-')
				.replace(/([a-z])([A-Z])/g, '$1-$2')
				.toLowerCase()
		)
		.join('-');
}

/** Path to token name (kebab-case, drops "Standard"). */
export function pathToTokenName(path: string[], sep: string = '-'): string {
	return path
		.filter((p) => p.toLowerCase() !== 'standard')
		.map((p) => p.toLowerCase().replace(/\s+/g, sep))
		.join(sep);
}

/** Extract sort key from a var name. */
export function extractSortKey(name: string): number {
	const numbers = name.match(/\d+/g);
	if (!numbers) return 0;
	return numbers.reduce(
		(acc, n, i) => acc + parseInt(n) * Math.pow(1000, Math.max(0, numbers.length - 1 - i)),
		0
	);
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert Figma color token to CSS hex/rgba value. */
export function resolveColorValue(token: FigmaColorToken): string | null {
	const v = token.$value;
	if (!v || typeof v !== 'object') return null;
	const [r, g, b] = v.components;
	const alpha = parseFloat(v.alpha.toFixed(4));
	if (alpha < 1) return figmaToHex(r, g, b, alpha);
	return v.hex.toLowerCase();
}

/** Category ordering constant. */
export const CATEGORY_ORDER = ['fill', 'text', 'icon', 'background', 'stroke'] as const;

/** Order categories with the standard order first, then sorted alphabetical rest. */
export function orderCategories(categories: Iterable<string>): string[] {
	const catSet = new Set(categories);
	return [
		...CATEGORY_ORDER.filter((c) => catSet.has(c)),
		...[...catSet].filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c)).sort()
	];
}

// ─── Composite Token Helpers (shadow, border, opacity) ─────────────────────────

/** Path to kebab-case name. */
export function pathToKebab(path: string[]): string {
	return path
		.map((p) =>
			p
				.replace(/_/g, '-')
				.replace(/([a-z])([A-Z])/g, '$1-$2')
				.toLowerCase()
		)
		.join('-');
}

/** Path to camelCase name. */
export function pathToCamel(path: string[]): string {
	const kebab = pathToKebab(path);
	return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Path to PascalCase name. */
export function pathToPascal(path: string[]): string {
	const camel = pathToCamel(path);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** Extract first numeric value from a string. */
export function extractNumericKey(s: string): number {
	const m = s.match(/\d+/);
	return m ? parseInt(m[0]) : 0;
}

// ─── Spacing Helpers ──────────────────────────────────────────────────────────

export interface RawSpacingEntry {
	key: string;
	rawValue: number;
	cssVar: string;
	pxValue: string;
}

/**
 * Parse the Integer section of a Figma values export into spacing entries.
 * Shared between spacing.ts (SCSS/TS) and css.ts (pure CSS).
 */
export function collectSpacingEntries(valuesExport: Record<string, unknown>): RawSpacingEntry[] {
	const integers = valuesExport['Integer'];
	if (!integers || typeof integers !== 'object') return [];

	const entries: RawSpacingEntry[] = [];

	for (const [key, token] of Object.entries(integers as Record<string, unknown>)) {
		if (key.startsWith('$')) continue;
		if (!token || typeof token !== 'object') continue;
		const t = token as Record<string, unknown>;
		if (t.$type !== 'number' || typeof t.$value !== 'number') continue;

		const raw = t.$value as number;
		const cssVar =
			key === '999'
				? '--spacing-max'
				: raw < 0
					? `--spacing-neg-${Math.abs(raw)}`
					: `--spacing-${raw}`;
		const pxValue = `${raw}px`;

		entries.push({ key, rawValue: raw, cssVar, pxValue });
	}

	return entries.sort((a, b) => a.rawValue - b.rawValue);
}
