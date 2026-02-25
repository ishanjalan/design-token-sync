/**
 * Convention Detector
 *
 * Analyses uploaded reference files (SCSS, TypeScript) and infers naming
 * conventions, separators, import styles and structural patterns so generated
 * output matches the team's existing codebase exactly.
 */

import type { DetectedConventions, NamingCase, ScssColorStructure } from '$lib/types.js';
import { BEST_PRACTICE_WEB_CONVENTIONS } from '$lib/types.js';
import { capitalize } from './shared.js';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect conventions from reference file contents.
 *
 * When `bestPractices` is true, returns best-practice defaults regardless of
 * reference files. When false, analyses the reference files to match the team's
 * existing conventions. If no reference files are provided, best-practice
 * defaults are returned either way (nothing to match).
 */
export function detectConventions(
	primitivesScss: string | undefined,
	colorsScss: string | undefined,
	primitivesTs: string | undefined,
	colorsTs: string | undefined,
	bestPractices: boolean = true
): DetectedConventions {
	const hasRefs = !!(primitivesScss || colorsScss || primitivesTs || colorsTs);
	if (bestPractices || !hasRefs) return { ...BEST_PRACTICE_WEB_CONVENTIONS };

	const allScss = [primitivesScss, colorsScss].filter(Boolean).join('\n');
	const allTs = [primitivesTs, colorsTs].filter(Boolean).join('\n');

	const sepConf = detectScssSeparator(allScss || undefined);
	const caseConf = detectTsNamingCase(allTs || undefined);
	const hexConf = detectTsHexCasing(allTs || undefined);

	// Confidence is the minimum across dimensions that have actual data.
	const confidences: number[] = [];
	if (allScss) confidences.push(sepConf.confidence);
	if (allTs) confidences.push(caseConf.confidence, hexConf.confidence);
	const confidence = confidences.length > 0 ? Math.min(...confidences) : 1.0;

	return {
		scssPrefix: '$',
		scssSeparator: sepConf.value,
		tsPrefix: 'export const ',
		tsNamingCase: caseConf.value,
		importStyle: detectImportStyle(allScss || undefined),
		importSuffix: detectImportSuffix(allScss || undefined),
		scssColorStructure: detectScssColorStructure(colorsScss),
		hasTypeAnnotations: detectTypeAnnotations(allTs || undefined),
		tsHexCasing: hexConf.value,
		tsUsesAsConst: detectTsAsConst(allTs || undefined),
		confidence
	};
}

/**
 * Convert a SCSS variable name (e.g. "$grey-750") to a TypeScript constant name
 * using the detected naming case.
 *
 * "$grey-750"            → "GREY_750"           (screaming_snake)
 * "$text-primary"        → "TEXT_PRIMARY"        (screaming_snake)
 * "$grey-alpha-750-8"    → "GREY_ALPHA_750_8"    (screaming_snake)
 */
export function scssVarToTsName(scssVar: string, namingCase: NamingCase): string {
	const bare = scssVar.startsWith('$') ? scssVar.slice(1) : scssVar;
	const parts = bare.split('-').filter(Boolean);

	switch (namingCase) {
		case 'screaming_snake':
			return parts.map((p) => p.toUpperCase()).join('_');
		case 'snake':
			return parts.join('_');
		case 'camel':
			return parts.map((p, i) => (i === 0 ? p : capitalize(p))).join('');
		case 'pascal':
			return parts.map(capitalize).join('');
		case 'kebab':
		default:
			return parts.join('-');
	}
}

/**
 * Convert a CSS custom-property name (e.g. "--text-primary") to TypeScript.
 */
export function cssVarToTsName(cssVar: string, namingCase: NamingCase): string {
	const bare = cssVar.replace(/^--/, '');
	return scssVarToTsName('$' + bare, namingCase);
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

type WithConf<T> = { value: T; confidence: number };

function detectScssSeparator(scss: string | undefined): WithConf<'hyphen' | 'underscore' | 'none'> {
	if (!scss) return { value: 'hyphen', confidence: 1.0 };
	const hyphens = (scss.match(/\$\w+-\w+/g) ?? []).length;
	const underscores = (scss.match(/\$\w+_\w+/g) ?? []).length;
	const total = hyphens + underscores;
	if (total === 0) return { value: 'hyphen', confidence: 1.0 };
	const value = underscores > hyphens ? 'underscore' : 'hyphen';
	return { value, confidence: Math.max(hyphens, underscores) / total };
}

function detectTsNamingCase(ts: string | undefined): WithConf<NamingCase> {
	if (!ts) return { value: 'screaming_snake', confidence: 1.0 };

	// Count export const NAME patterns
	const screamingSnake = (ts.match(/export\s+const\s+[A-Z][A-Z0-9_]+\s*=/g) ?? []).length;
	const camelCase = (ts.match(/export\s+const\s+[a-z][a-zA-Z0-9]+\s*=/g) ?? []).length;
	const pascalCase = (ts.match(/export\s+const\s+[A-Z][a-zA-Z0-9]+[a-z][a-zA-Z0-9]*\s*=/g) ?? [])
		.length;
	const total = screamingSnake + camelCase + pascalCase;
	if (total === 0) return { value: 'screaming_snake', confidence: 1.0 };

	let value: NamingCase;
	if (screamingSnake >= camelCase && screamingSnake >= pascalCase) value = 'screaming_snake';
	else if (pascalCase > camelCase) value = 'pascal';
	/* v8 ignore else -- @preserve */
	else value = 'camel';
	// unreachable: camelCase===0 + screamingSnake<camelCase is a logical contradiction
	/* v8 ignore next -- @preserve */
	return { value, confidence: Math.max(screamingSnake, camelCase, pascalCase) / total };
}

function detectImportStyle(scss: string | undefined): 'use' | 'import' {
	if (!scss) return 'import';
	if (scss.includes('@use ')) return 'use';
	return 'import';
}

function detectTypeAnnotations(ts: string | undefined): boolean {
	if (!ts) return false;
	return /export\s+const\s+\w+\s*:\s*string\s*=/.test(ts);
}

function detectImportSuffix(scss: string | undefined): '.scss' | '' {
	if (!scss) return '';
	if (/(?:@import|@use)\s+['"][^'"]*\.scss['"]/.test(scss)) return '.scss';
	return '';
}

function detectScssColorStructure(colorsScss: string | undefined): ScssColorStructure {
	if (!colorsScss) return 'modern';
	const hasRoot = colorsScss.includes(':root');
	const hasLightDark = colorsScss.includes('light-dark(');
	const hasMediaQuery = /prefers-color-scheme/.test(colorsScss);

	if (hasLightDark && !hasRoot) return 'inline';
	if (hasRoot && hasMediaQuery) return 'media-query';
	if (hasRoot) return 'modern';
	return 'inline';
}

function detectTsHexCasing(ts: string | undefined): WithConf<'upper' | 'lower'> {
	if (!ts) return { value: 'lower', confidence: 1.0 };
	const upperCount = (ts.match(/'#[0-9A-F]{6}'/g) ?? []).length;
	const lowerCount = (ts.match(/'#[0-9a-f]{6}'/g) ?? []).length;
	const total = upperCount + lowerCount;
	if (total === 0) return { value: 'lower', confidence: 1.0 };
	const value = upperCount > lowerCount ? 'upper' : 'lower';
	return { value, confidence: Math.max(upperCount, lowerCount) / total };
}

function detectTsAsConst(ts: string | undefined): boolean {
	if (!ts) return false;
	return /\bas\s+const\b/.test(ts);
}

