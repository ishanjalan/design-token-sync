/**
 * Swift Transformer
 *
 * Generates Colors.swift from Figma color exports.
 * Output targets Swift 5.9+ / Xcode 15+ using SwiftUI Color + UIColor dynamic provider.
 *
 * Structure:
 *   - Primitives: `public extension Color { static let grey750 = Color(red:green:blue:) }`
 *   - Semantics:  `public extension UIColor { static let textPrimary = UIColor { trait in ... } }`
 *                 `public extension Color   { static let textPrimary = Color(UIColor.textPrimary) }`
 *
 * If a reference Colors.swift is provided, naming conventions are detected and matched.
 */

import type { FigmaColorExport, FigmaColorToken, TransformResult } from '$lib/types.js';
import type { DetectedSwiftConventions } from '$lib/types.js';
import { BEST_PRACTICE_SWIFT_CONVENTIONS } from '$lib/types.js';
import { figmaToSwiftHex } from '$lib/color-utils.js';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	pathToTokenName,
	extractSortKey,
	capitalize,
	CATEGORY_ORDER,
	orderCategories
} from './shared.js';

interface PrimitiveEntry {
	swiftName: string; // e.g. "grey750"
	r: number; // 0–1
	g: number;
	b: number;
	alpha: number;
	family: string;
	sortKey: number;
}

interface SemanticEntry {
	swiftName: string; // e.g. "textPrimary"
	lightName: string; // e.g. "grey750"
	darkName: string;
	isStatic: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToSwift(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	referenceSwift?: string,
	bestPractices: boolean = true
): TransformResult {
	const conventions = detectSwiftConventions(referenceSwift, bestPractices);
	const primitiveMap = buildPrimitiveMap(lightColors, darkColors, conventions);
	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap, conventions);
	const content = generateSwift(primitiveMap, semanticEntries, conventions);
	return { filename: 'Colors.swift', content, format: 'swift', platform: 'ios' };
}

// ─── Convention Detection ─────────────────────────────────────────────────────

export function detectSwiftConventions(reference?: string, bestPractices: boolean = true): DetectedSwiftConventions {
	if (bestPractices || !reference) {
		return { ...BEST_PRACTICE_SWIFT_CONVENTIONS };
	}
	// Detect static let vs var (computed)
	const useComputedVar =
		/static\s+var\s+\w+/.test(reference) && !/static\s+let\s+\w+/.test(reference);

	// Detect snake_case usage
	const snakeMatches = (reference.match(/static\s+(?:let|var)\s+[a-z]+_[a-z]/g) ?? []).length;
	const camelMatches = (reference.match(/static\s+(?:let|var)\s+[a-z][a-zA-Z0-9]+[A-Z]/g) ?? [])
		.length;
	const namingCase = snakeMatches > camelMatches ? 'snake' : 'camel';

	return { namingCase, useComputedVar };
}

// ─── Build Primitive Map ──────────────────────────────────────────────────────

function buildPrimitiveMap(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	conventions: DetectedSwiftConventions
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
			const swiftName = figmaNameToSwiftName(figmaName, conventions.namingCase);
			/* v8 ignore next -- @preserve */
			if (!swiftName) return;

			map.set(figmaName, {
				swiftName,
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
	conventions: DetectedSwiftConventions
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
		const swiftName = tokenNameToSwiftName(tokenName, conventions.namingCase);

		entries.push({
			swiftName,
			lightName: lightPrim.swiftName,
			darkName: darkPrim.swiftName,
			isStatic
		});
	});

	return entries;
}

// ─── Generate Output ──────────────────────────────────────────────────────────

function toHex(r01: number, g01: number, b01: number, alpha: number = 1): string {
	return figmaToSwiftHex(r01, g01, b01, alpha);
}

function generateSwift(
	primitiveMap: Map<string, PrimitiveEntry>,
	semanticEntries: SemanticEntry[],
	conventions: DetectedSwiftConventions
): string {
	const lines: string[] = [];

	lines.push('// Colors.swift');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('import SwiftUI');
	lines.push('#if canImport(UIKit)');
	lines.push('import UIKit');
	lines.push('#endif');
	lines.push('');

	// Hex color initializer extension (supports 6-digit 0xRRGGBB and 8-digit 0xRRGGBBAA)
	lines.push('// MARK: - Hex Color Init');
	lines.push('private extension Color {');
	lines.push('  init(hex: UInt64) {');
	lines.push('    let hasAlpha = hex > 0xFFFFFF');
	lines.push('    let r, g, b, a: Double');
	lines.push('    if hasAlpha {');
	lines.push('      r = Double((hex >> 24) & 0xFF) / 255');
	lines.push('      g = Double((hex >> 16) & 0xFF) / 255');
	lines.push('      b = Double((hex >>  8) & 0xFF) / 255');
	lines.push('      a = Double( hex        & 0xFF) / 255');
	lines.push('    } else {');
	lines.push('      r = Double((hex >> 16) & 0xFF) / 255');
	lines.push('      g = Double((hex >>  8) & 0xFF) / 255');
	lines.push('      b = Double( hex        & 0xFF) / 255');
	lines.push('      a = 1.0');
	lines.push('    }');
	lines.push('    self.init(.sRGB, red: r, green: g, blue: b, opacity: a)');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	// ── Primitives ──────────────────────────────────────────────────────────
	lines.push('// MARK: - Primitives');
	lines.push('public extension Color {');

	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of primitiveMap.values()) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}

	const sortedFamilies = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [family, entries] of sortedFamilies) {
		lines.push(`  // ${family}`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.swiftName.localeCompare(b.swiftName)
		);
		for (const entry of sorted) {
			lines.push(formatPrimitiveDecl(entry, conventions));
		}
	}
	lines.push('}');
	lines.push('');

	// ── Semantic Colors ──────────────────────────────────────────────────────
	const byCategory = new Map<string, SemanticEntry[]>();
	for (const entry of semanticEntries) {
		// group by first word of the swift name (e.g. "text", "fill", "stroke")
		const category = entry.swiftName
			.replace(/([A-Z])/g, ' $1')
			.trim()
			.split(' ')[0]
			.toLowerCase();
		const list = byCategory.get(category) ?? [];
		list.push(entry);
		byCategory.set(category, list);
	}

	if (byCategory.size > 0) {
		lines.push('#if canImport(UIKit)');
		lines.push('// MARK: - Semantic Colors (UIColor — supports dynamic light/dark)');
		lines.push('public extension UIColor {');

		const orderedCategories = orderCategories(byCategory.keys());

		for (const category of orderedCategories) {
			const tokens = byCategory.get(category)!;
			lines.push(`  // ${capitalize(category)}`);
			for (const token of tokens) {
				lines.push(formatSemanticUiColorDecl(token, conventions));
			}
		}
		lines.push('}');
		lines.push('');
		lines.push('// MARK: - Semantic Colors (SwiftUI Color)');
		lines.push('public extension Color {');
		for (const category of orderedCategories) {
			const tokens = byCategory.get(category)!;
			lines.push(`  // ${capitalize(category)}`);
			for (const token of tokens) {
				lines.push(formatSemanticColorDecl(token, conventions));
			}
		}
		lines.push('}');
		lines.push('#endif');
		lines.push('');
	}

	return lines.join('\n') + '\n';
}

function formatPrimitiveDecl(entry: PrimitiveEntry, conventions: DetectedSwiftConventions): string {
	const keyword = conventions.useComputedVar ? 'var' : 'let';
	const hex = toHex(entry.r, entry.g, entry.b, entry.alpha);
	return `  static ${keyword} ${entry.swiftName} = Color(hex: ${hex})`;
}

function formatSemanticUiColorDecl(
	entry: SemanticEntry,
	conventions: DetectedSwiftConventions
): string {
	const keyword = conventions.useComputedVar ? 'var' : 'let';
	if (entry.isStatic) {
		return `  static ${keyword} ${entry.swiftName} = UIColor(Color.${entry.lightName})`;
	}
	return (
		`  static ${keyword} ${entry.swiftName} = UIColor { trait in\n` +
		`    trait.userInterfaceStyle == .dark\n` +
		`      ? UIColor(Color.${entry.darkName})\n` +
		`      : UIColor(Color.${entry.lightName})\n` +
		`  }`
	);
}

function formatSemanticColorDecl(
	entry: SemanticEntry,
	conventions: DetectedSwiftConventions
): string {
	const keyword = conventions.useComputedVar ? 'var' : 'let';
	if (entry.isStatic) {
		return `  static ${keyword} ${entry.swiftName} = Color.${entry.lightName}`;
	}
	return `  static ${keyword} ${entry.swiftName} = Color(light: .${entry.lightName}, dark: .${entry.darkName})`;
}

// ─── Naming Helpers ───────────────────────────────────────────────────────────

function figmaNameToSwiftName(figmaName: string, namingCase: 'camel' | 'snake'): string | null {
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

	if (namingCase === 'snake') return segments.join('_');
	return toCamelCase(segments);
}

function tokenNameToSwiftName(tokenName: string, namingCase: 'camel' | 'snake'): string {
	const segments = tokenName.split('-').filter(Boolean);
	if (namingCase === 'snake') return segments.join('_');
	return toCamelCase(segments);
}

function toCamelCase(parts: string[]): string {
	return parts.map((p, i) => (i === 0 ? p : capitalize(p))).join('');
}

function extractFamily(figmaName: string): string {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return figmaName;
	const rest = figmaName.slice('Colour/'.length);
	const topSegment = rest.split('/')[0].toLowerCase().replace(/_/g, '-');
	// Split on hyphens but stop before numbers
	const parts = topSegment.split('-');
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part)) break;
		familyParts.push(part);
	}
	/* v8 ignore next -- @preserve */
	return familyParts.join('-') || topSegment;
}

