/**
 * Kotlin Transformer
 *
 * Generates Colors.kt from Figma color exports.
 * Output targets Jetpack Compose (Material3) using:
 *   object Primitives { val Grey750 = Color(0xFF1D1D1D) }
 *   object LightColorTokens { val textPrimary = Primitives.Grey750 }
 *   object DarkColorTokens  { val textPrimary = Primitives.Grey50  }
 *
 * Hex values use the Compose Color(Long) format: 0xFFRRGGBB (alpha-first).
 * Alpha colors use: Color(red = 0.11f, green = 0.11f, blue = 0.11f, alpha = 0.69f)
 *
 * If a reference Colors.kt is provided, naming conventions are detected and matched.
 */

import type { FigmaColorExport, FigmaColorToken, TransformResult } from '$lib/types.js';
import type { DetectedKotlinConventions } from '$lib/types.js';
import { figmaToKotlinHex } from '$lib/color-utils.js';

interface PrimitiveEntry {
	kotlinName: string; // e.g. "Grey750"
	hex: string; // e.g. "1D1D1D" (uppercase, no #)
	r: number; // 0–1 (for alpha colors)
	g: number;
	b: number;
	alpha: number;
	family: string;
	sortKey: number;
}

interface SemanticEntry {
	kotlinName: string; // e.g. "textPrimary" or "TextPrimary"
	lightPrimName: string; // e.g. "Grey750"
	darkPrimName: string;
	isStatic: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToKotlin(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	referenceKotlin?: string
): TransformResult {
	const conventions = detectKotlinConventions(referenceKotlin);
	const primitiveMap = buildPrimitiveMap(lightColors, darkColors, conventions);
	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap, conventions);
	const content = generateKotlin(primitiveMap, semanticEntries, conventions);
	return { filename: 'Colors.kt', content, format: 'kotlin', platform: 'android' };
}

// ─── Convention Detection ─────────────────────────────────────────────────────

export function detectKotlinConventions(reference?: string): DetectedKotlinConventions {
	if (!reference) {
		return { namingCase: 'camel', objectName: 'AppColors' };
	}

	// Detect val naming — PascalCase if starts with uppercase after "val "
	const pascalMatches = (reference.match(/\bval\s+[A-Z][a-zA-Z0-9]+\s*=/g) ?? []).length;
	const camelMatches = (reference.match(/\bval\s+[a-z][a-zA-Z0-9]+\s*=/g) ?? []).length;
	const namingCase = pascalMatches > camelMatches ? 'pascal' : 'camel';

	// Detect object name from "object Foo {" pattern
	const objectMatch = reference.match(/\bobject\s+(\w+)\s*\{/);
	const objectName = objectMatch ? objectMatch[1] : 'AppColors';

	return { namingCase, objectName };
}

// ─── Build Primitive Map ──────────────────────────────────────────────────────

function buildPrimitiveMap(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	conventions: DetectedKotlinConventions
): Map<string, PrimitiveEntry> {
	const map = new Map<string, PrimitiveEntry>();

	function collect(export_: FigmaColorExport) {
		walkTokens(export_, (token) => {
			const figmaName = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
			/* v8 ignore next -- @preserve */
			if (!figmaName || map.has(figmaName)) return;
			/* v8 ignore next -- @preserve */
			if (!figmaName.startsWith('Colour/')) return;

			const v = token.$value;
			/* v8 ignore next -- @preserve */
			if (!v) return;
			const kotlinName = figmaNameToKotlinName(figmaName, conventions.namingCase);
			/* v8 ignore next -- @preserve */
			if (!kotlinName) return;

			const hexUpper = v.hex.replace('#', '').toUpperCase();
			map.set(figmaName, {
				kotlinName,
				hex: hexUpper,
				r: v.components[0],
				g: v.components[1],
				b: v.components[2],
				alpha: v.alpha,
				family: extractFamily(figmaName),
				sortKey: extractSortKey(figmaName)
			});
		});
	}

	collect(lightColors);
	collect(darkColors);
	return map;
}

// ─── Build Semantic Entries ───────────────────────────────────────────────────

function buildSemanticEntries(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitiveMap: Map<string, PrimitiveEntry>,
	conventions: DetectedKotlinConventions
): SemanticEntry[] {
	const entries: SemanticEntry[] = [];

	walkTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap.get(lightFigmaName);
		/* v8 ignore next -- @preserve */
		if (!lightPrim) return;

		const darkToken = getTokenAtPath(darkColors, path);
		const darkFigmaName = darkToken?.$extensions?.['com.figma.aliasData']?.targetVariableName;
		const darkPrim = darkFigmaName ? (primitiveMap.get(darkFigmaName) ?? lightPrim) : lightPrim;

		const isStatic = path.some((p) => p.toLowerCase() === 'static');
		const tokenName = pathToTokenName(path);
		const kotlinName = tokenNameToKotlinName(tokenName, conventions.namingCase);

		entries.push({
			kotlinName,
			lightPrimName: lightPrim.kotlinName,
			darkPrimName: darkPrim.kotlinName,
			isStatic
		});
	});

	return entries;
}

// ─── Generate Output ──────────────────────────────────────────────────────────

function generateKotlin(
	primitiveMap: Map<string, PrimitiveEntry>,
	semanticEntries: SemanticEntry[],
	_conventions: DetectedKotlinConventions
): string {
	const lines: string[] = [];

	lines.push('// Colors.kt');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('package com.example.design // TODO: update to your package name');
	lines.push('');
	lines.push('import androidx.compose.material3.ColorScheme');
	lines.push('import androidx.compose.material3.darkColorScheme');
	lines.push('import androidx.compose.material3.lightColorScheme');
	lines.push('import androidx.compose.ui.graphics.Color');
	lines.push('');

	// ── Primitives ──────────────────────────────────────────────────────────
	lines.push('// Primitive color palette');
	lines.push('object Primitives {');

	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of primitiveMap.values()) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}

	const sortedFamilies = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [family, entries] of sortedFamilies) {
		lines.push(`    // ${capitalize(family)}`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.kotlinName.localeCompare(b.kotlinName)
		);
		for (const entry of sorted) {
			lines.push(formatPrimitiveDecl(entry));
		}
	}
	lines.push('}');
	lines.push('');

	if (semanticEntries.length > 0) {
		// ── Light theme ──────────────────────────────────────────────────────
		lines.push('// Light theme semantic tokens');
		lines.push('object LightColorTokens {');
		for (const entry of semanticEntries) {
			lines.push(`    val ${entry.kotlinName} = Primitives.${entry.lightPrimName}`);
		}
		lines.push('}');
		lines.push('');

		// ── Dark theme ───────────────────────────────────────────────────────
		lines.push('// Dark theme semantic tokens');
		lines.push('object DarkColorTokens {');
		for (const entry of semanticEntries) {
			const darkRef = entry.isStatic ? entry.lightPrimName : entry.darkPrimName;
			lines.push(`    val ${entry.kotlinName} = Primitives.${darkRef}`);
		}
		lines.push('}');
		lines.push('');

		// ── Material3 ColorScheme builders ───────────────────────────────────
		// These wire your semantic tokens into Material3's ColorScheme so you can pass
		// them directly to MaterialTheme:
		//
		//   @Composable
		//   fun AppTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
		//       val colorScheme = if (darkTheme) darkColors() else lightColors()
		//       MaterialTheme(colorScheme = colorScheme, content = content)
		//   }
		//
		// See https://m3.material.io/styles/color/roles for a full list of M3 color roles.
		lines.push('// Material3 ColorScheme builders — plug into MaterialTheme');
		lines.push('// TODO: map your semantic tokens to Material3 color roles below.');
		lines.push('@Suppress("UnusedReceiverParameter")');
		lines.push('fun lightColors(): ColorScheme = lightColorScheme(');
		lines.push('    // primary           = LightColorTokens.fillPrimary,');
		lines.push('    // onPrimary         = LightColorTokens.textOnPrimary,');
		lines.push('    // background        = LightColorTokens.backgroundDefault,');
		lines.push('    // surface           = LightColorTokens.backgroundSurface,');
		lines.push('    // onSurface         = LightColorTokens.textPrimary,');
		lines.push('    // outline           = LightColorTokens.strokeDefault,');
		lines.push(')');
		lines.push('');
		lines.push('@Suppress("UnusedReceiverParameter")');
		lines.push('fun darkColors(): ColorScheme = darkColorScheme(');
		lines.push('    // primary           = DarkColorTokens.fillPrimary,');
		lines.push('    // onPrimary         = DarkColorTokens.textOnPrimary,');
		lines.push('    // background        = DarkColorTokens.backgroundDefault,');
		lines.push('    // surface           = DarkColorTokens.backgroundSurface,');
		lines.push('    // onSurface         = DarkColorTokens.textPrimary,');
		lines.push('    // outline           = DarkColorTokens.strokeDefault,');
		lines.push(')');
		lines.push('');
	}

	return lines.join('\n') + '\n';
}

function formatPrimitiveDecl(entry: PrimitiveEntry): string {
	return `    val ${entry.kotlinName} = Color(${figmaToKotlinHex(entry.r, entry.g, entry.b, entry.alpha)})`;
}

// ─── Naming Helpers ───────────────────────────────────────────────────────────

function figmaNameToKotlinName(figmaName: string, namingCase: 'camel' | 'pascal'): string | null {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return null;
	const rest = figmaName.slice('Colour/'.length);
	const parts = rest.split('/');
	const segments = parts.flatMap((p) =>
		p
			.replace(/_/g, '-')
			.replace(/([a-z])([A-Z])/g, '$1-$2')
			.toLowerCase()
			.split('-')
			.filter(Boolean)
	);

	if (namingCase === 'pascal') return toPascalCase(segments);
	return toCamelCase(segments);
}

function tokenNameToKotlinName(tokenName: string, namingCase: 'camel' | 'pascal'): string {
	const segments = tokenName.split('-').filter(Boolean);
	if (namingCase === 'pascal') return toPascalCase(segments);
	return toCamelCase(segments);
}

function pathToTokenName(path: string[]): string {
	return path
		.filter((p) => p.toLowerCase() !== 'standard')
		.map((p) => p.toLowerCase().replace(/\s+/g, '-'))
		.join('-');
}

function toCamelCase(parts: string[]): string {
	return parts.map((p, i) => (i === 0 ? p : capitalize(p))).join('');
}

function toPascalCase(parts: string[]): string {
	return parts.map(capitalize).join('');
}

function extractFamily(figmaName: string): string {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return figmaName;
	const rest = figmaName.slice('Colour/'.length);
	const topSegment = rest.split('/')[0].toLowerCase().replace(/_/g, '-');
	const parts = topSegment.split('-');
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part)) break;
		familyParts.push(part);
	}
	/* v8 ignore next -- @preserve */
	return familyParts.join('-') || topSegment;
}

function extractSortKey(figmaName: string): number {
	const numbers = figmaName.match(/\d+/g);
	/* v8 ignore next -- @preserve */
	if (!numbers) return 0;
	return numbers.reduce(
		(acc, n, i) => acc + parseInt(n) * Math.pow(1000, Math.max(0, numbers.length - 1 - i)),
		0
	);
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Tree-walking Utilities ───────────────────────────────────────────────────

function walkTokens(obj: unknown, fn: (token: FigmaColorToken) => void): void {
	/* v8 ignore next -- @preserve */
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(o as unknown as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		/* v8 ignore next -- @preserve */
		if (!key.startsWith('$')) walkTokens(val, fn);
	}
}

function walkTokensWithPath(
	obj: unknown,
	fn: (path: string[], token: FigmaColorToken) => void,
	path: string[] = []
): void {
	/* v8 ignore next -- @preserve */
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(path, o as unknown as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		/* v8 ignore next -- @preserve */
		if (!key.startsWith('$')) walkTokensWithPath(val, fn, [...path, key]);
	}
}

function getTokenAtPath(obj: unknown, path: string[]): FigmaColorToken | null {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = (cur as Record<string, unknown>)[key];
	}
	/* v8 ignore next -- @preserve */
	if (!cur || typeof cur !== 'object') return null;
	const o = cur as Record<string, unknown>;
	return o.$type === 'color' ? (o as unknown as FigmaColorToken) : null;
}
