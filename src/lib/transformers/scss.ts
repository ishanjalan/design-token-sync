// SCSS Transformer - Generates Primitives.scss and Colors.scss
// Matches the web team's exact existing format, using Figma aliasData to preserve
// semantic → primitive references instead of hardcoding resolved hex values.

import type { TransformResult, FigmaColorExport, DetectedConventions } from '$lib/types.js';
import { BEST_PRACTICE_WEB_CONVENTIONS } from '$lib/types.js';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	pathToTokenName,
	extractSortKey,
	resolveColorValue,
	capitalize,
	orderCategories
} from './shared.js';

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
	conventions: DetectedConventions = BEST_PRACTICE_WEB_CONVENTIONS,
	primitives?: Record<string, unknown>
): TransformResult[] {
	const sep = conventions.scssSeparator === 'underscore' ? '_' : '-';
	const primitiveMap = primitives
		? buildPrimitiveMapFromExport(primitives, sep)
		: buildPrimitiveMapFromAliasData(lightColors, darkColors, sep);

	const semanticTokens = buildSemanticEntries(lightColors, darkColors, primitiveMap, sep);

	return [generatePrimitivesScss(primitiveMap, sep), generateColorsScss(semanticTokens, conventions)];
}

// ─── Step 1a: Build Primitive Map from a dedicated primitives export ──────────
//
// Expected shape (Figma export of the _Primitives variable collection):
//   { "Colour": { "Grey": { "750": { "$type": "color", "$value": {...} } } } }

function buildPrimitiveMapFromExport(primitivesExport: Record<string, unknown>, sep: string): PrimitiveMap {
	const map: PrimitiveMap = {};

	walkColorTokensWithPath(primitivesExport, (path, token) => {
		const figmaName = path.join('/');
		const scssVar = figmaNameToScssVar(figmaName, sep);
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
	darkColors: FigmaColorExport,
	sep: string
): PrimitiveMap {
	const map: PrimitiveMap = {};

	function collect(export_: FigmaColorExport) {
		walkColorTokens(export_, (token) => {
			const figmaName = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
			if (!figmaName || map[figmaName]) return;

			const scssVar = figmaNameToScssVar(figmaName, sep);
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

function buildSemanticEntries(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitiveMap: PrimitiveMap,
	sep: string
): SemanticToken[] {
	const tokens: SemanticToken[] = [];

	walkColorTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap[lightFigmaName]?.scssVar;
		if (!lightPrim) return;

		// Match token in dark export
		const darkToken = getColorTokenAtPath(darkColors, path);
		const darkFigmaName = darkToken?.$extensions?.['com.figma.aliasData']?.targetVariableName;
		const darkPrim = darkFigmaName
			? (primitiveMap[darkFigmaName]?.scssVar ?? lightPrim)
			: lightPrim;

		// Tokens in a "static" path segment are mode-invariant (no light-dark())
		const isStatic = path.some((p) => p.toLowerCase() === 'static');

		const tokenName = pathToTokenName(path, sep);
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

function generatePrimitivesScss(primitiveMap: PrimitiveMap, _sep: string): TransformResult {
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

function generateColorsScss(semanticTokens: SemanticToken[], conventions: DetectedConventions): TransformResult {
	const lines: string[] = [];
	const suffix = conventions.importSuffix ?? '';
	const structure = conventions.scssColorStructure ?? 'modern';

	if (conventions.importStyle === 'use') {
		lines.push(`@use './Primitives${suffix}' as *;`);
	} else {
		lines.push(`@import './Primitives${suffix}';`);
	}
	lines.push('');
	lines.push('// Colors.scss');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	const sepChar = conventions.scssSeparator === 'underscore' ? '_' : '-';

	const byCategory = new Map<string, SemanticToken[]>();
	for (const token of semanticTokens) {
		const category = token.scssVar.replace('$', '').split(sepChar)[0];
		const list = byCategory.get(category) ?? [];
		list.push(token);
		byCategory.set(category, list);
	}

	const orderedCategories = orderCategories(byCategory.keys());

	if (structure === 'modern') {
		// Modern path: @property + light-dark()
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

		lines.push(':root {');
		lines.push('  color-scheme: light dark;');
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

		lines.push('// SCSS variable aliases — reference in .scss files; compile to var(--token-name)');
		for (const category of orderedCategories) {
			lines.push(`// ${capitalize(category)} colors`);
			for (const token of byCategory.get(category)!) {
				lines.push(`${token.scssVar}: var(${token.cssVar});`);
			}
			lines.push('');
		}
	} else if (structure === 'inline') {
		// Inline path: flat $var: var(--prop, light-dark($light, $dark)) — no :root block
		for (const category of orderedCategories) {
			lines.push(`// ${capitalize(category)} colors`);
			for (const token of byCategory.get(category)!) {
				if (token.isStatic) {
					lines.push(`${token.scssVar}: var(${token.cssVar}, ${token.lightPrimitive});`);
				} else {
					lines.push(`${token.scssVar}: var(${token.cssVar}, light-dark(${token.lightPrimitive}, ${token.darkPrimitive}));`);
				}
			}
			lines.push('');
		}
	} else {
		// media-query path: :root + @media (prefers-color-scheme: dark) + aliases
		lines.push(':root {');
		for (const category of orderedCategories) {
			lines.push(`  // ${capitalize(category)} colors`);
			for (const token of byCategory.get(category)!) {
				lines.push(`  ${token.cssVar}: #{${token.lightPrimitive}};`);
			}
			lines.push('');
		}
		lines.push('}');
		lines.push('');

		lines.push('@media (prefers-color-scheme: dark) {');
		lines.push('  :root {');
		for (const category of orderedCategories) {
			for (const token of byCategory.get(category)!) {
				if (!token.isStatic) {
					lines.push(`    ${token.cssVar}: #{${token.darkPrimitive}};`);
				}
			}
		}
		lines.push('  }');
		lines.push('}');
		lines.push('');

		lines.push('// SCSS variable aliases');
		for (const category of orderedCategories) {
			lines.push(`// ${capitalize(category)} colors`);
			for (const token of byCategory.get(category)!) {
				lines.push(`${token.scssVar}: var(${token.cssVar});`);
			}
			lines.push('');
		}
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
function figmaNameToScssVar(figmaName: string, sep: string = '-'): string | null {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return null;

	const rest = figmaName.slice('Colour/'.length);
	const parts = rest.split('/');

	const converted = parts.map((p) =>
		p
			.replace(/_/g, '-')
			.replace(/([a-z])([A-Z])/g, '$1-$2')
			.toLowerCase()
	);

	return '$' + converted.join('-').replace(/-/g, sep);
}

/**
 * Extract the color family from an SCSS variable for grouping
 * "$grey-alpha-750-8" → "grey-alpha"
 * "$red-300"          → "red"
 * "$orange-other-orange" → "orange"
 */
function extractFamily(scssVar: string): string {
	const name = scssVar.slice(1); // strip "$"
	const sepChar = name.includes('_') ? '_' : '-';
	const parts = name.split(sepChar);
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part) || part === 'other') break;
		familyParts.push(part);
	}
	/* v8 ignore next -- @preserve */
	return familyParts.join(sepChar) || name;
}

