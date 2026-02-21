/**
 * Spacing Transformer
 *
 * Reads the `Integer` section of Value.tokens.json and generates:
 *   Spacing.scss  → SCSS variables  ($spacing-4: 4px;)
 *   Spacing.ts    → TS constants    (export const SPACING_4 = '4px';)
 *
 * Negative values use a "neg" segment:
 *   Integer/-4 → $spacing-neg-4 / SPACING_NEG_4
 *   Integer/999 is treated as a max/clip value and named $spacing-max
 */

import type { TransformResult } from '$lib/types.js';
import type { DetectedConventions } from '$lib/types.js';
import { scssVarToTsName } from '$lib/transformers/naming.js';
import { collectSpacingEntries } from './shared.js';

interface SpacingEntry {
	scssVar: string;
	tsName: string;
	value: string;
	sortKey: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToSpacing(
	valuesExport: Record<string, unknown>,
	conventions: DetectedConventions
): TransformResult[] {
	const entries = buildEntries(valuesExport, conventions);
	if (entries.length === 0) return [];

	return [generateSpacingScss(entries), generateSpacingTs(entries)];
}

// ─── Build Entries ────────────────────────────────────────────────────────────

function buildEntries(
	valuesExport: Record<string, unknown>,
	conventions: DetectedConventions
): SpacingEntry[] {
	return collectSpacingEntries(valuesExport).map((raw) => {
		const scssVar = raw.cssVar.replace('--', '$');
		return {
			scssVar,
			tsName: scssVarToTsName(scssVar, conventions.tsNamingCase),
			value: raw.pxValue,
			sortKey: raw.rawValue
		};
	});
}

// ─── SCSS Output ──────────────────────────────────────────────────────────────

function generateSpacingScss(entries: SpacingEntry[]): TransformResult {
	const lines: string[] = [];
	lines.push('// Spacing.scss');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('// Spacing scale — SCSS variables');
	for (const { scssVar, value } of entries) {
		lines.push(`${scssVar}: ${value};`);
	}
	lines.push('');
	lines.push('// Spacing scale — CSS custom properties (for JS access and runtime use)');
	lines.push(':root {');
	for (const { scssVar, value } of entries) {
		const cssVar = scssVar.replace('$', '--');
		lines.push(`  ${cssVar}: #{${scssVar}}; // ${value}`);
	}
	lines.push('}');
	lines.push('');

	return {
		filename: 'Spacing.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}

// ─── TypeScript Output ────────────────────────────────────────────────────────

function generateSpacingTs(entries: SpacingEntry[]): TransformResult {
	const lines: string[] = [];
	lines.push('// Spacing.ts');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('// Spacing scale (px)');
	for (const { tsName, value } of entries) {
		lines.push(`export const ${tsName} = '${value}' as const;`);
	}
	lines.push('');

	return {
		filename: 'Spacing.ts',
		content: lines.join('\n') + '\n',
		format: 'typescript',
		platform: 'web'
	};
}
