/**
 * CSS Custom Properties Transformer
 *
 * Generates pure CSS files using custom properties (no SCSS).
 * Produces: primitives.css, colors.css, spacing.css
 *
 * Uses `light-dark()` for themed tokens (Baseline 2024).
 */

import type { FigmaColorExport, FigmaColorToken, TransformResult } from '$lib/types.js';
import type { DetectedConventions } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';

interface PrimitiveEntry {
	cssVar: string;
	value: string;
	family: string;
	sortKey: number;
}

interface SemanticEntry {
	cssVar: string;
	lightValue: string;
	darkValue: string;
	isStatic: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToCSS(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	_conventions: DetectedConventions,
	values?: Record<string, unknown>
): TransformResult[] {
	const primitiveMap = buildPrimitiveMap(lightColors, darkColors);
	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap);
	const results: TransformResult[] = [
		generatePrimitivesCSS(primitiveMap),
		generateColorsCSS(semanticEntries)
	];

	if (values) {
		const spacingResult = generateSpacingCSS(values);
		if (spacingResult) results.push(spacingResult);
	}

	return results;
}

// ─── Primitive Map ────────────────────────────────────────────────────────────

function buildPrimitiveMap(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport
): Map<string, PrimitiveEntry> {
	const map = new Map<string, PrimitiveEntry>();

	function collect(exp: FigmaColorExport) {
		walkTokens(exp, (token) => {
			const figmaName = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
			if (!figmaName || map.has(figmaName)) return;

			const cssVar = figmaNameToCssVar(figmaName);
			const value = resolveColorValue(token);
			if (!cssVar || !value) return;

			map.set(figmaName, {
				cssVar,
				value,
				family: extractFamily(cssVar),
				sortKey: extractSortKey(cssVar)
			});
		});
	}

	collect(lightColors);
	collect(darkColors);
	return map;
}

// ─── Semantic Entries ─────────────────────────────────────────────────────────

function buildSemanticEntries(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitiveMap: Map<string, PrimitiveEntry>
): SemanticEntry[] {
	const entries: SemanticEntry[] = [];

	walkTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap.get(lightFigmaName);
		if (!lightPrim) return;

		const darkToken = getTokenAtPath(darkColors, path);
		const darkFigmaName = darkToken?.$extensions?.['com.figma.aliasData']?.targetVariableName;
		const darkPrim = darkFigmaName ? (primitiveMap.get(darkFigmaName) ?? lightPrim) : lightPrim;

		const isStatic = path.some((p) => p.toLowerCase() === 'static');
		const tokenName = pathToTokenName(path);

		entries.push({
			cssVar: `--${tokenName}`,
			lightValue: `var(${lightPrim.cssVar})`,
			darkValue: `var(${darkPrim.cssVar})`,
			isStatic
		});
	});

	return entries;
}

// ─── Generate primitives.css ──────────────────────────────────────────────────

function generatePrimitivesCSS(primitiveMap: Map<string, PrimitiveEntry>): TransformResult {
	const lines: string[] = [
		'/* primitives.css */',
		'/* Auto-generated from Figma Variables — DO NOT EDIT */',
		`/* Generated: ${new Date().toISOString()} */`,
		'',
		':root {'
	];

	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of primitiveMap.values()) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}

	const sortedFamilies = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [family, entries] of sortedFamilies) {
		lines.push(`  /* ${family} */`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.cssVar.localeCompare(b.cssVar)
		);
		for (const { cssVar, value } of sorted) {
			lines.push(`  ${cssVar}: ${value};`);
		}
	}

	lines.push('}');
	lines.push('');

	return {
		filename: 'primitives.css',
		content: lines.join('\n') + '\n',
		format: 'css',
		platform: 'web'
	};
}

// ─── Generate colors.css ──────────────────────────────────────────────────────

function generateColorsCSS(entries: SemanticEntry[]): TransformResult {
	const lines: string[] = [
		'/* colors.css */',
		'/* Auto-generated from Figma Variables — DO NOT EDIT */',
		`/* Generated: ${new Date().toISOString()} */`,
		'',
		':root {',
		'  color-scheme: light dark;',
		''
	];

	const byCategory = new Map<string, SemanticEntry[]>();
	for (const entry of entries) {
		const category = entry.cssVar.replace('--', '').split('-')[0];
		const list = byCategory.get(category) ?? [];
		list.push(entry);
		byCategory.set(category, list);
	}

	const CATEGORY_ORDER = ['fill', 'text', 'icon', 'background', 'stroke'];
	const orderedCategories = [
		...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
		...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort()
	];

	for (const category of orderedCategories) {
		lines.push(`  /* ${capitalize(category)} */`);
		for (const entry of byCategory.get(category)!) {
			if (entry.isStatic) {
				lines.push(`  ${entry.cssVar}: ${entry.lightValue};`);
			} else {
				lines.push(`  ${entry.cssVar}: light-dark(${entry.lightValue}, ${entry.darkValue});`);
			}
		}
	}

	lines.push('}');
	lines.push('');

	return {
		filename: 'colors.css',
		content: lines.join('\n') + '\n',
		format: 'css',
		platform: 'web'
	};
}

// ─── Generate spacing.css ─────────────────────────────────────────────────────

function generateSpacingCSS(valuesExport: Record<string, unknown>): TransformResult | null {
	const integers = valuesExport['Integer'];
	if (!integers || typeof integers !== 'object') return null;

	const entries: { cssVar: string; value: string; sortKey: number }[] = [];

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

		entries.push({ cssVar, value: `${raw}px`, sortKey: raw });
	}

	if (entries.length === 0) return null;

	entries.sort((a, b) => a.sortKey - b.sortKey);

	const lines: string[] = [
		'/* spacing.css */',
		'/* Auto-generated from Figma Variables — DO NOT EDIT */',
		`/* Generated: ${new Date().toISOString()} */`,
		'',
		':root {'
	];

	for (const { cssVar, value } of entries) {
		lines.push(`  ${cssVar}: ${value};`);
	}
	lines.push('}');
	lines.push('');

	return {
		filename: 'spacing.css',
		content: lines.join('\n') + '\n',
		format: 'css',
		platform: 'web'
	};
}

// ─── Naming Helpers ───────────────────────────────────────────────────────────

function figmaNameToCssVar(figmaName: string): string | null {
	if (!figmaName.startsWith('Colour/')) return null;
	const rest = figmaName.slice('Colour/'.length);
	const parts = rest.split('/');
	const converted = parts.map((p) =>
		p
			.replace(/_/g, '-')
			.replace(/([a-z])([A-Z])/g, '$1-$2')
			.toLowerCase()
	);
	return '--' + converted.join('-');
}

function pathToTokenName(path: string[]): string {
	return path
		.filter((p) => p.toLowerCase() !== 'standard')
		.map((p) => p.toLowerCase().replace(/\s+/g, '-'))
		.join('-');
}

function extractFamily(cssVar: string): string {
	const name = cssVar.slice(2); // strip "--"
	const parts = name.split('-');
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part) || part === 'other') break;
		familyParts.push(part);
	}
	return familyParts.join('-') || name;
}

function extractSortKey(cssVar: string): number {
	const numbers = cssVar.match(/\d+/g);
	if (!numbers) return 0;
	return numbers.reduce(
		(acc, n, i) => acc + parseInt(n) * Math.pow(1000, Math.max(0, numbers.length - 1 - i)),
		0
	);
}

function resolveColorValue(token: FigmaColorToken): string | null {
	const v = token.$value;
	if (!v || typeof v !== 'object') return null;
	const [r, g, b] = v.components;
	const alpha = parseFloat(v.alpha.toFixed(4));
	if (alpha < 1) return figmaToHex(r, g, b, alpha);
	return v.hex.toLowerCase();
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Tree-walking Utilities ───────────────────────────────────────────────────

function walkTokens(obj: unknown, fn: (token: FigmaColorToken) => void): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(o as unknown as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkTokens(val, fn);
	}
}

function walkTokensWithPath(
	obj: unknown,
	fn: (path: string[], token: FigmaColorToken) => void,
	path: string[] = []
): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(path, o as unknown as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkTokensWithPath(val, fn, [...path, key]);
	}
}

function getTokenAtPath(obj: unknown, path: string[]): FigmaColorToken | null {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = (cur as Record<string, unknown>)[key];
	}
	if (!cur || typeof cur !== 'object') return null;
	const o = cur as Record<string, unknown>;
	return o.$type === 'color' ? (o as unknown as FigmaColorToken) : null;
}
