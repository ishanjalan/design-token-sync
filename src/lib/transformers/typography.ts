/**
 * Typography Transformer — Orchestrator
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
 *
 * Platform-specific generators live in:
 *   typography-scss.ts, typography-ts.ts, typography-swift.ts, typography-kotlin.ts
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { capitalize } from './shared.js';
export { fileHeaderLines } from './shared.js';

import { detectScssConventions, generateScss } from './typography-scss.js';
import { detectTsConventions, generateTs } from './typography-ts.js';
import { detectSwiftConventions, generateSwift } from './typography-swift.js';
import { detectKotlinConventions, generateKotlin, type KotlinTypographyScope } from './typography-kotlin.js';
export type { KotlinTypographyScope } from './typography-kotlin.js';

// ─── Exported types ──────────────────────────────────────────────────────────

export interface TypographyValue {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	lineHeight: number;
	letterSpacing: number;
}

export interface ParsedEntry {
	fullKey: string;
	shortKey: string;
	category: string;
	targetPlatform: 'android' | 'ios' | 'shared';
	value: TypographyValue;
	figmaName: string;
}

export interface DetectedTypographyConventions {
	scss: {
		varPrefix: string;
		hasCssCustomProperties: boolean;
		hasMixins: boolean;
		mixinPrefix: string;
		includesFontFamily: boolean;
		includesFontWeight: boolean;
		sizeUnit: 'rem' | 'px';
		heightUnit: 'rem' | 'unitless';
		spacingUnit: 'px' | 'em';
		twoTier: boolean;
	};
	ts: {
		namingCase: 'SCREAMING_SNAKE' | 'camelCase';
		constPrefix: string;
		includesFontFamily: boolean;
		hasInterface: boolean;
		interfaceName: string | null;
		valueFormat: 'string' | 'number';
		twoTier: boolean;
		exportWeights: boolean;
	};
	swift: {
		architecture: 'enum' | 'struct';
		typeName: string;
		dataStructName: string | null;
		dataStructProps: string[];
		uiFramework: 'uikit' | 'swiftui' | 'both';
		includesTracking: boolean;
		usesDynamicTypeScaling: boolean;
		dynamicTypeMethodName: string | null;
		nameMap: Record<string, string>;
	};
	kotlin: {
		architecture: 'object' | 'companion' | 'top-level' | 'class';
		containerName: string;
		className: string | null;
		packageName: string;
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

// ─── Best-practice defaults ──────────────────────────────────────────────────

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

// ─── Font Weight Normalization ────────────────────────────────────────────────

const WEIGHT_NAME_MAP: Record<string, number> = {
	thin: 100, hairline: 100,
	extralight: 200, 'extra-light': 200, ultralight: 200,
	light: 300,
	regular: 400, normal: 400, book: 400,
	medium: 500,
	semibold: 600, 'semi-bold': 600, demibold: 600,
	bold: 700,
	extrabold: 800, 'extra-bold': 800, ultrabold: 800,
	black: 900, heavy: 900
};

/**
 * Normalize a font weight value that may be numeric or a string name.
 * Returns [weight, usedFallback] — usedFallback=true if a name lookup was required.
 */
export function normalizeFontWeight(raw: unknown): [number, boolean] {
	if (typeof raw === 'number' && raw > 0) return [raw, false];
	if (typeof raw === 'string') {
		const parsed = parseFloat(raw);
		if (!isNaN(parsed) && parsed > 0) return [parsed, false];
		const lookup = WEIGHT_NAME_MAP[raw.toLowerCase().trim()];
		if (lookup) return [lookup, true];
	}
	return [400, true];
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

export interface TransformToTypographyResult {
	files: TransformResult[];
	weightFallbackNames: string[];
}

export function transformToTypography(
	typographyJson: Record<string, unknown>,
	platforms: Platform[],
	conventions?: DetectedTypographyConventions,
	kotlinTypoScope?: KotlinTypographyScope
): TransformResult[];
export function transformToTypography(
	typographyJson: Record<string, unknown>,
	platforms: Platform[],
	conventions: DetectedTypographyConventions | undefined,
	kotlinTypoScope: KotlinTypographyScope | undefined,
	collectWarnings: true
): TransformToTypographyResult;
export function transformToTypography(
	typographyJson: Record<string, unknown>,
	platforms: Platform[],
	conventions?: DetectedTypographyConventions,
	kotlinTypoScope?: KotlinTypographyScope,
	collectWarnings?: boolean
): TransformResult[] | TransformToTypographyResult {
	const conv = conventions ?? BEST_PRACTICE_TYPO_CONVENTIONS;

	let raw = typographyJson['typography'];
	if (!raw || typeof raw !== 'object') {
		const hasTypographyEntries = Object.values(typographyJson).some(
			(v) => v && typeof v === 'object' && (v as Record<string, unknown>).$type === 'typography'
		);
		if (hasTypographyEntries) {
			raw = typographyJson;
		} else {
			if (collectWarnings) return { files: [], weightFallbackNames: [] };
			return [];
		}
	}

	const SKIP_VARIANT_RE = /\((underline|strikethrough|headline)\)/i;
	const { entries, weightFallbackNames } = parseEntries(raw as Record<string, unknown>, true);
	const filteredEntries = entries.filter((e) => !SKIP_VARIANT_RE.test(e.figmaName));
	/* v8 ignore next -- @preserve */
	if (filteredEntries.length === 0) {
		if (collectWarnings) return { files: [], weightFallbackNames };
		return [];
	}
	const e = filteredEntries;
	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		const webEntries = e
			.filter((entry) => entry.targetPlatform !== 'ios')
			.map((entry) => (entry.targetPlatform === 'android' ? { ...entry, fullKey: entry.shortKey } : entry));
		if (webEntries.length > 0) {
			results.push(generateScss(webEntries, conv.scss));
			results.push(generateTs(webEntries, conv.ts));
		}
	}

	if (platforms.includes('ios')) {
		const ios = e.filter((entry) => entry.targetPlatform === 'ios');
		if (ios.length > 0) results.push(generateSwift(ios, conv.swift));
	}

	if (platforms.includes('android')) {
		const android = e.filter((entry) => entry.targetPlatform === 'android');
		if (android.length > 0) results.push(...generateKotlin(android, conv.kotlin, kotlinTypoScope));
	}

	if (collectWarnings) return { files: results, weightFallbackNames };
	return results;
}

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

// ─── Shared helpers (exported for platform modules) ──────────────────────────

export interface ParseEntriesResult {
	entries: ParsedEntry[];
	weightFallbackNames: string[]; // token names that used string→number fallback
}

export function parseEntries(raw: Record<string, unknown>): ParsedEntry[];
export function parseEntries(raw: Record<string, unknown>, collectWarnings: true): ParseEntriesResult;
export function parseEntries(raw: Record<string, unknown>, collectWarnings?: boolean): ParsedEntry[] | ParseEntriesResult {
	const weightFallbackNames: string[] = [];
	const entries = Object.entries(raw)
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

			const [fontWeight, usedFallback] = normalizeFontWeight(val?.fontWeight);
			if (usedFallback && collectWarnings) weightFallbackNames.push(name);

			return {
				fullKey,
				shortKey,
				category: extractCategory(parts),
				targetPlatform,
				value: {
					fontFamily: val?.fontFamily ?? '',
					fontSize: val?.fontSize ?? 0,
					fontWeight,
					lineHeight: val?.lineHeight ?? 0,
					letterSpacing: roundFloat(val?.letterSpacing ?? 0, 3)
				},
				figmaName: name
			};
		});
	if (collectWarnings) return { entries, weightFallbackNames };
	return entries;
}

function styleNameToKey(name: string): string {
	const parts = name.split('/');
	const result: string[] = [];

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const modifiers: string[] = [];

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

export function roundFloat(n: number, dp: number): number {
	const factor = Math.pow(10, dp);
	return Math.round(n * factor) / factor;
}

export function pxToRem(px: number): string {
	const rem = px / 16;
	return `${parseFloat(rem.toFixed(4))}rem`;
}

export function unitlessLineHeight(lineHeight: number, fontSize: number): string {
	if (fontSize === 0) return '1';
	return parseFloat((lineHeight / fontSize).toFixed(4)).toString();
}

export function pxToEm(letterSpacing: number, fontSize: number): string {
	if (fontSize === 0 || letterSpacing === 0) return '0';
	return `${parseFloat((letterSpacing / fontSize).toFixed(4))}em`;
}

export function resolveNameFromMap(
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

export function groupEntries(entries: ParsedEntry[]): Map<string, ParsedEntry[]> {
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

export function kebabToCamel(s: string): string {
	return s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
