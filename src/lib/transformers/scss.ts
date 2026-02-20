// SCSS Transformer - Generates Primitives.scss and Colors.scss
// Matches the web team's exact existing format, using Figma aliasData to preserve
// semantic → primitive references instead of hardcoding resolved hex values.

import type { TransformResult, FigmaColorExport, FigmaColorToken } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';

interface PrimitiveEntry {
	scssVar: string; // e.g. "$grey-750"
	value: string; // e.g. "#1d1d1d" or "rgba(29, 29, 29, 0.69)"
	family: string; // e.g. "grey" for grouping
	sortKey: number; // for ordering within family
}

interface PrimitiveMap {
	[figmaName: string]: PrimitiveEntry;
}

interface SemanticToken {
	cssVar: string; // e.g. "--text-primary"
	scssVar: string; // e.g. "$text-primary"
	lightPrimitive: string; // e.g. "$grey-750"
	darkPrimitive: string; // e.g. "$grey-50"
	isStatic: boolean; // true = omit light-dark(), just use single value
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate Primitives.scss + Colors.scss from Figma color exports.
 *
 * @param lightColors  Light.tokens.json export
 * @param darkColors   Dark.tokens.json export
 * @param primitives   Optional: _Primitives collection export from Figma.
 *                     When provided, it is used as the source of truth for all primitive values
 *                     (more complete than reconstructing from aliasData).
 *                     When omitted, primitives are reconstructed from the aliasData in the
 *                     semantic token exports.
 */
export function transformToSCSS(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitives?: Record<string, unknown>
): TransformResult[] {
	const primitiveMap = primitives
		? buildPrimitiveMapFromExport(primitives)
		: buildPrimitiveMapFromAliasData(lightColors, darkColors);

	const semanticTokens = buildSemanticTokens(lightColors, darkColors, primitiveMap);

	return [generatePrimitivesScss(primitiveMap), generateColorsScss(semanticTokens)];
}

// ─── Step 1a: Build Primitive Map from a dedicated primitives export ──────────
//
// Expected shape (Figma export of the _Primitives variable collection):
//   { "Colour": { "Grey": { "750": { "$type": "color", "$value": {...} } } } }

function buildPrimitiveMapFromExport(primitivesExport: Record<string, unknown>): PrimitiveMap {
	const map: PrimitiveMap = {};

	// Walk the export, building "Colour/Grey/750" style keys from the path
	walkTokensWithPath(primitivesExport, (path, token) => {
		// Reconstruct the Figma variable name from the path
		// e.g. ["Colour", "Grey", "750"] → "Colour/Grey/750"
		const figmaName = path.join('/');
		const scssVar = figmaNameToScssVar(figmaName);
		const value = resolveColorValue(token);
		if (!scssVar || !value) return;

		const family = extractFamily(scssVar);
		const sortKey = extractSortKey(scssVar);
		map[figmaName] = { scssVar, value, family, sortKey };
	});

	return map;
}

// ─── Step 1b: Reconstruct Primitive Map from aliasData in semantic exports ────
//
// Fallback when no dedicated primitives file is uploaded. Only includes primitives
// that are actually referenced by at least one semantic token.

function buildPrimitiveMapFromAliasData(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport
): PrimitiveMap {
	const map: PrimitiveMap = {};

	function collect(export_: FigmaColorExport) {
		walkTokens(export_, (token) => {
			const figmaName = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
			if (!figmaName || map[figmaName]) return;

			const scssVar = figmaNameToScssVar(figmaName);
			const value = resolveColorValue(token);
			if (!scssVar || !value) return;

			const family = extractFamily(scssVar);
			const sortKey = extractSortKey(scssVar);
			map[figmaName] = { scssVar, value, family, sortKey };
		});
	}

	collect(lightColors);
	collect(darkColors);
	return map;
}

// ─── Step 2: Build Semantic Token List ───────────────────────────────────────

function buildSemanticTokens(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitiveMap: PrimitiveMap
): SemanticToken[] {
	const tokens: SemanticToken[] = [];

	walkTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap[lightFigmaName]?.scssVar;
		if (!lightPrim) return;

		// Match token in dark export
		const darkToken = getTokenAtPath(darkColors, path);
		const darkFigmaName = darkToken?.$extensions?.['com.figma.aliasData']?.targetVariableName;
		const darkPrim = darkFigmaName
			? (primitiveMap[darkFigmaName]?.scssVar ?? lightPrim)
			: lightPrim;

		// Tokens in a "static" path segment are mode-invariant (no light-dark())
		const isStatic = path.some((p) => p.toLowerCase() === 'static');

		const tokenName = pathToTokenName(path);
		tokens.push({
			cssVar: `--${tokenName}`,
			scssVar: `$${tokenName}`,
			lightPrimitive: lightPrim,
			darkPrimitive: darkPrim,
			isStatic
		});
	});

	return tokens;
}

// ─── Step 3: Generate Primitives.scss ────────────────────────────────────────

function generatePrimitivesScss(primitiveMap: PrimitiveMap): TransformResult {
	const lines: string[] = [];
	lines.push('// Primitives.scss');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	// Group by family, then sort
	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of Object.values(primitiveMap)) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}

	const sortedFamilies = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [family, entries] of sortedFamilies) {
		lines.push(`// ${family}`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.scssVar.localeCompare(b.scssVar)
		);
		for (const { scssVar, value } of sorted) {
			lines.push(`${scssVar}: ${value};`);
		}
		lines.push('');
	}

	return {
		filename: 'Primitives.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}

// ─── Step 4: Generate Colors.scss ────────────────────────────────────────────
//
// Output structure (2025 best-practice):
//   1. @property — typed CSS custom properties (enables transitions + browser tooling)
//   2. :root     — sets each token's CSS custom property using light-dark() with SCSS interpolation
//   3. $aliases  — SCSS variable aliases: `$token-name: var(--token-name);`
//
// Why this structure?
//   - @property with syntax:'<color>' makes CSS transitions work on color tokens (e.g. theming fade)
//   - CSS custom properties in :root allow runtime override via JS/CSS cascade
//   - SCSS aliases remain for use inside .scss files — they compile to var(--token-name)
//   - light-dark() (Baseline 2024) is cleaner than prefers-color-scheme media queries

function generateColorsScss(semanticTokens: SemanticToken[]): TransformResult {
	const lines: string[] = [];
	lines.push("@use './Primitives' as *;");
	lines.push('');
	lines.push('// Colors.scss');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	// Group by top-level category (fill, text, icon, background, stroke, …)
	const byCategory = new Map<string, SemanticToken[]>();
	for (const token of semanticTokens) {
		const category = token.scssVar.replace('$', '').split('-')[0];
		const list = byCategory.get(category) ?? [];
		list.push(token);
		byCategory.set(category, list);
	}

	const CATEGORY_ORDER = ['fill', 'text', 'icon', 'background', 'stroke'];
	const orderedCategories = [
		...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
		...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort()
	];

	// ── 1. @property typed declarations ────────────────────────────────────────
	lines.push('// @property typed declarations — enables CSS transitions on color tokens');
	lines.push('// and provides browser DevTools type info. Requires: color-scheme: light dark.');
	for (const category of orderedCategories) {
		lines.push(`// ${capitalize(category)} colors`);
		for (const token of byCategory.get(category)!) {
			lines.push(`@property ${token.cssVar} {`);
			lines.push(`  syntax: '<color>';`);
			lines.push(`  inherits: true;`);
			lines.push(`  initial-value: transparent;`);
			lines.push(`}`);
		}
		lines.push('');
	}

	// ── 2. :root CSS custom property values ────────────────────────────────────
	lines.push(':root {');
	lines.push('  color-scheme: light dark; // enables light-dark() to respect OS preference');
	lines.push('');
	for (const category of orderedCategories) {
		lines.push(`  // ${capitalize(category)} colors`);
		for (const token of byCategory.get(category)!) {
			lines.push(formatCssCustomPropDecl(token));
		}
		lines.push('');
	}
	lines.push('}');
	lines.push('');

	// ── 3. SCSS variable aliases ────────────────────────────────────────────────
	lines.push('// SCSS variable aliases — reference in .scss files; compile to var(--token-name)');
	for (const category of orderedCategories) {
		lines.push(`// ${capitalize(category)} colors`);
		for (const token of byCategory.get(category)!) {
			lines.push(`${token.scssVar}: var(${token.cssVar});`);
		}
		lines.push('');
	}

	return {
		filename: 'Colors.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}

// Format a CSS custom property assignment inside :root.
// Uses SCSS #{} interpolation so SCSS resolves $primitive-var → hex before writing CSS.
//   e.g. --text-primary: light-dark(#{$grey-750}, #{$grey-50});
//   compiles to → --text-primary: light-dark(#1d1d1d, #f5f5f5);
function formatCssCustomPropDecl(token: SemanticToken): string {
	if (token.isStatic) {
		return `  ${token.cssVar}: #{${token.lightPrimitive}};`;
	}
	return `  ${token.cssVar}: light-dark(#{${token.lightPrimitive}}, #{${token.darkPrimitive}});`;
}

// ─── Naming Helpers ───────────────────────────────────────────────────────────

/**
 * Convert a Figma primitive variable name to an SCSS variable
 *
 * "Colour/Grey/750"          → "$grey-750"
 * "Colour/Grey/0"            → "$grey-0"
 * "Colour/Grey_Alpha/750_69" → "$grey-alpha-750-69"
 * "Colour/Red/300"           → "$red-300"
 * "Colour/Orange/OtherOrange"→ "$orange-other-orange"
 *
 * Conversion rules (applied per path segment):
 *   1. Replace underscores with hyphens
 *   2. Insert a hyphen before each uppercase letter that follows a lowercase letter
 *      (handles PascalCase/camelCase e.g. "OtherOrange" → "Other-Orange")
 *   3. Lowercase everything
 */
function figmaNameToScssVar(figmaName: string): string | null {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return null;

	const rest = figmaName.slice('Colour/'.length);
	const parts = rest.split('/');

	const converted = parts.map((p) =>
		p
			.replace(/_/g, '-') // underscores → hyphens
			.replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase → hyphen
			.toLowerCase()
	);

	return '$' + converted.join('-');
}

/**
 * Convert a token path array to a CSS/SCSS name (kebab-case)
 *
 * Rules:
 * - "Standard" segments are dropped (Stroke/Standard/strong → stroke-strong)
 * - All segments are lowercased and space-replaced with hyphens
 *
 * ["Text", "primary"]                → "text-primary"
 * ["Fill", "Component", "primary"]   → "fill-component-primary"
 * ["Stroke", "Standard", "strong"]   → "stroke-strong"
 * ["Fill", "Static", "white"]        → "fill-static-white"
 */
function pathToTokenName(path: string[]): string {
	return path
		.filter((p) => p.toLowerCase() !== 'standard')
		.map((p) => p.toLowerCase().replace(/\s+/g, '-'))
		.join('-');
}

/**
 * Extract the color family from an SCSS variable for grouping
 * "$grey-alpha-750-8" → "grey-alpha"
 * "$red-300"          → "red"
 * "$orange-other-orange" → "orange"
 */
function extractFamily(scssVar: string): string {
	const name = scssVar.slice(1); // strip "$"
	// Take segments until the first numeric or "other" segment
	const parts = name.split('-');
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part) || part === 'other') break;
		familyParts.push(part);
	}
	/* v8 ignore next -- @preserve */
	return familyParts.join('-') || name;
}

/**
 * Extract a numeric sort key from an SCSS var (first numeric segment)
 * "$grey-750" → 750, "$grey-alpha-750-8" → 7500008
 */
function extractSortKey(scssVar: string): number {
	const numbers = scssVar.match(/\d+/g);
	/* v8 ignore next -- @preserve */
	if (!numbers) return 0;
	return numbers.reduce(
		(acc, n, i) => acc + parseInt(n) * Math.pow(1000, Math.max(0, numbers.length - 1 - i)),
		0
	);
}

/** Resolve a Figma color token to a CSS value string */
function resolveColorValue(token: FigmaColorToken): string | null {
	const v = token.$value;
	/* v8 ignore next -- @preserve */
	if (!v || typeof v !== 'object') return null;

	const [r, g, b] = v.components;
	const alpha = parseFloat(v.alpha.toFixed(4));

	if (alpha < 1) {
		return figmaToHex(r, g, b, alpha);
	}
	return v.hex.toLowerCase();
}

// ─── Tree-walking Utilities ───────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any -- generic tree walkers over arbitrary Figma JSON */
function walkTokens(obj: any, fn: (token: FigmaColorToken) => void): void {
	if (!obj || typeof obj !== 'object') return;
	if (obj.$type === 'color') {
		fn(obj);
		return;
	}
	for (const [key, val] of Object.entries(obj)) {
		if (!key.startsWith('$')) walkTokens(val, fn);
	}
}

function walkTokensWithPath(
	obj: any,
	fn: (path: string[], token: FigmaColorToken) => void,
	path: string[] = []
): void {
	/* v8 ignore next -- @preserve */
	if (!obj || typeof obj !== 'object') return;
	if (obj.$type === 'color') {
		fn(path, obj);
		return;
	}
	for (const [key, val] of Object.entries(obj)) {
		/* v8 ignore next -- @preserve */
		if (!key.startsWith('$')) walkTokensWithPath(val, fn, [...path, key]);
	}
}

function getTokenAtPath(obj: any, path: string[]): FigmaColorToken | null {
	let cur = obj;
	for (const key of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = cur[key];
	}
	return cur?.$type === 'color' ? cur : null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
