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
	const integers = valuesExport['Integer'];
	if (!integers || typeof integers !== 'object') return [];

	const entries: SpacingEntry[] = [];

	for (const [key, token] of Object.entries(integers as Record<string, unknown>)) {
		if (key.startsWith('$')) continue;
		if (!token || typeof token !== 'object') continue;

		const t = token as Record<string, unknown>;
		if (t.$type !== 'number' || typeof t.$value !== 'number') continue;

		const raw = t.$value as number;
		const scssVar = integerKeyToScssVar(key, raw);
		const tsName = scssVarToTsName(scssVar, conventions.tsNamingCase);
		const value = raw === 999 ? '999px' : `${raw}px`;

		entries.push({ scssVar, tsName, value, sortKey: raw });
	}

	return entries.sort((a, b) => a.sortKey - b.sortKey);
}

function integerKeyToScssVar(key: string, value: number): string {
	if (key === '999') return '$spacing-max';
	if (value < 0) return `$spacing-neg-${Math.abs(value)}`;
	return `$spacing-${value}`;
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
