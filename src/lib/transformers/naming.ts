/**
 * Convention Detector
 *
 * Analyses uploaded reference files (SCSS, TypeScript) and infers naming
 * conventions, separators, import styles and structural patterns so generated
 * output matches the team's existing codebase exactly.
 */

import type { DetectedConventions, NamingCase } from '$lib/types.js';
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

	return {
		scssPrefix: '$',
		scssSeparator: detectScssSeparator(allScss || undefined),
		tsPrefix: 'export const ',
		tsNamingCase: detectTsNamingCase(allTs || undefined),
		importStyle: detectImportStyle(allScss || undefined),
		hasTypeAnnotations: detectTypeAnnotations(allTs || undefined)
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

function detectScssSeparator(scss: string | undefined): 'hyphen' | 'underscore' | 'none' {
	if (!scss) return 'hyphen';
	const hyphens = (scss.match(/\$\w+-\w+/g) ?? []).length;
	const underscores = (scss.match(/\$\w+_\w+/g) ?? []).length;
	return underscores > hyphens ? 'underscore' : 'hyphen';
}

function detectTsNamingCase(ts: string | undefined): NamingCase {
	if (!ts) return 'screaming_snake';

	// Count export const NAME patterns
	const screamingSnake = (ts.match(/export\s+const\s+[A-Z][A-Z0-9_]+\s*=/g) ?? []).length;
	const camelCase = (ts.match(/export\s+const\s+[a-z][a-zA-Z0-9]+\s*=/g) ?? []).length;
	const pascalCase = (ts.match(/export\s+const\s+[A-Z][a-zA-Z0-9]+[a-z][a-zA-Z0-9]*\s*=/g) ?? [])
		.length;

	if (screamingSnake >= camelCase && screamingSnake >= pascalCase) return 'screaming_snake';
	if (pascalCase > camelCase) return 'pascal';
	/* v8 ignore else -- @preserve */
	if (camelCase > 0) return 'camel';
	// unreachable: camelCase===0 + screamingSnake<camelCase is a logical contradiction
	/* v8 ignore next -- @preserve */
	return 'screaming_snake';
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

