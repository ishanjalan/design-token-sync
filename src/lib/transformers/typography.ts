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
import { capitalize } from './shared.js';

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
	}
};

export function detectTypographyConventions(
	refScss?: string,
	refTs?: string,
	bestPractices?: boolean
): DetectedTypographyConventions {
	if (bestPractices || (!refScss && !refTs)) return BEST_PRACTICE_TYPO_CONVENTIONS;

	const scss = refScss ? detectScssConventions(refScss) : BEST_PRACTICE_TYPO_CONVENTIONS.scss;
	const ts = refTs ? detectTsConventions(refTs) : BEST_PRACTICE_TYPO_CONVENTIONS.ts;
	return { scss, ts };
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

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToTypography(
	typographyJson: Record<string, unknown>,
	platforms: Platform[],
	conventions?: DetectedTypographyConventions,
	_referenceTypographySwift?: string,
	_referenceTypographyKotlin?: string
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

	const entries = parseEntries(raw as Record<string, unknown>);
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
		if (ios.length > 0) results.push(generateSwift(ios));
	}

	if (platforms.includes('android')) {
		const android = entries.filter((e) => e.targetPlatform === 'android');
		if (android.length > 0) results.push(generateKotlin(android));
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
		for (const entry of entries) {
			const sizeKey = kebabToScssSize(entry.fullKey);
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

function generateSwift(entries: ParsedEntry[]): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.swift');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('import SwiftUI');
	lines.push('');

	// ── TypographyStyle struct ────────────────────────────────────────────────
	// Bundles font + tracking + lineSpacing into one value — 2025 best practice.
	// Usage: Text("Hello").typography(.bodyR)
	lines.push('// MARK: - Typography Style');
	lines.push('/// Bundles a SwiftUI Font with its tracking and line-spacing values.');
	lines.push('/// Apply with: Text("…").typography(.bodyR)');
	lines.push('public struct TypographyStyle {');
	lines.push('  public let font: Font');
	lines.push('  /// Letter-spacing in points (Figma "letterSpacing" value).');
	lines.push('  public let tracking: CGFloat');
	lines.push('  /// Extra space added between lines: lineHeight − fontSize.');
	lines.push('  public let lineSpacing: CGFloat');
	lines.push('');
	lines.push('  public init(font: Font, tracking: CGFloat = 0, lineSpacing: CGFloat = 0) {');
	lines.push('    self.font = font');
	lines.push('    self.tracking = tracking');
	lines.push('    self.lineSpacing = lineSpacing');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	// ── ViewModifier ─────────────────────────────────────────────────────────
	lines.push('// MARK: - Typography Modifier');
	lines.push('private struct TypographyModifier: ViewModifier {');
	lines.push('  let style: TypographyStyle');
	lines.push('');
	lines.push('  func body(content: Content) -> some View {');
	lines.push('    content');
	lines.push('      .font(style.font)');
	lines.push('      .tracking(style.tracking)');
	lines.push('      .lineSpacing(style.lineSpacing)');
	lines.push('  }');
	lines.push('}');
	lines.push('');
	lines.push('public extension View {');
	lines.push('  /// Apply a Figma text style. Example: Text("Hello").typography(.bodyR)');
	lines.push('  func typography(_ style: TypographyStyle) -> some View {');
	lines.push('    modifier(TypographyModifier(style: style))');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	// ── Token definitions ─────────────────────────────────────────────────────
	// Note: SF Pro is the iOS system font — use Font.system() (not Font.custom()).
	// For custom fonts (e.g. Inter Variable), bundle them in your app and register
	// them in Info.plist. Font.custom("Inter Variable", …) will then work correctly.
	// relativeTo: enables Dynamic Type scaling for accessibility.
	lines.push('// MARK: - Typography Tokens');
	lines.push('// Note: SF Pro is the iOS system font — Font.system() is correct and preferred.');
	lines.push(
		'// relativeTo: maps to a Dynamic Type text style so fonts scale with accessibility settings.'
	);
	lines.push(
		'// lineSpacing = Figma lineHeight − fontSize (approximation for SwiftUI lineSpacing).'
	);
	lines.push('public extension TypographyStyle {');

	const grouped = groupEntries(entries);
	for (const [groupLabel, groupEntries] of grouped) {
		lines.push(`  // ${groupLabel}`);
		for (const entry of groupEntries) {
			const propName = kebabToCamel(entry.shortKey);
			const { value: v } = entry;
			const isSfPro = v.fontFamily.toLowerCase().startsWith('sf pro');
			const textStyle = swiftTextStyle(v.fontSize);
			const fontExpr = isSfPro
				? `Font.system(size: ${v.fontSize}, weight: ${swiftWeight(v.fontWeight)}, design: .default)`
				: `Font.custom("${v.fontFamily}", size: ${v.fontSize}, relativeTo: ${textStyle}).weight(${swiftWeight(v.fontWeight)})`;
			const lineSpacing = Math.max(0, v.lineHeight - v.fontSize);
			const hasTracking = v.letterSpacing !== 0;
			if (hasTracking) {
				lines.push(
					`  static let ${propName} = TypographyStyle(font: ${fontExpr}, tracking: ${v.letterSpacing}, lineSpacing: ${lineSpacing})`
				);
			} else {
				lines.push(
					`  static let ${propName} = TypographyStyle(font: ${fontExpr}, lineSpacing: ${lineSpacing})`
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

function generateKotlin(entries: ParsedEntry[]): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.kt');
	lines.push('// Auto-generated from Figma Text Styles — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('package com.example.design // TODO: update to your package name');
	lines.push('');
	lines.push('import androidx.compose.material3.Typography');
	lines.push('import androidx.compose.ui.text.TextStyle');
	lines.push('import androidx.compose.ui.text.font.FontFamily');
	lines.push('import androidx.compose.ui.text.font.FontWeight');
	lines.push('import androidx.compose.ui.unit.sp');
	lines.push('');
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
	lines.push('object TypographyTokens {');

	const grouped = groupEntries(entries);
	for (const [groupLabel, groupEntries] of grouped) {
		lines.push(`    // ${groupLabel}`);
		for (const entry of groupEntries) {
			const propName = kebabToCamel(entry.shortKey);
			const { value: v } = entry;
			const lsFormatted = v.letterSpacing === 0 ? '0.sp' : `(${v.letterSpacing}).sp`;
			lines.push(`    val ${propName} = TextStyle(`);
			lines.push(`        fontFamily = FontFamily.Default, // TODO: replace with bundled font`);
			lines.push(`        fontSize = ${v.fontSize}.sp,`);
			lines.push(`        fontWeight = ${kotlinWeight(v.fontWeight)},`);
			lines.push(`        lineHeight = ${v.lineHeight}.sp,`);
			lines.push(`        letterSpacing = ${lsFormatted},`);
			lines.push('    )');
		}
		lines.push('');
	}

	lines.push('}');
	lines.push('');

	// ── Material3 Typography builder ────────────────────────────────────────────
	// Wire your token objects into Material3's Typography so you can pass them to
	// MaterialTheme. M3 roles: displayLarge/Medium/Small, headlineLarge/Medium/Small,
	// titleLarge/Medium/Small, bodyLarge/Medium/Small, labelLarge/Medium/Small.
	// See https://m3.material.io/styles/typography/type-scale-tokens
	lines.push(
		'// Material3 Typography builder — pass to MaterialTheme(typography = appTypography())'
	);
	lines.push('// TODO: map your token objects to M3 text style roles below.');
	lines.push('fun appTypography() = Typography(');
	lines.push('    // displayLarge   = TypographyTokens.xlargeTitleR,');
	lines.push('    // headlineLarge  = TypographyTokens.largeTitleR,');
	lines.push('    // titleLarge     = TypographyTokens.title1R,');
	lines.push('    // bodyLarge      = TypographyTokens.bodyR,');
	lines.push('    // bodyMedium     = TypographyTokens.subheadR,');
	lines.push('    // bodySmall      = TypographyTokens.footnoteR,');
	lines.push('    // labelSmall     = TypographyTokens.captionR,');
	lines.push(')');
	lines.push('');

	return {
		filename: 'Typography.kt',
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
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
