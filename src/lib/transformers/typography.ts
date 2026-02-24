/**
 * Typography Transformer
 *
 * Parses Figma's typography.tokens.json export format:
 *   { "typography": { "droid/body/body-R": { "$type": "typography", "$value": { ... } } } }
 *
 * Platform mapping:
 *   droid/ tokens → Web (SCSS + TS) AND Android (Kotlin)
 *   ios/   tokens → iOS (Swift) only
 *   other  tokens → shared (included in Web output)
 *
 * Outputs:
 *   Typography.scss   (droid + shared tokens — SCSS mixins + CSS custom properties) — web
 *   Typography.ts     (droid + shared tokens — typed TypeScript objects)             — web
 *   Typography.swift  (ios/ tokens — SwiftUI Font extensions)                        — ios
 *   Typography.kt     (droid/ tokens — Compose TextStyle objects)                    — android
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { capitalize, bugWarningBlock } from './shared.js';

// ─── Internal types ───────────────────────────────────────────────────────────

interface TypographyValue {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	lineHeight: number;
	letterSpacing: number; // px, rounded to 3 dp
}

interface ParsedEntry {
	fullKey: string; // "droid-xlarge-title-r" (with platform prefix)
	shortKey: string; // "xlarge-title-r" (no platform prefix — for platform-specific files)
	category: string; // "xlarge-title"
	targetPlatform: 'android' | 'ios' | 'shared';
	value: TypographyValue;
	figmaName: string;
}

// ─── Typography conventions ──────────────────────────────────────────────────

export interface DetectedTypographyConventions {
	scss: {
		varPrefix: string; // e.g. "$font-" — prefix for SCSS variables
		hasCssCustomProperties: boolean;
		hasMixins: boolean;
		mixinPrefix: string; // e.g. "font-"
		includesFontFamily: boolean;
		includesFontWeight: boolean;
		sizeUnit: 'rem' | 'px';
		heightUnit: 'rem' | 'unitless';
		spacingUnit: 'px' | 'em';
		twoTier: boolean; // primitive variables + semantic mixins
	};
	ts: {
		namingCase: 'SCREAMING_SNAKE' | 'camelCase';
		constPrefix: string; // e.g. "FONT_"
		includesFontFamily: boolean;
		hasInterface: boolean;
		interfaceName: string | null;
		valueFormat: 'string' | 'number'; // string rem vs number px
		twoTier: boolean; // private size objects + exported aliases
		exportWeights: boolean;
	};
	swift: {
		architecture: 'enum' | 'struct';
		typeName: string; // e.g. "TypographyStyle"
		dataStructName: string | null; // e.g. "FontData" for enum pattern
		dataStructProps: string[]; // e.g. ["fontWeight", "size", "lineHeight"]
		uiFramework: 'uikit' | 'swiftui' | 'both';
		includesTracking: boolean;
		usesDynamicTypeScaling: boolean;
		dynamicTypeMethodName: string | null; // e.g. "calculateFontSize"
		nameMap: Record<string, string>; // lowercased name → original casing
	};
	kotlin: {
		architecture: 'object' | 'companion' | 'top-level' | 'class';
		containerName: string; // e.g. "TypographyTokens"
		className: string | null; // e.g. "RTypography" for class architecture
		packageName: string; // e.g. "com.example.design"
		usesTextStyle: boolean;
		customDataClass: string | null;
		dataClassProps: string[];
		includesM3Builder: boolean;
		includesLineHeightStyle: boolean;
		namingStyle: 'camelCase' | 'snake_case';
		isImmutable: boolean;
		nameMap: Record<string, string>;
		bugWarnings: string[];
	};
}

const BEST_PRACTICE_TYPO_CONVENTIONS: DetectedTypographyConventions = {
	scss: {
		varPrefix: '$typo-',
		hasCssCustomProperties: true,
		hasMixins: true,
		mixinPrefix: 'typo-',
		includesFontFamily: true,
		includesFontWeight: true,
		sizeUnit: 'rem',
		heightUnit: 'unitless',
		spacingUnit: 'em',
		twoTier: false
	},
	ts: {
		namingCase: 'camelCase',
		constPrefix: 'typo',
		includesFontFamily: true,
		hasInterface: true,
		interfaceName: 'TypographyToken',
		valueFormat: 'number',
		twoTier: false,
		exportWeights: false
	},
	swift: {
		architecture: 'struct',
		typeName: 'TypographyStyle',
		dataStructName: null,
		dataStructProps: [],
		uiFramework: 'swiftui',
		includesTracking: true,
		usesDynamicTypeScaling: false,
		dynamicTypeMethodName: null,
		nameMap: {}
	},
	kotlin: {
		architecture: 'object',
		containerName: 'TypographyTokens',
		className: null,
		packageName: 'com.example.design',
		usesTextStyle: true,
		customDataClass: null,
		dataClassProps: [],
		includesM3Builder: true,
		includesLineHeightStyle: false,
		namingStyle: 'camelCase',
		isImmutable: false,
		nameMap: {},
		bugWarnings: []
	}
};

export function detectTypographyConventions(
	refScss?: string,
	refTs?: string,
	bestPractices?: boolean,
	refSwift?: string,
	refKotlin?: string
): DetectedTypographyConventions {
	if (bestPractices) return BEST_PRACTICE_TYPO_CONVENTIONS;

	const hasAnyRef = refScss || refTs || refSwift || refKotlin;
	if (!hasAnyRef) return BEST_PRACTICE_TYPO_CONVENTIONS;

	const scss = refScss ? detectScssConventions(refScss) : BEST_PRACTICE_TYPO_CONVENTIONS.scss;
	const ts = refTs ? detectTsConventions(refTs) : BEST_PRACTICE_TYPO_CONVENTIONS.ts;
	const swift = refSwift ? detectSwiftConventions(refSwift) : BEST_PRACTICE_TYPO_CONVENTIONS.swift;
	const kotlin = refKotlin
		? detectKotlinConventions(refKotlin)
		: BEST_PRACTICE_TYPO_CONVENTIONS.kotlin;
	return { scss, ts, swift, kotlin };
}

function detectScssConventions(content: string): DetectedTypographyConventions['scss'] {
	const lines = content.split('\n');

	const varLines = lines.filter((l) => /^\$[\w-]+:\s/.test(l.trim()));
	const firstVar = varLines[0]?.trim() ?? '';
	const varMatch = firstVar.match(/^\$([\w-]+?)-(?:size|height|spacing|weight)/);
	const varPrefix = varMatch ? `$${varMatch[1]}-` : '$font-';

	const hasCssCustomProperties = lines.some((l) => l.includes(':root') || l.includes('--'));
	const hasMixins = lines.some((l) => /^@mixin\s/.test(l.trim()));
	const mixinMatch = lines.find((l) => /^@mixin\s/.test(l.trim()))?.match(/@mixin\s+([\w-]+)/);
	const mixinName = mixinMatch?.[1] ?? '';
	const mixinPrefix = mixinName ? mixinName.replace(/-[\w]+$/, '-').replace(/-$/, '-') : 'font-';

	const includesFontFamily = lines.some(
		(l) => l.includes('font-family') && !l.trim().startsWith('//')
	);
	const includesFontWeight = varLines.some((l) => /weight/.test(l));

	const sizeUnit: 'rem' | 'px' = varLines.some((l) => /size.*rem/.test(l)) ? 'rem' : 'px';
	const heightUnit: 'rem' | 'unitless' = varLines.some((l) => /height.*rem/.test(l))
		? 'rem'
		: 'unitless';
	const spacingUnit: 'px' | 'em' = varLines.some((l) => /spacing.*em/.test(l) && !/rem/.test(l))
		? 'em'
		: 'px';

	const twoTier = varLines.length > 0 && hasMixins;

	return {
		varPrefix,
		hasCssCustomProperties,
		hasMixins,
		mixinPrefix,
		includesFontFamily,
		includesFontWeight,
		sizeUnit,
		heightUnit,
		spacingUnit,
		twoTier
	};
}

function detectTsConventions(content: string): DetectedTypographyConventions['ts'] {
	const lines = content.split('\n');

	const exportConsts = lines.filter((l) => /^export\s+const\s/.test(l.trim()));
	const privateConsts = lines.filter(
		(l) => /^const\s+[A-Z]/.test(l.trim()) && !l.trim().startsWith('export')
	);

	const isScreaming = exportConsts.some((l) => /export\s+const\s+[A-Z_]+\s/.test(l));
	const namingCase: 'SCREAMING_SNAKE' | 'camelCase' = isScreaming ? 'SCREAMING_SNAKE' : 'camelCase';

	const firstExport = exportConsts[0]?.trim() ?? '';
	const prefixMatch = firstExport.match(/export\s+const\s+([A-Z]+_)/);
	const constPrefix = prefixMatch ? prefixMatch[1] : 'FONT_';

	const includesFontFamily = lines.some(
		(l) => l.includes('fontFamily') && !l.trim().startsWith('//')
	);

	const hasInterface = lines.some((l) => /^(export\s+)?interface\s/.test(l.trim()));
	const interfaceMatch = lines
		.find((l) => /^(export\s+)?interface\s/.test(l.trim()))
		?.match(/interface\s+(\w+)/);
	const interfaceName = interfaceMatch?.[1] ?? null;

	const valueFormat: 'string' | 'number' =
		lines.some((l) => /fontSize:\s*'/.test(l)) ? 'string' : 'number';

	const twoTier = privateConsts.length > 0 && exportConsts.some((l) => /=\s+[A-Z_]+\s*;/.test(l));

	const exportWeights = exportConsts.some((l) => /WEIGHT/.test(l));

	return {
		namingCase,
		constPrefix,
		includesFontFamily,
		hasInterface,
		interfaceName,
		valueFormat,
		twoTier,
		exportWeights
	};
}

function detectSwiftConventions(content: string): DetectedTypographyConventions['swift'] {
	const lines = content.split('\n');

	// Architecture: enum (with cases) vs struct (with static lets)
	const enumMatch = lines
		.find((l) => /^\s*(?:public\s+)?enum\s+\w+/.test(l))
		?.match(/enum\s+(\w+)/);
	const hasEnumCases = lines.some((l) => /^\s*case\s+\w+/.test(l));
	const isEnum = !!enumMatch && hasEnumCases;

	const structMatch = lines
		.find((l) => /^\s*(?:public\s+)?struct\s+\w+/.test(l) && !/ViewModifier/.test(l))
		?.match(/struct\s+(\w+)/);

	const architecture: 'enum' | 'struct' = isEnum ? 'enum' : 'struct';
	const typeName = (isEnum ? enumMatch?.[1] : structMatch?.[1]) ?? 'TypographyStyle';

	// Data struct (for enum pattern — the struct that fontData returns)
	let dataStructName: string | null = null;
	const dataStructProps: string[] = [];

	if (isEnum) {
		// Prefer the struct referenced as a return type in computed properties
		const fontDataReturnMatch = content.match(/var\s+fontData\s*:\s*(\w+)/);
		if (fontDataReturnMatch) {
			dataStructName = fontDataReturnMatch[1];
		} else {
			const allStructs = lines.filter((l) => /^\s*(?:public\s+)?struct\s+\w+/.test(l));
			for (const sl of allStructs) {
				const sm = sl.match(/struct\s+(\w+)/);
				if (sm && sm[1] !== typeName && !/ViewModifier|Constants/.test(sl)) {
					dataStructName = sm[1];
					break;
				}
			}
		}
		if (dataStructName) {
			let inStruct = false;
			let braceDepth = 0;
			for (const line of lines) {
				if (line.includes(`struct ${dataStructName}`)) {
					inStruct = true;
					braceDepth = 0;
				}
				if (inStruct) {
					braceDepth += (line.match(/\{/g) || []).length;
					braceDepth -= (line.match(/\}/g) || []).length;
					const propMatch = line.match(/\b(?:let|var)\s+(\w+)\s*:/);
					if (propMatch) dataStructProps.push(propMatch[1]);
					if (braceDepth <= 0 && inStruct && line.includes('}')) break;
				}
			}
		}
	}

	// UI framework
	const hasUIKit = lines.some((l) => /\bUIFont\b|\bimport\s+UIKit\b/.test(l));
	const hasSwiftUI = lines.some(
		(l) => /\bimport\s+SwiftUI\b|\bFont\.system\b|\bFont\.custom\b/.test(l)
	);
	const uiFramework: 'uikit' | 'swiftui' | 'both' =
		hasUIKit && hasSwiftUI ? 'both' : hasUIKit ? 'uikit' : 'swiftui';

	// Tracking / letter-spacing
	const includesTracking = lines.some(
		(l) => /\btracking\b|\bletterSpacing\b/i.test(l) && !l.trim().startsWith('//')
	);

	// Dynamic type scaling (e.g. calculateFontSize)
	let usesDynamicTypeScaling = false;
	let dynamicTypeMethodName: string | null = null;

	const dynamicMethodMatch = content.match(
		/\bstatic\s+func\s+(\w+)\s*\(\s*_\s+\w+\s*:\s*CGFloat/
	);
	if (dynamicMethodMatch) {
		const candidateName = dynamicMethodMatch[1];
		const hasContentSizeRef =
			/UIContentSizeCategory|preferredContentSizeCategory/.test(content);
		const isCalledInReturn = new RegExp(
			`${typeName}\\.${candidateName}\\(|self\\.${candidateName}\\(`
		).test(content);
		if (hasContentSizeRef || isCalledInReturn) {
			usesDynamicTypeScaling = true;
			dynamicTypeMethodName = candidateName;
		}
	}

	// Name map from case names (enum) or static let names (struct)
	const nameMap: Record<string, string> = {};
	for (const line of lines) {
		const m = isEnum
			? line.match(/^\s*case\s+(\w+)/)
			: line.match(/^\s*static\s+let\s+(\w+)/);
		if (m) nameMap[m[1].toLowerCase()] = m[1];
	}

	return {
		architecture,
		typeName,
		dataStructName,
		dataStructProps,
		uiFramework,
		includesTracking,
		usesDynamicTypeScaling,
		dynamicTypeMethodName,
		nameMap
	};
}

function detectKotlinConventions(content: string): DetectedTypographyConventions['kotlin'] {
	const lines = content.split('\n');

	// Package
	const packageMatch = lines
		.find((l) => /^\s*package\s+/.test(l))
		?.match(/package\s+([\w.]+)/);
	const packageName = packageMatch?.[1] ?? 'com.example.design';

	// @Immutable annotation
	const isImmutable = lines.some((l) => /^\s*@Immutable\b/.test(l));

	// Architecture: class > object > companion > top-level
	const classMatch = lines
		.find((l) => /^\s*class\s+\w+.*constructor/.test(l) || /^\s*class\s+\w+\s*\(/.test(l))
		?.match(/class\s+(\w+)/);
	const objectMatch = lines
		.find((l) => /^\s*(?:internal\s+)?object\s+\w+/.test(l))
		?.match(/object\s+(\w+)/);
	const hasCompanion = lines.some((l) => /companion\s+object/.test(l));
	const topLevelVals = lines.filter(
		(l) => /^\s*val\s+\w+/.test(l.trim()) && !/^\s*(?:internal\s+)?object/.test(l.trim())
	);

	let architecture: 'object' | 'companion' | 'top-level' | 'class' = 'object';
	let containerName = 'TypographyTokens';
	let className: string | null = null;

	if (classMatch && (isImmutable || /internal\s+constructor/.test(content))) {
		architecture = 'class';
		className = classMatch[1];
		containerName = classMatch[1];
	} else if (objectMatch) {
		architecture = 'object';
		containerName = objectMatch[1];
	} else if (hasCompanion) {
		architecture = 'companion';
	} else if (topLevelVals.length > 0) {
		architecture = 'top-level';
	}

	// TextStyle usage
	const usesTextStyle = lines.some((l) => /\bTextStyle\s*\(/.test(l));

	// LineHeightStyle
	const includesLineHeightStyle = lines.some((l) => /\bLineHeightStyle\s*\(/.test(l));

	// Naming style: count snake_case vs camelCase val declarations
	const snakeVals = lines.filter((l) => /^\s*val\s+[a-z]+_[a-z]/.test(l)).length;
	const camelVals = lines.filter((l) => /^\s*val\s+[a-z]+[A-Z]/.test(l)).length;
	const namingStyle: 'camelCase' | 'snake_case' = snakeVals > camelVals ? 'snake_case' : 'camelCase';

	// Custom data class
	const dataClassMatch = lines
		.find((l) => /^\s*data\s+class\s+/.test(l))
		?.match(/data\s+class\s+(\w+)/);
	const customDataClass = dataClassMatch?.[1] ?? null;

	const dataClassProps: string[] = [];
	if (customDataClass) {
		const dcLine = lines.find((l) => l.includes(`data class ${customDataClass}`));
		const propsStr = dcLine?.match(/\((.*)\)/)?.[1] ?? '';
		for (const seg of propsStr.split(',')) {
			const propMatch = seg.match(/val\s+(\w+)/);
			if (propMatch) dataClassProps.push(propMatch[1]);
		}
	}

	// M3 builder
	const includesM3Builder = lines.some(
		(l) => /\bTypography\s*\(/.test(l) || /MaterialTheme/.test(l)
	);

	// Name map from val declarations (including constructor parameters)
	const nameMap: Record<string, string> = {};
	for (const line of lines) {
		const valMatch = line.match(/^\s*val\s+(\w+)\s*[=:]/);
		if (valMatch) nameMap[valMatch[1].toLowerCase()] = valMatch[1];
	}

	const bugWarnings: string[] = [];
	if (/footnote.*this\.subhead/i.test(content)) {
		bugWarnings.push('footnote copy() defaults reference "this.subhead_*" instead of "this.footnote_*" — copy-paste bug.');
	}
	if (/RLocalTypography|LocalTypography/i.test(content) && !/slprice/i.test(content)) {
		bugWarnings.push('RLocalTypography is missing "slprice" entries. Generated output includes all tokens.');
	}

	return {
		architecture,
		containerName,
		className,
		packageName,
		usesTextStyle,
		customDataClass,
		dataClassProps,
		includesM3Builder,
		includesLineHeightStyle,
		namingStyle,
		isImmutable,
		nameMap,
		bugWarnings
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToTypography(
	typographyJson: Record<string, unknown>,
	platforms: Platform[],
	conventions?: DetectedTypographyConventions
): TransformResult[] {
	const conv = conventions ?? BEST_PRACTICE_TYPO_CONVENTIONS;

	let raw = typographyJson['typography'];
	if (!raw || typeof raw !== 'object') {
		const hasTypographyEntries = Object.values(typographyJson).some(
			(v) => v && typeof v === 'object' && (v as Record<string, unknown>).$type === 'typography'
		);
		if (hasTypographyEntries) {
			raw = typographyJson;
		} else {
			return [];
		}
	}

	const SKIP_VARIANT_RE = /\((underline|strikethrough|headline)\)/i;
	const entries = parseEntries(raw as Record<string, unknown>)
		.filter((e) => !SKIP_VARIANT_RE.test(e.figmaName));
	/* v8 ignore next -- @preserve */
	if (entries.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		const webEntries = entries
			.filter((e) => e.targetPlatform !== 'ios')
			.map((e) => (e.targetPlatform === 'android' ? { ...e, fullKey: e.shortKey } : e));
		if (webEntries.length > 0) {
			results.push(generateScss(webEntries, conv.scss));
			results.push(generateTs(webEntries, conv.ts));
		}
	}

	if (platforms.includes('ios')) {
		const ios = entries.filter((e) => e.targetPlatform === 'ios');
		if (ios.length > 0) results.push(generateSwift(ios, conv.swift));
	}

	if (platforms.includes('android')) {
		const android = entries.filter((e) => e.targetPlatform === 'android');
		if (android.length > 0) results.push(generateKotlin(android, conv.kotlin));
	}

	return results;
}

/** Returns the number of parsed typography entries (for stats). */
export function countTypographyStyles(typographyJson: Record<string, unknown>): number {
	const isTypoEntry = (v: unknown) =>
		v && typeof v === 'object' && (v as Record<string, unknown>).$type === 'typography';
	let raw = typographyJson['typography'];
	if (!raw || typeof raw !== 'object') {
		if (Object.values(typographyJson).some(isTypoEntry)) raw = typographyJson;
		else return 0;
	}
	return Object.values(raw as Record<string, unknown>).filter(isTypoEntry).length;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseEntries(raw: Record<string, unknown>): ParsedEntry[] {
	return Object.entries(raw)
		.filter(([, v]) => {
			if (!v || typeof v !== 'object') return false;
			return (v as Record<string, unknown>).$type === 'typography';
		})
		.map(([name, v]) => {
			const token = v as Record<string, unknown>;
			const val = token.$value as TypographyValue;
			const parts = name.split('/');
			const prefix = parts[0]?.toLowerCase() ?? '';
			const targetPlatform: ParsedEntry['targetPlatform'] =
				prefix === 'ios' ? 'ios' : prefix === 'droid' ? 'android' : 'shared';

			const fullKey = styleNameToKey(name);
			const shortKey =
				targetPlatform !== 'shared' ? fullKey.replace(new RegExp(`^${prefix}-`), '') : fullKey;

			return {
				fullKey,
				shortKey,
				category: extractCategory(parts),
				targetPlatform,
				value: {
					fontFamily: val?.fontFamily ?? '',
					fontSize: val?.fontSize ?? 0,
					fontWeight: val?.fontWeight ?? 400,
					lineHeight: val?.lineHeight ?? 0,
					letterSpacing: roundFloat(val?.letterSpacing ?? 0, 3)
				},
				figmaName: name
			};
		});
}

/**
 * Converts a Figma style name to a kebab-case identifier, deduplicating
 * segments that repeat from the previous path component.
 *
 *   "droid/xlarge title/xlarge title-R"   → "droid-xlarge-title-r"
 *   "ios/body/body-M (underline)"         → "ios-body-m-underline"
 *   "ios/caption/caption-R (strikethrough)"→ "ios-caption-r-strikethrough"
 */
function styleNameToKey(name: string): string {
	const parts = name.split('/');
	const result: string[] = [];

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const modifiers: string[] = [];

		// Extract (modifier) content
		const cleaned = part
			.replace(/\s*\(([^)]+)\)/g, (_m, p1: string) => {
				modifiers.push(p1.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-'));
				return '';
			})
			.trim();

		const normalized = cleaned
			.toLowerCase()
			.replace(/[\s_]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');

		if (!normalized) {
			result.push(...modifiers);
			continue;
		}

		// Dedup: if this segment starts with the previous segment (repeated prefix pattern)
		if (i > 0 && result.length > 0) {
			const prevPart = parts[i - 1];
			const prevNorm = prevPart
				.replace(/\s*\([^)]+\)/g, '')
				.trim()
				.toLowerCase()
				.replace(/[\s_]+/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '');

			if (normalized.startsWith(prevNorm) && normalized !== prevNorm) {
				const suffix = normalized.slice(prevNorm.length).replace(/^-/, '');
				if (suffix) result.push(suffix);
				result.push(...modifiers);
				continue;
			}
		}

		result.push(normalized);
		result.push(...modifiers);
	}

	return result.filter(Boolean).join('-');
}

function extractCategory(parts: string[]): string {
	const categoryPart = parts[1] ?? parts[0] ?? '';
	return categoryPart.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function roundFloat(n: number, dp: number): number {
	const factor = Math.pow(10, dp);
	return Math.round(n * factor) / factor;
}

// ─── Unit conversion helpers ──────────────────────────────────────────────────

function pxToRem(px: number): string {
	const rem = px / 16;
	return `${parseFloat(rem.toFixed(4))}rem`;
}

function unitlessLineHeight(lineHeight: number, fontSize: number): string {
	if (fontSize === 0) return '1';
	return parseFloat((lineHeight / fontSize).toFixed(4)).toString();
}

function pxToEm(letterSpacing: number, fontSize: number): string {
	if (fontSize === 0 || letterSpacing === 0) return '0';
	return `${parseFloat((letterSpacing / fontSize).toFixed(4))}em`;
}

// ─── SCSS Generator ───────────────────────────────────────────────────────────

function generateScss(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['scss']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.scss');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	const fmtSize = (px: number) => (conv.sizeUnit === 'rem' ? pxToRem(px) : `${px}px`);
	const fmtHeight = (lh: number, fs: number) =>
		conv.heightUnit === 'rem' ? pxToRem(lh) : unitlessLineHeight(lh, fs);
	const fmtSpacing = (ls: number, fs: number) =>
		conv.spacingUnit === 'em' ? pxToEm(ls, fs) : `${ls}px`;

	if (conv.twoTier) {
		// Two-tier: SCSS variables for primitives, then semantic mixins referencing them
		const varPfx = conv.varPrefix.replace(/^\$/, '');
		const weights = new Set(entries.map((e) => e.value.fontWeight));

		if (conv.includesFontWeight && weights.size > 0) {
			lines.push('// Font weights');
			for (const w of [...weights].sort((a, b) => a - b)) {
				lines.push(`$${varPfx}weight-${w}: ${w};`);
			}
			lines.push('');
		}

		lines.push('// Font sizes, line heights, and letter spacings');
		const emittedSizeKeys = new Set<string>();
		for (const entry of entries) {
			const sizeKey = kebabToScssSize(entry.fullKey);
			if (emittedSizeKeys.has(sizeKey)) continue;
			emittedSizeKeys.add(sizeKey);
			const { value: v } = entry;
			lines.push(
				`$${varPfx}${sizeKey}-size: ${fmtSize(v.fontSize)};${v.fontSize ? ` // ${fmtSize(v.fontSize)}` + (conv.sizeUnit === 'rem' ? ` * 16 = ${v.fontSize}px` : '') : ''}`
			);
			lines.push(`$${varPfx}${sizeKey}-height: ${fmtHeight(v.lineHeight, v.fontSize)};`);
			lines.push(`$${varPfx}${sizeKey}-spacing: ${fmtSpacing(v.letterSpacing, v.fontSize)};`);
			lines.push('');
		}

		if (conv.hasMixins) {
			lines.push('// Typography mixins for easy usage');
			for (const entry of entries) {
				const sizeKey = kebabToScssSize(entry.fullKey);
				const mixinName = kebabToMixinName(entry.fullKey, conv.mixinPrefix);
				lines.push(`@mixin ${mixinName} {`);
				if (conv.includesFontFamily) {
					lines.push(`  font-family: '${entry.value.fontFamily}', sans-serif;`);
				}
				lines.push(`  font-size: $${varPfx}${sizeKey}-size;`);
				lines.push(`  line-height: $${varPfx}${sizeKey}-height;`);
				lines.push(`  letter-spacing: $${varPfx}${sizeKey}-spacing;`);
				lines.push('}');
				lines.push('');
			}
		}
	} else {
		// Best-practices flat format
		lines.push(`// Usage: @include ${conv.mixinPrefix}{name}; e.g. @include ${conv.mixinPrefix}body-r;`);
		lines.push('');

		if (conv.hasCssCustomProperties) {
			lines.push('// CSS custom properties — for runtime / JS access');
			lines.push(':root {');
			for (const entry of entries) {
				const { fullKey: k, value: v } = entry;
				if (conv.includesFontFamily) {
					lines.push(`  --${conv.mixinPrefix}${k}-family: '${v.fontFamily}', sans-serif;`);
				}
				lines.push(`  --${conv.mixinPrefix}${k}-size: ${fmtSize(v.fontSize)};`);
				lines.push(`  --${conv.mixinPrefix}${k}-weight: ${v.fontWeight};`);
				lines.push(`  --${conv.mixinPrefix}${k}-line-height: ${fmtHeight(v.lineHeight, v.fontSize)};`);
				lines.push(`  --${conv.mixinPrefix}${k}-letter-spacing: ${fmtSpacing(v.letterSpacing, v.fontSize)};`);
			}
			lines.push('}');
			lines.push('');
		}

		if (conv.hasMixins) {
			const grouped = groupEntries(entries);
			for (const [groupLabel, groupEntries] of grouped) {
				lines.push(`// ${groupLabel}`);
				for (const entry of groupEntries) {
					const { fullKey: k, value: v } = entry;
					lines.push(`@mixin ${conv.mixinPrefix}${k} {`);
					if (conv.includesFontFamily) {
						lines.push(`  font-family: '${v.fontFamily}', sans-serif;`);
					}
					lines.push(`  font-size: ${fmtSize(v.fontSize)};`);
					lines.push(`  font-weight: ${v.fontWeight};`);
					lines.push(`  line-height: ${fmtHeight(v.lineHeight, v.fontSize)};`);
					lines.push(`  letter-spacing: ${fmtSpacing(v.letterSpacing, v.fontSize)};`);
					lines.push('}');
				}
				lines.push('');
			}
		}
	}

	return {
		filename: 'Typography.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}

function kebabToScssSize(key: string): string {
	const parts = key.split('-');
	if (parts.length <= 2) return parts.join('-');
	return parts.slice(0, 2).join('-');
}

function kebabToMixinName(key: string, prefix: string): string {
	return `${prefix}${key}`;
}

// ─── TypeScript Generator ─────────────────────────────────────────────────────

function generateTs(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['ts']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.ts');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	if (conv.twoTier) {
		// Match-existing two-tier: weight consts, private size objects, exported semantic aliases
		if (conv.exportWeights) {
			const weights = new Set(entries.map((e) => e.value.fontWeight));
			for (const w of [...weights].sort((a, b) => a - b)) {
				lines.push(`export const ${conv.constPrefix}WEIGHT_${w} = ${w};`);
			}
			lines.push('');
		}

		for (const entry of entries) {
			const sizeConst = kebabToScreaming(entry.fullKey, conv.constPrefix);
			const v = entry.value;
			lines.push(`const ${sizeConst} = {`);
			if (conv.includesFontFamily) {
				lines.push(`  fontFamily: '${v.fontFamily}',`);
			}
			if (conv.valueFormat === 'string') {
				lines.push(`  fontSize: '${pxToRem(v.fontSize)}',`);
				lines.push(`  lineHeight: '${pxToRem(v.lineHeight)}',`);
				lines.push(`  letterSpacing: '${v.letterSpacing}px',`);
			} else {
				lines.push(`  fontSize: ${v.fontSize},`);
				lines.push(`  lineHeight: ${v.lineHeight},`);
				lines.push(`  letterSpacing: ${v.letterSpacing},`);
			}
			lines.push('};');
		}
		lines.push('');

		lines.push('// Typography objects with descriptive names for easy usage');
		for (const entry of entries) {
			const sizeConst = kebabToScreaming(entry.fullKey, conv.constPrefix);
			const semanticName = kebabToSemanticScreaming(entry.fullKey, conv.constPrefix);
			lines.push(`export const ${semanticName} = ${sizeConst};`);
		}
	} else {
		// Best-practices flat format
		if (conv.hasInterface && conv.interfaceName) {
			lines.push(`export interface ${conv.interfaceName} {`);
			if (conv.includesFontFamily) {
				lines.push('  fontFamily: string;');
			}
			lines.push('  fontSize: number; // px (raw Figma value)');
			lines.push("  fontSizeRem: string; // e.g. \"1rem\"");
			lines.push('  fontWeight: number;');
			lines.push('  lineHeight: number; // px (raw Figma value)');
			lines.push('  lineHeightUnitless: number; // e.g. 1.5');
			lines.push('  letterSpacing: number; // px (raw Figma value)');
			lines.push("  letterSpacingEm: string; // e.g. \"0.0313em\"");
			lines.push('}');
			lines.push('');
		}

		const grouped = groupEntries(entries);
		const typeAnnotation = conv.hasInterface && conv.interfaceName ? `: ${conv.interfaceName}` : '';

		for (const [groupLabel, groupEntries] of grouped) {
			lines.push(`// ${groupLabel}`);
			for (const entry of groupEntries) {
				const constName =
					conv.namingCase === 'SCREAMING_SNAKE'
						? kebabToScreaming(entry.fullKey, conv.constPrefix)
						: kebabToCamel(`${conv.constPrefix}${entry.fullKey}`);
				const v = entry.value;
				const lhUnitless =
					v.fontSize === 0 ? 1 : parseFloat((v.lineHeight / v.fontSize).toFixed(4));
				lines.push(`export const ${constName}${typeAnnotation} = {`);
				if (conv.includesFontFamily) {
					lines.push(`  fontFamily: '${v.fontFamily}',`);
				}
				lines.push(`  fontSize: ${v.fontSize},`);
				lines.push(`  fontSizeRem: '${pxToRem(v.fontSize)}',`);
				lines.push(`  fontWeight: ${v.fontWeight},`);
				lines.push(`  lineHeight: ${v.lineHeight},`);
				lines.push(`  lineHeightUnitless: ${lhUnitless},`);
				lines.push(`  letterSpacing: ${v.letterSpacing},`);
				lines.push(`  letterSpacingEm: '${pxToEm(v.letterSpacing, v.fontSize)}',`);
				lines.push('} as const;');
			}
			lines.push('');
		}
	}

	return {
		filename: 'Typography.ts',
		content: lines.join('\n') + '\n',
		format: 'typescript',
		platform: 'web'
	};
}

function kebabToScreaming(key: string, prefix: string): string {
	return prefix + key.toUpperCase().replace(/-/g, '_');
}

function kebabToSemanticScreaming(key: string, prefix: string): string {
	const semantic = key.replace(/-r$/, '').replace(/-/g, '_').toUpperCase();
	return prefix + semantic;
}

// ─── Swift Generator ──────────────────────────────────────────────────────────

const SWIFT_WEIGHTS: Record<number, string> = {
	100: '.ultraLight',
	200: '.thin',
	300: '.light',
	400: '.regular',
	500: '.medium',
	600: '.semibold',
	700: '.bold',
	800: '.heavy',
	900: '.black'
};

function swiftWeight(w: number): string {
	return SWIFT_WEIGHTS[w] ?? '.regular';
}

function swiftTextStyle(fontSize: number): string {
	if (fontSize >= 34) return '.largeTitle';
	if (fontSize >= 28) return '.title';
	if (fontSize >= 22) return '.title2';
	if (fontSize >= 20) return '.title3';
	if (fontSize >= 17) return '.body';
	if (fontSize >= 15) return '.subheadline';
	if (fontSize >= 13) return '.footnote';
	if (fontSize >= 12) return '.caption';
	return '.caption2';
}

function generateSwift(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['swift']
): TransformResult {
	return conv.architecture === 'enum'
		? generateSwiftEnum(entries, conv)
		: generateSwiftStruct(entries, conv);
}

function resolveNameFromMap(
	shortKey: string,
	nameMap: Record<string, string>,
	namingStyle: 'camelCase' | 'snake_case' = 'camelCase'
): string {
	const camel = kebabToCamel(shortKey);
	const mapped = nameMap[camel.toLowerCase()];
	if (mapped) return mapped;
	if (namingStyle === 'snake_case') return kebabToSnake(shortKey);
	return camel;
}

function kebabToSnake(s: string): string {
	return s.replace(/-/g, '_').replace(/_(\d)/g, '$1');
}

// ── SwiftUI struct + static let pattern (best-practices default) ─────────────

function generateSwiftStruct(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['swift']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.swift');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('import SwiftUI');
	lines.push('');

	lines.push('// MARK: - Typography Style');
	const propsDesc = conv.includesTracking
		? 'its tracking and line-spacing values'
		: 'its line-spacing value';
	lines.push(`/// Bundles a SwiftUI Font with ${propsDesc}.`);
	lines.push('/// Apply with: Text("…").typography(.bodyR)');
	lines.push(`public struct ${conv.typeName} {`);
	lines.push('  public let font: Font');
	if (conv.includesTracking) {
		lines.push('  /// Letter-spacing in points (Figma "letterSpacing" value).');
		lines.push('  public let tracking: CGFloat');
	}
	lines.push('  /// Extra space added between lines: lineHeight − fontSize.');
	lines.push('  public let lineSpacing: CGFloat');
	lines.push('');
	const initParams = conv.includesTracking
		? 'font: Font, tracking: CGFloat = 0, lineSpacing: CGFloat = 0'
		: 'font: Font, lineSpacing: CGFloat = 0';
	lines.push(`  public init(${initParams}) {`);
	lines.push('    self.font = font');
	if (conv.includesTracking) lines.push('    self.tracking = tracking');
	lines.push('    self.lineSpacing = lineSpacing');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	lines.push('// MARK: - Typography Modifier');
	lines.push('private struct TypographyModifier: ViewModifier {');
	lines.push(`  let style: ${conv.typeName}`);
	lines.push('');
	lines.push('  func body(content: Content) -> some View {');
	lines.push('    content');
	lines.push('      .font(style.font)');
	if (conv.includesTracking) lines.push('      .tracking(style.tracking)');
	lines.push('      .lineSpacing(style.lineSpacing)');
	lines.push('  }');
	lines.push('}');
	lines.push('');
	lines.push('public extension View {');
	lines.push('  /// Apply a Figma text style. Example: Text("Hello").typography(.bodyR)');
	lines.push(`  func typography(_ style: ${conv.typeName}) -> some View {`);
	lines.push('    modifier(TypographyModifier(style: style))');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	lines.push('// MARK: - Typography Tokens');
	lines.push('// Note: SF Pro is the iOS system font — Font.system() is correct and preferred.');
	lines.push(
		'// relativeTo: maps to a Dynamic Type text style so fonts scale with accessibility settings.'
	);
	lines.push(
		'// lineSpacing = Figma lineHeight − fontSize (approximation for SwiftUI lineSpacing).'
	);
	lines.push(`public extension ${conv.typeName} {`);

	const grouped = groupEntries(entries);
	for (const [groupLabel, groupEntries] of grouped) {
		lines.push(`  // ${groupLabel}`);
		for (const entry of groupEntries) {
			const propName = resolveNameFromMap(entry.shortKey, conv.nameMap);
			const { value: v } = entry;
			const isSfPro = v.fontFamily.toLowerCase().startsWith('sf pro');
			const textStyle = swiftTextStyle(v.fontSize);
			const fontExpr = isSfPro
				? `Font.system(size: ${v.fontSize}, weight: ${swiftWeight(v.fontWeight)}, design: .default)`
				: `Font.custom("${v.fontFamily}", size: ${v.fontSize}, relativeTo: ${textStyle}).weight(${swiftWeight(v.fontWeight)})`;
			const lineSpacing = Math.max(0, v.lineHeight - v.fontSize);
			const hasTracking = conv.includesTracking && v.letterSpacing !== 0;
			if (hasTracking) {
				lines.push(
					`  static let ${propName} = ${conv.typeName}(font: ${fontExpr}, tracking: ${v.letterSpacing}, lineSpacing: ${lineSpacing})`
				);
			} else {
				lines.push(
					`  static let ${propName} = ${conv.typeName}(font: ${fontExpr}, lineSpacing: ${lineSpacing})`
				);
			}
		}
	}

	lines.push('}');
	lines.push('');

	return {
		filename: 'Typography.swift',
		content: lines.join('\n') + '\n',
		format: 'swift',
		platform: 'ios'
	};
}

// ── UIKit enum + switch + FontData pattern (match-existing) ──────────────────

function buildSwiftDataStructArgs(
	v: TypographyValue,
	props: string[],
	wrapFn?: string
): string {
	const wrap = (val: number) => (wrapFn ? `${wrapFn}(${val})` : `${val}`);
	const args: string[] = [];
	for (const prop of props) {
		if (prop === 'fontWeight') {
			args.push(`fontWeight: ${swiftWeight(v.fontWeight)}`);
		} else if (prop === 'size' || prop === 'fontSize') {
			args.push(`${prop}: ${wrap(v.fontSize)}`);
		} else if (prop === 'lineHeight') {
			args.push(`lineHeight: ${wrap(v.lineHeight)}`);
		} else if (prop === 'tracking' || prop === 'letterSpacing') {
			args.push(`${prop}: ${v.letterSpacing}`);
		}
	}
	return args.join(', ');
}

function generateSwiftEnum(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['swift']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.swift');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	if (conv.uiFramework === 'uikit' || conv.uiFramework === 'both') {
		lines.push('import Foundation');
		lines.push('import UIKit');
	}
	if (conv.uiFramework === 'swiftui' || conv.uiFramework === 'both') {
		lines.push('import SwiftUI');
	}
	lines.push('');

	// ── Enum declaration ─────────────────────────────────────────────────────
	lines.push(`public enum ${conv.typeName}: String {`);
	const grouped = groupEntries(entries);
	for (const [, gEntries] of grouped) {
		lines.push('');
		for (const entry of gEntries) {
			lines.push(`    case ${resolveNameFromMap(entry.shortKey, conv.nameMap)}`);
		}
	}
	lines.push('');
	lines.push('}');
	lines.push('');

	// ── FontConstants struct (for dynamic type scaling) ─────────────────────
	if (conv.usesDynamicTypeScaling) {
		lines.push('struct FontConstants {');
		lines.push('');
		lines.push('    static let addingRatio: CGFloat = 1.5');
		lines.push('    static let subtractingRatio: CGFloat = -1.0');
		lines.push('');
		lines.push('}');
		lines.push('');
	}

	// ── Extension with fontData switch ───────────────────────────────────────
	const structName = conv.dataStructName ?? 'FontData';
	const props =
		conv.dataStructProps.length > 0 ? conv.dataStructProps : ['fontWeight', 'size', 'lineHeight'];

	const wrapFn = conv.usesDynamicTypeScaling && conv.dynamicTypeMethodName
		? `${conv.typeName}.${conv.dynamicTypeMethodName}`
		: undefined;

	lines.push(`extension ${conv.typeName} {`);
	lines.push('');
	lines.push(`    var fontData: ${structName} {`);
	lines.push('');
	lines.push('        switch self {');

	for (const [, gEntries] of grouped) {
		lines.push('');
		for (const entry of gEntries) {
			const name = resolveNameFromMap(entry.shortKey, conv.nameMap);
			lines.push(`        case .${name}:`);
			lines.push(
				`            return ${structName}(${buildSwiftDataStructArgs(entry.value, props, wrapFn)})`
			);
		}
	}

	lines.push('');
	lines.push('        }');
	lines.push('');
	lines.push('    }');

	// ── calculateFontSize static method ──────────────────────────────────
	if (conv.usesDynamicTypeScaling && conv.dynamicTypeMethodName) {
		lines.push('');
		lines.push(`    public static func ${conv.dynamicTypeMethodName}(_ standardFontSize: CGFloat, fmax: CGFloat = .infinity, fmin: CGFloat = 11) -> CGFloat {`);
		lines.push('');
		lines.push('        var contentSize: UIContentSizeCategory = .large');
		lines.push('        if UIAccessibility.isLargerTextEnabled {');
		lines.push('            contentSize = UIApplication.shared.preferredContentSizeCategory');
		lines.push('        }');
		lines.push('');
		lines.push('        let minFontSize = standardFontSize < fmin ? standardFontSize : fmin');
		lines.push('        let maxFontSize = standardFontSize > fmax ? standardFontSize : fmax');
		lines.push('        switch contentSize {');
		lines.push('        case .extraSmall:');
		lines.push('            return max(minFontSize, standardFontSize + (FontConstants.subtractingRatio * 3))');
		lines.push('        case .small:');
		lines.push('            return max(minFontSize, standardFontSize + (FontConstants.subtractingRatio * 2))');
		lines.push('        case .medium:');
		lines.push('            return max(minFontSize, standardFontSize + (FontConstants.subtractingRatio * 1))');
		lines.push('        case .large:');
		lines.push('            return standardFontSize');
		lines.push('        case .extraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 1))');
		lines.push('        case .extraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 1.5))');
		lines.push('        case .extraExtraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 2))');
		lines.push('        case .accessibilityMedium:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 3))');
		lines.push('        case .accessibilityLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 3.5))');
		lines.push('        case .accessibilityExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 4))');
		lines.push('        case .accessibilityExtraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 4.5))');
		lines.push('        case .accessibilityExtraExtraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 5))');
		lines.push('        default:');
		lines.push('            return standardFontSize');
		lines.push('        }');
		lines.push('    }');
	}

	lines.push('');
	lines.push('}');
	lines.push('');

	// ── UIFont / SwiftUI bridge extensions ───────────────────────────────────
	if (conv.uiFramework === 'uikit' || conv.uiFramework === 'both') {
		lines.push(`extension ${conv.typeName} {`);
		lines.push('');
		lines.push('    public var font: UIFont {');
		lines.push(
			'        return UIFont.systemFont(ofSize: fontData.size, weight: fontData.fontWeight)'
		);
		lines.push('    }');
		if (conv.uiFramework === 'both') {
			lines.push('');
			lines.push('    public var suiFont: Font {');
			lines.push('        return Font(font)');
			lines.push('    }');
		}
		lines.push('');
		lines.push('}');
		lines.push('');
	}

	// ── Data struct ──────────────────────────────────────────────────────────
	const weightType =
		conv.uiFramework === 'uikit' || conv.uiFramework === 'both'
			? 'UIFont.Weight'
			: 'Font.Weight';

	lines.push(`public struct ${structName} {`);
	lines.push('');
	for (const prop of props) {
		if (prop === 'fontWeight') {
			lines.push(`    let ${prop}: ${weightType}`);
		} else {
			lines.push(`    let ${prop}: CGFloat`);
		}
	}
	lines.push('');
	lines.push('}');
	lines.push('');

	return {
		filename: 'Typography.swift',
		content: lines.join('\n') + '\n',
		format: 'swift',
		platform: 'ios'
	};
}

// ─── Kotlin Generator ─────────────────────────────────────────────────────────

const KOTLIN_WEIGHTS: Record<number, string> = {
	100: 'FontWeight.Thin',
	200: 'FontWeight.ExtraLight',
	300: 'FontWeight.Light',
	400: 'FontWeight.Normal',
	500: 'FontWeight.Medium',
	600: 'FontWeight.SemiBold',
	700: 'FontWeight.Bold',
	800: 'FontWeight.ExtraBold',
	900: 'FontWeight.Black'
};

function kotlinWeight(w: number): string {
	return KOTLIN_WEIGHTS[w] ?? 'FontWeight.Normal';
}

function generateKotlin(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['kotlin']
): TransformResult {
	if (conv.architecture === 'class') {
		return generateKotlinClass(entries, conv);
	}

	const lines: string[] = [];
	const hasReference = Object.keys(conv.nameMap).length > 0;

	lines.push('// Typography.kt');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	lines.push(...bugWarningBlock(conv.bugWarnings, '//'));

	const isDefaultPackage = conv.packageName === 'com.example.design';
	lines.push(
		`package ${conv.packageName}${!hasReference && isDefaultPackage ? ' // TODO: update to your package name' : ''}`
	);
	lines.push('');

	if (conv.includesM3Builder) lines.push('import androidx.compose.material3.Typography');
	if (conv.usesTextStyle || !conv.customDataClass) {
		lines.push('import androidx.compose.ui.text.TextStyle');
		lines.push('import androidx.compose.ui.text.font.FontFamily');
	}
	lines.push('import androidx.compose.ui.text.font.FontWeight');
	if (conv.usesTextStyle || !conv.customDataClass) lines.push('import androidx.compose.ui.unit.sp');
	lines.push('');

	if (!hasReference) {
		lines.push('// TODO: Replace FontFamily.Default with your registered font family.');
		lines.push(
			'// Example: val InterVariable = FontFamily(Font(R.font.inter_variable, FontWeight.Normal),'
		);
		lines.push(
			'//                                          Font(R.font.inter_variable_medium, FontWeight.Medium),'
		);
		lines.push(
			'//                                          Font(R.font.inter_variable_bold, FontWeight.Bold))'
		);
		lines.push('');
	}

	if (conv.customDataClass) {
		const propsStr = conv.dataClassProps
			.map((p) => (p === 'fontWeight' ? `val ${p}: FontWeight` : `val ${p}: Float`))
			.join(', ');
		lines.push(`data class ${conv.customDataClass}(${propsStr})`);
		lines.push('');
	}

	const isObject = conv.architecture === 'object';
	const isCompanion = conv.architecture === 'companion';

	if (isObject) {
		lines.push(`object ${conv.containerName} {`);
	} else if (isCompanion) {
		lines.push(`class ${conv.containerName} {`);
		lines.push('    companion object {');
	}

	const indent = isCompanion ? '        ' : isObject ? '    ' : '';

	const grouped = groupEntries(entries);
	for (const [groupLabel, gEntries] of grouped) {
		lines.push(`${indent}// ${groupLabel}`);
		for (const entry of gEntries) {
			const propName = resolveNameFromMap(entry.shortKey, conv.nameMap, conv.namingStyle);
			const { value: v } = entry;

			if (conv.customDataClass) {
				const args = buildKotlinDataClassArgs(v, conv.dataClassProps);
				lines.push(`${indent}val ${propName} = ${conv.customDataClass}(${args})`);
			} else {
				const lsFormatted = v.letterSpacing === 0 ? '0.sp' : `(${v.letterSpacing}).sp`;
				const fontFamilyComment = hasReference ? '' : ' // TODO: replace with bundled font';
				lines.push(`${indent}val ${propName} = TextStyle(`);
				lines.push(`${indent}    fontFamily = FontFamily.Default,${fontFamilyComment}`);
				lines.push(`${indent}    fontSize = ${v.fontSize}.sp,`);
				lines.push(`${indent}    fontWeight = ${kotlinWeight(v.fontWeight)},`);
				lines.push(`${indent}    lineHeight = ${v.lineHeight}.sp,`);
				lines.push(`${indent}    letterSpacing = ${lsFormatted},`);
				lines.push(`${indent})`);
			}
		}
		lines.push('');
	}

	if (isCompanion) {
		lines.push('    }');
		lines.push('}');
	} else if (isObject) {
		lines.push('}');
	}
	lines.push('');

	if (conv.includesM3Builder) {
		lines.push(
			'// Material3 Typography builder — pass to MaterialTheme(typography = appTypography())'
		);
		lines.push('// TODO: map your token objects to M3 text style roles below.');
		lines.push('fun appTypography() = Typography(');
		lines.push(`    // displayLarge   = ${conv.containerName}.xlargeTitleR,`);
		lines.push(`    // headlineLarge  = ${conv.containerName}.largeTitleR,`);
		lines.push(`    // titleLarge     = ${conv.containerName}.title1R,`);
		lines.push(`    // bodyLarge      = ${conv.containerName}.bodyR,`);
		lines.push(`    // bodyMedium     = ${conv.containerName}.subheadR,`);
		lines.push(`    // bodySmall      = ${conv.containerName}.footnoteR,`);
		lines.push(`    // labelSmall     = ${conv.containerName}.captionR,`);
		lines.push(')');
		lines.push('');
	}

	return {
		filename: 'Typography.kt',
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}

function generateKotlinClass(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['kotlin']
): TransformResult {
	const lines: string[] = [];
	const className = conv.className ?? conv.containerName;

	lines.push('// Typography.kt');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	lines.push(...bugWarningBlock(conv.bugWarnings, '//'));

	lines.push(`package ${conv.packageName}`);
	lines.push('');

	if (conv.isImmutable) lines.push('import androidx.compose.runtime.Immutable');
	lines.push('import androidx.compose.ui.text.TextStyle');
	lines.push('import androidx.compose.ui.text.font.FontFamily');
	lines.push('import androidx.compose.ui.text.font.FontWeight');
	if (conv.includesLineHeightStyle) {
		lines.push('import androidx.compose.ui.text.style.LineHeightStyle');
	}
	lines.push('import androidx.compose.ui.unit.sp');
	lines.push('');

	const propNames = entries.map((e) => resolveNameFromMap(e.shortKey, conv.nameMap, conv.namingStyle));

	// Primary constructor
	if (conv.isImmutable) lines.push('@Immutable');
	lines.push(`class ${className} internal constructor(`);
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`    val ${propNames[i]}: TextStyle${comma}`);
	}
	lines.push(') {');
	lines.push('');

	// Secondary constructor with defaults
	lines.push('    constructor(');
	lines.push('        defaultFontFamily: FontFamily = FontFamily.Default,');
	lines.push('');
	for (let i = 0; i < entries.length; i++) {
		const { value: v } = entries[i];
		const lsFormatted = v.letterSpacing === 0 ? '0.sp' : `(${v.letterSpacing}).sp`;
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]}: TextStyle = TextStyle(`);
		lines.push(`            fontWeight = ${kotlinWeight(v.fontWeight)},`);
		lines.push(`            fontSize = ${v.fontSize}.sp,`);
		lines.push(`            lineHeight = ${v.lineHeight}.sp,`);
		lines.push(`            letterSpacing = ${lsFormatted},`);
		if (conv.includesLineHeightStyle) {
			lines.push('            lineHeightStyle = LineHeightStyle(');
			lines.push('                alignment = LineHeightStyle.Alignment.Center,');
			lines.push('                trim = LineHeightStyle.Trim.None');
			lines.push('            )');
		}
		lines.push(`        )${comma}`);
	}
	lines.push(`    ) : this(`);
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]} = ${propNames[i]}.withDefaultFontFamily(defaultFontFamily)${comma}`);
	}
	lines.push('    )');
	lines.push('');

	// copy()
	lines.push('    fun copy(');
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]}: TextStyle = this.${propNames[i]}${comma}`);
	}
	lines.push(`    ): ${className} = ${className}(`);
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]} = ${propNames[i]}${comma}`);
	}
	lines.push('    )');
	lines.push('');

	// equals()
	lines.push('    override fun equals(other: Any?): Boolean {');
	lines.push('        if (this === other) return true');
	lines.push(`        if (other !is ${className}) return false`);
	for (const name of propNames) {
		lines.push(`        if (${name} != other.${name}) return false`);
	}
	lines.push('        return true');
	lines.push('    }');
	lines.push('');

	// hashCode()
	lines.push('    override fun hashCode(): Int {');
	lines.push(`        var result = ${propNames[0]}.hashCode()`);
	for (let i = 1; i < propNames.length; i++) {
		lines.push(`        result = 31 * result + ${propNames[i]}.hashCode()`);
	}
	lines.push('        return result');
	lines.push('    }');
	lines.push('');

	// toString()
	lines.push('    override fun toString(): String = ""');
	lines.push('}');
	lines.push('');

	// withDefaultFontFamily helper
	lines.push('private fun TextStyle.withDefaultFontFamily(default: FontFamily): TextStyle {');
	lines.push('    return if (fontFamily != null) this else copy(fontFamily = default)');
	lines.push('}');
	lines.push('');

	return {
		filename: 'Typography.kt',
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}

function buildKotlinDataClassArgs(v: TypographyValue, props: string[]): string {
	const args: string[] = [];
	for (const prop of props) {
		if (prop === 'fontWeight') args.push(`fontWeight = ${kotlinWeight(v.fontWeight)}`);
		else if (prop === 'fontSize') args.push(`fontSize = ${v.fontSize}f`);
		else if (prop === 'lineHeight') args.push(`lineHeight = ${v.lineHeight}f`);
		else if (prop === 'letterSpacing') args.push(`letterSpacing = ${v.letterSpacing}f`);
	}
	return args.join(', ');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupEntries(entries: ParsedEntry[]): Map<string, ParsedEntry[]> {
	const map = new Map<string, ParsedEntry[]>();

	for (const entry of entries) {
		const platformLabel =
			entry.targetPlatform === 'android'
				? 'Android (droid)'
				: entry.targetPlatform === 'ios'
					? 'iOS'
					: 'Shared';
		const label = `${platformLabel} — ${capitalize(entry.category.replace(/-/g, ' '))}`;
		const list = map.get(label) ?? [];
		list.push(entry);
		map.set(label, list);
	}

	return map;
}

function kebabToCamel(s: string): string {
	return s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
