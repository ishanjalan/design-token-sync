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

import type { FigmaColorExport, TransformResult } from '$lib/types.js';
import type { DetectedKotlinConventions } from '$lib/types.js';
import { BEST_PRACTICE_KOTLIN_CONVENTIONS } from '$lib/types.js';
import { figmaToKotlinHex } from '$lib/color-utils.js';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	pathToTokenName,
	extractSortKey,
	capitalize
} from './shared.js';

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
	referenceKotlin?: string,
	bestPractices: boolean = true
): TransformResult {
	const conventions = detectKotlinConventions(referenceKotlin, bestPractices);
	const primitiveMap = buildPrimitiveMap(lightColors, darkColors, conventions);
	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap, conventions);
	const content = generateKotlin(primitiveMap, semanticEntries, conventions);
	return { filename: 'Colors.kt', content, format: 'kotlin', platform: 'android' };
}

// ─── Convention Detection ─────────────────────────────────────────────────────

export function detectKotlinConventions(reference?: string, bestPractices: boolean = true): DetectedKotlinConventions {
	if (bestPractices || !reference) {
		return { ...BEST_PRACTICE_KOTLIN_CONVENTIONS };
	}

	// Detect val naming — PascalCase if starts with uppercase after "val "
	const pascalMatches = (reference.match(/\bval\s+[A-Z][a-zA-Z0-9]+\s*=/g) ?? []).length;
	const camelMatches = (reference.match(/\bval\s+[a-z][a-zA-Z0-9]+\s*=/g) ?? []).length;
	const namingCase = pascalMatches > camelMatches ? 'pascal' : 'camel';

	// Detect object name from "object Foo {" pattern
	const objectMatch = reference.match(/\bobject\s+(\w+)\s*\{/);
	const objectName = objectMatch ? objectMatch[1] : 'AppColors';

	// Detect package name from "package com.foo.bar" declaration
	const packageMatch = reference.match(/^package\s+([\w.]+)/m);
	const kotlinPackage = packageMatch ? packageMatch[1] : 'com.example.design';

	return { namingCase, objectName, kotlinPackage };
}

// ─── Build Primitive Map ──────────────────────────────────────────────────────

function buildPrimitiveMap(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	conventions: DetectedKotlinConventions
): Map<string, PrimitiveEntry> {
	const map = new Map<string, PrimitiveEntry>();

	function collect(export_: FigmaColorExport) {
		walkColorTokens(export_, (token) => {
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

	walkColorTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap.get(lightFigmaName);
		/* v8 ignore next -- @preserve */
		if (!lightPrim) return;

		const darkToken = getColorTokenAtPath(darkColors, path);
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
	conventions: DetectedKotlinConventions
): string {
	const lines: string[] = [];

	lines.push('// Colors.kt');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push(`package ${conventions.kotlinPackage}`);
	lines.push('');
	lines.push('import androidx.compose.material3.ColorScheme');
	lines.push('import androidx.compose.material3.darkColorScheme');
	lines.push('import androidx.compose.material3.lightColorScheme');
	lines.push('import androidx.compose.ui.graphics.Color');
	lines.push('');

	const primitivesObj = conventions.objectName === 'AppColors' ? 'Primitives' : `${conventions.objectName}Primitives`;
	const lightObj = conventions.objectName === 'AppColors' ? 'LightColorTokens' : `${conventions.objectName}Light`;
	const darkObj = conventions.objectName === 'AppColors' ? 'DarkColorTokens' : `${conventions.objectName}Dark`;

	// ── Primitives ──────────────────────────────────────────────────────────
	lines.push('// Primitive color palette');
	lines.push(`object ${primitivesObj} {`);

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
		lines.push(`object ${lightObj} {`);
		for (const entry of semanticEntries) {
			lines.push(`    val ${entry.kotlinName} = ${primitivesObj}.${entry.lightPrimName}`);
		}
		lines.push('}');
		lines.push('');

		// ── Dark theme ───────────────────────────────────────────────────────
		lines.push('// Dark theme semantic tokens');
		lines.push(`object ${darkObj} {`);
		for (const entry of semanticEntries) {
			const darkRef = entry.isStatic ? entry.lightPrimName : entry.darkPrimName;
			lines.push(`    val ${entry.kotlinName} = ${primitivesObj}.${darkRef}`);
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
		lines.push(`    // primary           = ${lightObj}.fillPrimary,`);
		lines.push(`    // onPrimary         = ${lightObj}.textOnPrimary,`);
		lines.push(`    // background        = ${lightObj}.backgroundDefault,`);
		lines.push(`    // surface           = ${lightObj}.backgroundSurface,`);
		lines.push(`    // onSurface         = ${lightObj}.textPrimary,`);
		lines.push(`    // outline           = ${lightObj}.strokeDefault,`);
		lines.push(')');
		lines.push('');
		lines.push('@Suppress("UnusedReceiverParameter")');
		lines.push('fun darkColors(): ColorScheme = darkColorScheme(');
		lines.push(`    // primary           = ${darkObj}.fillPrimary,`);
		lines.push(`    // onPrimary         = ${darkObj}.textOnPrimary,`);
		lines.push(`    // background        = ${darkObj}.backgroundDefault,`);
		lines.push(`    // surface           = ${darkObj}.backgroundSurface,`);
		lines.push(`    // onSurface         = ${darkObj}.textPrimary,`);
		lines.push(`    // outline           = ${darkObj}.strokeDefault,`);
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

