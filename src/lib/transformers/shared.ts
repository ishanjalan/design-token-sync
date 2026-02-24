/**
 * Shared utilities for all transformers.
 *
 * Centralizes tree walkers, type guards, naming helpers, and composite token
 * utilities used by color transformers (scss, ts-web, css, swift, kotlin) and
 * composite transformers (shadow, border, opacity).
 */

import type { FigmaColorToken } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';

// ─── Figma-to-Platform Name Reconciliation ──────────────────────────────────

/**
 * Maps old platform names to their Figma (source of truth) counterparts.
 * When a reference file uses a name from the left column, the generated output
 * will use the Figma name from the right column with a migration comment.
 */
export const FIGMA_NAME_MAP: Record<string, string> = {
	Fuchsia: 'Pink',
	fuchsia: 'pink',
	Purple: 'Violet',
	purple: 'violet'
};

/** Reverse map: Figma name -> old platform name (for detecting renames in reference files). */
export const PLATFORM_NAME_MAP: Record<string, string> = {
	Pink: 'Fuchsia',
	pink: 'fuchsia',
	Violet: 'Purple',
	violet: 'purple'
};

/** Generate migration comment lines for a renamed family. */
export function renameComment(
	oldName: string,
	figmaName: string,
	commentStyle: '//' | '/*' | '#'
): string[] {
	const line1 = `RENAMED: "${oldName}" in your reference file has been updated to "${figmaName}" in Figma design tokens.`;
	const line2 = `Please update your codebase to use "${figmaName}" to stay in sync with the design system.`;
	if (commentStyle === '/*') return [`/* ${line1} */`, `/* ${line2} */`];
	return [`${commentStyle} ${line1}`, `${commentStyle} ${line2}`];
}

/**
 * Check if a family name in Figma tokens has a known rename from a platform reference.
 * Returns the old platform name if a rename exists, null otherwise.
 */
export function detectRename(figmaFamilyName: string): string | null {
	return PLATFORM_NAME_MAP[figmaFamilyName] ?? null;
}

/**
 * Scan reference content for old platform names and return a map of
 * figmaFamily (lowercase) -> oldPlatformName for families that were renamed.
 */
export function detectRenamesInReference(referenceContent: string | undefined): Map<string, string> {
	const renames = new Map<string, string>();
	if (!referenceContent) return renames;
	for (const [oldName, figmaName] of Object.entries(FIGMA_NAME_MAP)) {
		const re = new RegExp(oldName, 'i');
		if (re.test(referenceContent)) {
			renames.set(figmaName.toLowerCase(), oldName);
		}
	}
	return renames;
}

// ─── NEW Token Marker ─────────────────────────────────────────────────────────

/** Generate "NEW" comment lines for tokens not present in the reference file. */
export function newTokenComment(commentStyle: '//' | '/*' | '#'): string[] {
	const msg = 'NEW: This token was added in Figma design tokens but does not exist in your reference file.';
	if (commentStyle === '/*') return [`/* ${msg} */`];
	return [`${commentStyle} ${msg}`];
}

/**
 * Create a function that checks whether a name is absent from reference content.
 * Returns `true` if the name is NOT found in the reference (i.e. it's new).
 * When no reference is provided, always returns false (nothing is "new" in best-practices mode).
 *
 * Normalizes both the reference and search names by stripping hyphens and underscores,
 * so it works across camelCase, snake_case, kebab-case, and SCREAMING_SNAKE naming.
 */
export function createNewDetector(referenceContent?: string): (name: string) => boolean {
	if (!referenceContent) return () => false;
	const refNormalized = referenceContent.toLowerCase().replace(/[-_]/g, '');
	return (name: string) => {
		const normalized = name.toLowerCase().replace(/[-_]/g, '');
		return !refNormalized.includes(normalized);
	};
}

// ─── Reference File Bug Detection ─────────────────────────────────────────────

/** Format a bug-warning comment block for the top of generated output. */
export function bugWarningBlock(warnings: string[], commentStyle: '//' | '/*'): string[] {
	if (warnings.length === 0) return [];
	const lines: string[] = [];
	if (commentStyle === '/*') {
		lines.push('/* ⚠️  REFERENCE FILE ISSUES DETECTED');
		lines.push(' *');
		for (const w of warnings) {
			lines.push(` *  • ${w}`);
		}
		lines.push(' *');
		lines.push(' *  Generated output uses correct values from Figma design tokens.');
		lines.push(' *  Please review and fix the issues in your reference file.');
		lines.push(' */');
	} else {
		lines.push('// ⚠️  REFERENCE FILE ISSUES DETECTED');
		lines.push('//');
		for (const w of warnings) {
			lines.push(`//  • ${w}`);
		}
		lines.push('//');
		lines.push('//  Generated output uses correct values from Figma design tokens.');
		lines.push('//  Please review and fix the issues in your reference file.');
	}
	lines.push('');
	return lines;
}

/** Detect known bugs in Swift reference files. */
export function detectSwiftBugs(reference: string): string[] {
	const warnings: string[] = [];
	const hexWithoutHash = reference.match(/=\s*"([0-9A-Fa-f]{6})"/g);
	if (hexWithoutHash && hexWithoutHash.length > 0) {
		warnings.push(`${hexWithoutHash.length} hex value(s) missing "#" prefix (e.g., greenElectric = "008001"). Generated output always includes "#".`);
	}
	return warnings;
}

/** Detect known bugs in Kotlin color reference files. */
export function detectKotlinColorBugs(reference: string): string[] {
	const warnings: string[] = [];
	const staticEnumMappings = [...reference.matchAll(/ICONSTATIC\w+\s*->\s*(\w+)/g)];
	if (staticEnumMappings.length > 1) {
		const targets = new Set(staticEnumMappings.map((m) => m[1]));
		if (targets.size === 1) {
			const badTarget = [...targets][0];
			warnings.push(`Static icon/text enum cases all map to "${badTarget}" — likely a copy-paste bug. Generated output uses correct Figma mappings.`);
		}
	}
	return warnings;
}

/** Detect known bugs in Kotlin typography reference files. */
export function detectKotlinTypoBugs(reference: string): string[] {
	const warnings: string[] = [];
	if (/footnote.*this\.subhead/i.test(reference)) {
		warnings.push('footnote copy() defaults reference "this.subhead_*" instead of "this.footnote_*" — copy-paste bug.');
	}
	if (/RLocalTypography|LocalTypography/i.test(reference) && !/slprice/i.test(reference)) {
		warnings.push('RLocalTypography is missing "slprice" entries. Generated output includes all tokens.');
	}
	return warnings;
}

// ─── Tree Walkers (color-specific) ───────────────────────────────────────────

/** Walk all color tokens in a tree (flat, no path). */
export function walkColorTokens(obj: unknown, fn: (token: FigmaColorToken) => void): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(o as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkColorTokens(val, fn);
	}
}

/** Walk color tokens with path. */
export function walkColorTokensWithPath(
	obj: unknown,
	fn: (path: string[], token: FigmaColorToken) => void,
	path: string[] = []
): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		fn(path, o as FigmaColorToken);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkColorTokensWithPath(val, fn, [...path, key]);
	}
}

/** Get color token at specific path. */
export function getColorTokenAtPath(obj: unknown, path: string[]): FigmaColorToken | null {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = (cur as Record<string, unknown>)[key];
	}
	if (!cur || typeof cur !== 'object') return null;
	const o = cur as Record<string, unknown>;
	return o.$type === 'color' ? (o as FigmaColorToken) : null;
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

export function isFigmaColorToken(obj: unknown): obj is FigmaColorToken {
	if (!obj || typeof obj !== 'object') return false;
	const o = obj as Record<string, unknown>;
	return o.$type === 'color' && o.$value !== undefined && typeof o.$value === 'object';
}

// ─── Naming Helpers (color transformers) ───────────────────────────────────────

/** Convert Figma name segments to kebab (with separator support). */
export function figmaSegmentsToKebab(segments: string[]): string {
	return segments
		.map((p) =>
			p
				.replace(/_/g, '-')
				.replace(/([a-z])([A-Z])/g, '$1-$2')
				.toLowerCase()
		)
		.join('-');
}

/** Path to token name (kebab-case, drops "Standard"). */
export function pathToTokenName(path: string[], sep: string = '-'): string {
	return path
		.filter((p) => p.toLowerCase() !== 'standard')
		.map((p) => p.toLowerCase().replace(/\s+/g, sep))
		.join(sep);
}

/** Extract sort key from a var name. */
export function extractSortKey(name: string): number {
	const numbers = name.match(/\d+/g);
	if (!numbers) return 0;
	return numbers.reduce(
		(acc, n, i) => acc + parseInt(n) * Math.pow(1000, Math.max(0, numbers.length - 1 - i)),
		0
	);
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert Figma color token to CSS hex/rgba value. */
export function resolveColorValue(token: FigmaColorToken): string | null {
	const v = token.$value;
	if (!v || typeof v !== 'object') return null;
	if (!Array.isArray(v.components) || v.components.length < 3) return null;
	if (typeof v.alpha !== 'number') return null;
	const [r, g, b] = v.components;
	const alpha = parseFloat(v.alpha.toFixed(4));
	if (alpha < 1) return figmaToHex(r, g, b, alpha);
	if (!v.hex || typeof v.hex !== 'string') return null;
	return v.hex.toLowerCase();
}

/** Category ordering constant. */
export const CATEGORY_ORDER = ['fill', 'text', 'icon', 'background', 'stroke'] as const;

/** Order categories with the standard order first, then sorted alphabetical rest. */
export function orderCategories(categories: Iterable<string>): string[] {
	const catSet = new Set(categories);
	return [
		...CATEGORY_ORDER.filter((c) => catSet.has(c)),
		...[...catSet].filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c)).sort()
	];
}

// ─── Composite Token Helpers (shadow, border, opacity) ─────────────────────────

/** Path to kebab-case name. */
export function pathToKebab(path: string[]): string {
	return path
		.map((p) =>
			p
				.replace(/_/g, '-')
				.replace(/([a-z])([A-Z])/g, '$1-$2')
				.toLowerCase()
		)
		.join('-');
}

/** Path to camelCase name. */
export function pathToCamel(path: string[]): string {
	const kebab = pathToKebab(path);
	return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Path to PascalCase name. */
export function pathToPascal(path: string[]): string {
	const camel = pathToCamel(path);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** Extract first numeric value from a string. */
export function extractNumericKey(s: string): number {
	const m = s.match(/\d+/);
	return m ? parseInt(m[0]) : 0;
}

// ─── Spacing Helpers ──────────────────────────────────────────────────────────

export interface RawSpacingEntry {
	key: string;
	rawValue: number;
	cssVar: string;
	pxValue: string;
}

/**
 * Parse the Integer section of a Figma values export into spacing entries.
 * Shared between spacing.ts (SCSS/TS) and css.ts (pure CSS).
 */
export function collectSpacingEntries(valuesExport: Record<string, unknown>): RawSpacingEntry[] {
	const integers = valuesExport['Integer'];
	if (!integers || typeof integers !== 'object') return [];

	const entries: RawSpacingEntry[] = [];

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
		const pxValue = `${raw}px`;

		entries.push({ key, rawValue: raw, cssVar, pxValue });
	}

	return entries.sort((a, b) => a.rawValue - b.rawValue);
}

// ─── Shared File Header ──────────────────────────────────────────────────────

export function fileHeaderLines(
	commentPrefix: string,
	bestPractices: boolean,
	referenceFilenames?: string[]
): string[] {
	const mode = bestPractices ? 'best-practices' : 'match-existing';
	const lines = [
		`${commentPrefix} Auto-generated from Figma Variables — DO NOT EDIT`,
		`${commentPrefix} Generated: ${new Date().toISOString()}`,
		`${commentPrefix} Mode: ${mode}`
	];
	if (!bestPractices && referenceFilenames?.length) {
		lines.push(`${commentPrefix} Reference: ${referenceFilenames.join(', ')}`);
	}
	return lines;
}
