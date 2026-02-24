/**
 * Swift Transformer
 *
 * Generates Colors.swift from Figma color exports.
 * Output targets Swift 5.9+ / Xcode 15+ using pure SwiftUI Color.
 *
 * Structure:
 *   - Primitives: `public extension Color { static let grey750 = Color(hex: 0xRRGGBB) }`
 *   - Semantics:  `public extension Color { static let textPrimary = Color(light: .grey750, dark: .grey100) }`
 *
 * A private `Color(light:dark:)` initializer handles dynamic light/dark mode
 * switching using a platform-conditional UIColor/NSColor provider under the hood.
 *
 * If a reference Colors.swift is provided, naming conventions are detected and matched.
 */

import type { FigmaColorExport, TransformResult } from '$lib/types.js';
import type { DetectedSwiftConventions } from '$lib/types.js';
import { BEST_PRACTICE_SWIFT_CONVENTIONS } from '$lib/types.js';
import { figmaToSwiftHex, figmaToStringHex } from '$lib/color-utils.js';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	pathToTokenName,
	extractSortKey,
	capitalize,
	orderCategories,
	detectRenamesInReference,
	renameComment,
	createNewDetector,
	newTokenComment,
	detectSwiftBugs,
	bugWarningBlock,
	fileHeaderLines
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
	lightR?: number;
	lightG?: number;
	lightB?: number;
	lightAlpha?: number;
	darkR?: number;
	darkG?: number;
	darkB?: number;
	darkAlpha?: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToSwift(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	referenceSwift?: string,
	bestPractices: boolean = true
): TransformResult {
	const conventions = detectSwiftConventions(referenceSwift, bestPractices);
	const renames = bestPractices ? new Map<string, string>() : detectRenamesInReference(referenceSwift);
	const isNew = bestPractices ? (() => false) : createNewDetector(referenceSwift);
	const bugWarnings = referenceSwift && !bestPractices ? detectSwiftBugs(referenceSwift) : [];
	const primitiveMap = buildPrimitiveMap(lightColors, darkColors, conventions);
	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap, conventions);
	const content = generateSwift(primitiveMap, semanticEntries, conventions, renames, isNew, bugWarnings, bestPractices);
	return { filename: 'Colors.swift', content, format: 'swift', platform: 'ios' };
}

// ─── Convention Detection ─────────────────────────────────────────────────────

export function detectSwiftConventions(reference?: string, bestPractices: boolean = true): DetectedSwiftConventions {
	if (bestPractices || !reference) {
		return { ...BEST_PRACTICE_SWIFT_CONVENTIONS };
	}

	const useComputedVar =
		/static\s+var\s+\w+/.test(reference) && !/static\s+let\s+\w+/.test(reference);

	const snakeMatches = (reference.match(/static\s+(?:let|var)\s+[a-z]+_[a-z]/g) ?? []).length;
	const camelMatches = (reference.match(/static\s+(?:let|var)\s+[a-z][a-zA-Z0-9]+[A-Z]/g) ?? [])
		.length;
	const namingCase: 'camel' | 'snake' = snakeMatches > camelMatches ? 'snake' : 'camel';

	// Indentation: measure first `static let`/`static var` line
	const indentMatch = reference.match(/^( +)static\s+(?:let|var)\s/m);
	const indent = indentMatch ? indentMatch[1] : '  ';

	// Primitive format: string hex `= "#` vs Color hex `Color(hex:`
	const stringHexCount = (reference.match(/=\s*"#[0-9A-Fa-f]{6,8}"/g) ?? []).length;
	const colorHexCount = (reference.match(/Color\(hex:/g) ?? []).length;
	const primitiveFormat: 'colorHex' | 'stringHex' =
		stringHexCount > colorHexCount ? 'stringHex' : 'colorHex';

	// Container style: enum vs extension
	const enumMatches = reference.match(
		/(?:(?:fileprivate|private|internal|public)\s+)?enum\s+(\w+)\s*\{/g
	);
	const hasExtension = /extension\s+Color\s*\{/.test(reference);
	const containerStyle: 'extension' | 'enum' =
		enumMatches && enumMatches.length > 0 && !hasExtension ? 'enum' : 'extension';

	// Primitive enum name + access modifier
	let primitiveEnumName = '';
	let primitiveAccess = '';
	if (containerStyle === 'enum') {
		const primEnumMatch = reference.match(
			/(?:(fileprivate|private|internal|public)\s+)?enum\s+(\w+)\s*\{/
		);
		if (primEnumMatch) {
			primitiveAccess = primEnumMatch[1] ?? '';
			primitiveEnumName = primEnumMatch[2];
		}
	}

	// Semantic format: flat Light/Dark suffix pairs vs dynamic Color(light:, dark:)
	const flatLightDarkCount = (
		reference.match(/\w+Light\s*=\s*"#[0-9A-Fa-f]/g) ?? []
	).length;
	const dynamicColorCount = (reference.match(/Color\(light:/g) ?? []).length;
	const semanticFormat: 'dynamic' | 'flatLightDark' =
		flatLightDarkCount > dynamicColorCount ? 'flatLightDark' : 'dynamic';

	// Enum names: second = semantic data layer, third = API layer (ColorStyle)
	let semanticEnumName = '';
	let apiEnumName = 'ColorStyle';
	if (containerStyle === 'enum') {
		const allEnums = [
			...reference.matchAll(
				/(?:(?:fileprivate|private|internal|public)\s+)?enum\s+(\w+)\s*\{/g
			)
		];
		const otherEnums = allEnums.filter((m) => m[1] !== primitiveEnumName);
		if (otherEnums.length >= 1) {
			semanticEnumName = otherEnums[0][1];
		}
		if (otherEnums.length >= 2) {
			apiEnumName = otherEnums[1][1];
		}
	}

	// Imports
	const importMatches = [...reference.matchAll(/^import\s+(\w+)/gm)];
	const imports =
		importMatches.length > 0 ? importMatches.map((m) => m[1]) : ['SwiftUI'];

	const hasUIColorTier = /:\s*UIColor\s*=/.test(reference) || /func\s+color\(/.test(reference);

	return {
		namingCase,
		useComputedVar,
		indent,
		primitiveFormat,
		containerStyle,
		primitiveEnumName,
		primitiveAccess,
		semanticFormat,
		semanticEnumName,
		apiEnumName,
		imports,
		hasUIColorTier
	};
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
			isStatic,
			lightR: lightPrim.r,
			lightG: lightPrim.g,
			lightB: lightPrim.b,
			lightAlpha: lightPrim.alpha,
			darkR: darkPrim.r,
			darkG: darkPrim.g,
			darkB: darkPrim.b,
			darkAlpha: darkPrim.alpha
		});
	});

	return entries;
}

// ─── Generate Output ──────────────────────────────────────────────────────────

function generateSwift(
	primitiveMap: Map<string, PrimitiveEntry>,
	semanticEntries: SemanticEntry[],
	conventions: DetectedSwiftConventions,
	renames: Map<string, string> = new Map(),
	isNew: (name: string) => boolean = () => false,
	bugWarnings: string[] = [],
	bestPractices: boolean = true
): string {
	const ind = conventions.indent;
	const isEnumMode = conventions.containerStyle === 'enum';
	const isStringHex = conventions.primitiveFormat === 'stringHex';
	const isFlatLD = conventions.semanticFormat === 'flatLightDark';

	const lines: string[] = [];

	lines.push('// Colors.swift');
	lines.push(...fileHeaderLines('//', bestPractices));
	lines.push('');

	lines.push(...bugWarningBlock(bugWarnings, '//'));

	for (const imp of conventions.imports) {
		lines.push(`import ${imp}`);
	}
	lines.push('');

	if (isEnumMode && conventions.hasUIColorTier) {
		lines.push('// MARK: - UIColor Light/Dark Operator');
		lines.push('infix operator |: AdditionPrecedence');
		lines.push('extension UIColor {');
		lines.push(`${ind}static func | (light: UIColor, dark: UIColor) -> UIColor {`);
		lines.push(`${ind}${ind}UIColor { trait in`);
		lines.push(`${ind}${ind}${ind}trait.userInterfaceStyle == .dark ? dark : light`);
		lines.push(`${ind}${ind}}`);
		lines.push(`${ind}}`);
		lines.push('}');
		lines.push('');
	}

	// Helper extensions only needed in best-practices mode
	if (!isEnumMode && !isStringHex) {
		lines.push('// MARK: - Hex Color Init');
		lines.push('private extension Color {');
		lines.push(`${ind}init(hex: UInt64) {`);
		lines.push(`${ind}${ind}let hasAlpha = hex > 0xFFFFFF`);
		lines.push(`${ind}${ind}let r, g, b, a: Double`);
		lines.push(`${ind}${ind}if hasAlpha {`);
		lines.push(`${ind}${ind}${ind}r = Double((hex >> 24) & 0xFF) / 255`);
		lines.push(`${ind}${ind}${ind}g = Double((hex >> 16) & 0xFF) / 255`);
		lines.push(`${ind}${ind}${ind}b = Double((hex >>  8) & 0xFF) / 255`);
		lines.push(`${ind}${ind}${ind}a = Double( hex        & 0xFF) / 255`);
		lines.push(`${ind}${ind}} else {`);
		lines.push(`${ind}${ind}${ind}r = Double((hex >> 16) & 0xFF) / 255`);
		lines.push(`${ind}${ind}${ind}g = Double((hex >>  8) & 0xFF) / 255`);
		lines.push(`${ind}${ind}${ind}b = Double( hex        & 0xFF) / 255`);
		lines.push(`${ind}${ind}${ind}a = 1.0`);
		lines.push(`${ind}${ind}}`);
		lines.push(`${ind}${ind}self.init(.sRGB, red: r, green: g, blue: b, opacity: a)`);
		lines.push(`${ind}}`);
		lines.push('}');
		lines.push('');
	}

	const hasDynamicSemantics = semanticEntries.some((e) => !e.isStatic);
	if (!isFlatLD && hasDynamicSemantics) {
		lines.push('// MARK: - Dynamic Color Init');
		lines.push('private extension Color {');
		lines.push(`${ind}init(light: Color, dark: Color) {`);
		lines.push(`${ind}${ind}#if canImport(UIKit)`);
		lines.push(`${ind}${ind}self.init(uiColor: UIColor { trait in`);
		lines.push(`${ind}${ind}${ind}trait.userInterfaceStyle == .dark`);
		lines.push(`${ind}${ind}${ind}${ind}? UIColor(dark)`);
		lines.push(`${ind}${ind}${ind}${ind}: UIColor(light)`);
		lines.push(`${ind}${ind}})`);
		lines.push(`${ind}${ind}#elseif canImport(AppKit)`);
		lines.push(`${ind}${ind}self.init(nsColor: NSColor(name: nil) { appearance in`);
		lines.push(`${ind}${ind}${ind}appearance.bestMatch(from: [.darkAqua, .vibrantDark]) != nil`);
		lines.push(`${ind}${ind}${ind}${ind}? NSColor(dark)`);
		lines.push(`${ind}${ind}${ind}${ind}: NSColor(light)`);
		lines.push(`${ind}${ind}})`);
		lines.push(`${ind}${ind}#else`);
		lines.push(`${ind}${ind}self = light`);
		lines.push(`${ind}${ind}#endif`);
		lines.push(`${ind}}`);
		lines.push('}');
		lines.push('');
	}

	// ── Primitives ──────────────────────────────────────────────────────────
	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of primitiveMap.values()) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}

	lines.push('// MARK: - Primitives');
	if (isEnumMode) {
		const access = conventions.primitiveAccess ? `${conventions.primitiveAccess} ` : '';
		const enumName = conventions.primitiveEnumName || 'PrimitiveColors';
		lines.push(`${access}enum ${enumName} {`);
	} else {
		lines.push('public extension Color {');
	}

	const sortedFamilies = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [family, entries] of sortedFamilies) {
		const oldName = renames.get(family);
		const familyIsNew = !oldName && isNew(family);
		if (oldName) {
			for (const cl of renameComment(oldName, family, '//')) {
				lines.push(`${ind}${cl}`);
			}
		}
		if (familyIsNew) {
			for (const cl of newTokenComment('//')) {
				lines.push(`${ind}${cl}`);
			}
		}
		lines.push(`${ind}// ${family}`);
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
		lines.push('// MARK: - Semantic Colors');
		if (isEnumMode && isFlatLD) {
			const enumName = conventions.semanticEnumName || 'SemanticColors';
			lines.push(`enum ${enumName} {`);
		} else {
			lines.push('public extension Color {');
		}

		const orderedCategories = orderCategories(byCategory.keys());

		for (const category of orderedCategories) {
			const tokens = byCategory.get(category)!;
			lines.push(`${ind}// ${capitalize(category)}`);
			for (const token of tokens) {
				if (isNew(token.swiftName)) {
					for (const cl of newTokenComment('//')) lines.push(`${ind}${cl}`);
				}
				const declLines = formatSemanticColorDecl(token, conventions);
				for (const dl of declLines) {
					lines.push(dl);
				}
			}
		}
		lines.push('}');
		lines.push('');
	}

	// ── Tier 3: UIColor API (match-existing enum mode with UIColor tier) ──
	if (isEnumMode && isFlatLD && conventions.hasUIColorTier && byCategory.size > 0) {
		const apiName = conventions.apiEnumName || 'ColorStyle';
		const semName = conventions.semanticEnumName || 'ColorCodes';

		lines.push('// MARK: - UIColor API');
		lines.push(`public enum ${apiName} {`);

		const orderedCats3 = orderCategories(byCategory.keys());
		for (const cat of orderedCats3) {
			const tokens = byCategory.get(cat)!;
			lines.push(`${ind}// MARK: - ${capitalize(cat)}`);
			for (const tok of tokens) {
				if (isNew(tok.swiftName)) {
					for (const cl of newTokenComment('//')) lines.push(`${ind}${cl}`);
				}
				if (tok.isStatic || tok.lightName === tok.darkName) {
					lines.push(`${ind}public static var ${tok.swiftName}: UIColor = color(${semName}.${tok.swiftName})`);
				} else {
					lines.push(`${ind}public static var ${tok.swiftName}: UIColor = color(${semName}.${tok.swiftName}Light) | color(${semName}.${tok.swiftName}Dark)`);
				}
			}
		}
		lines.push('}');
		lines.push('');

		lines.push(`public extension ${apiName} {`);
		lines.push(`${ind}static func color(_ hex: String) -> UIColor {`);
		lines.push(`${ind}${ind}let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex`);
		lines.push(`${ind}${ind}let scanner = Scanner(string: h)`);
		lines.push(`${ind}${ind}var rgb: UInt64 = 0`);
		lines.push(`${ind}${ind}scanner.scanHexInt64(&rgb)`);
		lines.push(`${ind}${ind}let r = CGFloat((rgb >> 16) & 0xFF) / 255`);
		lines.push(`${ind}${ind}let g = CGFloat((rgb >> 8) & 0xFF) / 255`);
		lines.push(`${ind}${ind}let b = CGFloat(rgb & 0xFF) / 255`);
		lines.push(`${ind}${ind}return UIColor(red: r, green: g, blue: b, alpha: 1)`);
		lines.push(`${ind}}`);
		lines.push('');
		lines.push(`${ind}static func suiColor(_ lightHex: String, _ darkHex: String, _ lightAlpha: Double = 1.0, _ darkAlpha: Double = 1.0) -> Color {`);
		lines.push(`${ind}${ind}let uic: UIColor = color(lightHex).withAlphaComponent(lightAlpha) | color(darkHex).withAlphaComponent(darkAlpha)`);
		lines.push(`${ind}${ind}return Color(uic)`);
		lines.push(`${ind}}`);
		lines.push('}');
		lines.push('');
	}

	// ── Tier 4: SwiftUI Color API (match-existing enum mode only) ────────
	if (isEnumMode && isFlatLD && byCategory.size > 0) {
		const apiName = conventions.apiEnumName || 'ColorStyle';
		const primName = conventions.primitiveEnumName || 'PrimitiveColors';

		if (!conventions.hasUIColorTier) {
			lines.push('// MARK: - Color API');
			lines.push(`public enum ${apiName} {`);
			lines.push(`${ind}private static func colorFromHex(_ hex: String) -> Color {`);
			lines.push(`${ind}${ind}let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex`);
			lines.push(`${ind}${ind}let scanner = Scanner(string: h)`);
			lines.push(`${ind}${ind}var rgb: UInt64 = 0`);
			lines.push(`${ind}${ind}scanner.scanHexInt64(&rgb)`);
			lines.push(`${ind}${ind}let r = Double((rgb >> 16) & 0xFF) / 255`);
			lines.push(`${ind}${ind}let g = Double((rgb >> 8) & 0xFF) / 255`);
			lines.push(`${ind}${ind}let b = Double(rgb & 0xFF) / 255`);
			lines.push(`${ind}${ind}return Color(.sRGB, red: r, green: g, blue: b, opacity: 1)`);
			lines.push(`${ind}}`);
			lines.push('');
			lines.push(`${ind}static func suiColor(_ lightHex: String, _ darkHex: String) -> Color {`);
			lines.push(`${ind}${ind}let light = colorFromHex(lightHex)`);
			lines.push(`${ind}${ind}let dark = colorFromHex(darkHex)`);
			lines.push(`${ind}${ind}#if canImport(UIKit)`);
			lines.push(`${ind}${ind}return Color(uiColor: UIColor { trait in`);
			lines.push(`${ind}${ind}${ind}trait.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)`);
			lines.push(`${ind}${ind}})`);
			lines.push(`${ind}${ind}#elseif canImport(AppKit)`);
			lines.push(`${ind}${ind}return Color(nsColor: NSColor(name: nil) { appearance in`);
			lines.push(`${ind}${ind}${ind}appearance.bestMatch(from: [.darkAqua, .vibrantDark]) != nil`);
			lines.push(`${ind}${ind}${ind}${ind}? NSColor(dark) : NSColor(light)`);
			lines.push(`${ind}${ind}})`);
			lines.push(`${ind}${ind}#else`);
			lines.push(`${ind}${ind}return light`);
			lines.push(`${ind}${ind}#endif`);
			lines.push(`${ind}}`);
			lines.push('}');
			lines.push('');
		}

		lines.push('// MARK: - SwiftUI Color API');
		lines.push(`public extension ${apiName} {`);

		const orderedCategories = orderCategories(byCategory.keys());

		for (const category of orderedCategories) {
			const tokens = byCategory.get(category)!;
			lines.push(`${ind}// ${capitalize(category)}`);
			for (const token of tokens) {
				if (isNew(token.swiftName)) {
					for (const cl of newTokenComment('//')) lines.push(`${ind}${cl}`);
				}
				const lightRef = `${primName}.${token.lightName}`;
				const darkRef = token.isStatic || token.lightName === token.darkName
					? lightRef
					: `${primName}.${token.darkName}`;
				const needsAlpha = (token.lightAlpha != null && token.lightAlpha < 1) ||
					(token.darkAlpha != null && token.darkAlpha < 1);
				if (needsAlpha) {
					const la = roundAlpha(token.lightAlpha ?? 1);
					const da = roundAlpha(token.darkAlpha ?? 1);
					lines.push(`${ind}static var ${token.swiftName}: Color = suiColor(${lightRef}, ${darkRef}, ${la}, ${da})`);
				} else {
					lines.push(`${ind}static var ${token.swiftName}: Color = suiColor(${lightRef}, ${darkRef})`);
				}
			}
		}
		lines.push('}');
		lines.push('');
	}

	return lines.join('\n') + '\n';
}

function formatPrimitiveDecl(entry: PrimitiveEntry, conventions: DetectedSwiftConventions): string {
	const ind = conventions.indent;
	const keyword = conventions.useComputedVar ? 'var' : 'let';

	if (conventions.primitiveFormat === 'stringHex') {
		const hex = figmaToStringHex(entry.r, entry.g, entry.b, entry.alpha);
		return `${ind}static ${keyword} ${entry.swiftName} = "${hex}"`;
	}

	const hex = figmaToSwiftHex(entry.r, entry.g, entry.b, entry.alpha);
	return `${ind}static ${keyword} ${entry.swiftName} = Color(hex: ${hex})`;
}

function formatSemanticColorDecl(
	entry: SemanticEntry,
	conventions: DetectedSwiftConventions
): string[] {
	const ind = conventions.indent;
	const keyword = conventions.useComputedVar ? 'var' : 'let';

	if (conventions.semanticFormat === 'flatLightDark') {
		if (entry.isStatic || entry.lightName === entry.darkName) {
			const hex = figmaToStringHex(
				entry.lightR ?? 0, entry.lightG ?? 0, entry.lightB ?? 0, entry.lightAlpha ?? 1
			);
			return [`${ind}static ${keyword} ${entry.swiftName} = "${hex}"`];
		}
		const lightHex = figmaToStringHex(
			entry.lightR ?? 0, entry.lightG ?? 0, entry.lightB ?? 0, entry.lightAlpha ?? 1
		);
		const darkHex = figmaToStringHex(
			entry.darkR ?? 0, entry.darkG ?? 0, entry.darkB ?? 0, entry.darkAlpha ?? 1
		);
		return [
			`${ind}static ${keyword} ${entry.swiftName}Light = "${lightHex}"`,
			`${ind}static ${keyword} ${entry.swiftName}Dark = "${darkHex}"`
		];
	}

	if (entry.isStatic) {
		return [`${ind}static ${keyword} ${entry.swiftName} = Color.${entry.lightName}`];
	}
	return [`${ind}static ${keyword} ${entry.swiftName} = Color(light: .${entry.lightName}, dark: .${entry.darkName})`];
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

function roundAlpha(a: number): string {
	const rounded = parseFloat(a.toFixed(2));
	return rounded === Math.floor(rounded) ? `${rounded}.0` : `${rounded}`;
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

