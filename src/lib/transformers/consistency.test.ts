/**
 * Cross-transformer consistency tests.
 *
 * Verifies that SCSS, CSS, and TS transformers produce consistent token counts
 * and aligned naming from the same input data.
 */

import { describe, it, expect } from 'vitest';
import { transformToSCSS } from './scss.js';
import { transformToCSS } from './css.js';
import { transformToTS } from './ts-web.js';
import { lightColors, darkColors } from './fixtures.js';
import { BEST_PRACTICE_WEB_CONVENTIONS } from '$lib/types.js';
import type { DetectedConventions } from '$lib/types.js';

const conventions: DetectedConventions = {
	scssPrefix: '$',
	scssSeparator: 'hyphen',
	tsPrefix: 'export const ',
	tsNamingCase: 'screaming_snake',
	importStyle: 'use',
	importSuffix: '',
	scssColorStructure: 'modern',
	hasTypeAnnotations: false,
	tsHexCasing: 'lower',
	tsUsesAsConst: true
};

function countPattern(content: string, pattern: RegExp): number {
	return (content.match(pattern) || []).length;
}

// ─── Token count parity ──────────────────────────────────────────────────────

describe('cross-transformer token count parity', () => {
	it('SCSS Colors and CSS colors produce same number of semantic tokens', () => {
		const scssResults = transformToSCSS(lightColors, darkColors);
		const cssResults = transformToCSS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);

		const scssColors = scssResults.find((r) => r.filename === 'Colors.scss')!;
		const cssColors = cssResults.find((r) => r.filename === 'colors.css')!;

		const scssCount = countPattern(scssColors.content, /@property --/g);
		const cssCount = countPattern(cssColors.content, /^\s+--[\w-]+:\s+(?:light-dark|var)/gm);

		expect(scssCount).toBe(cssCount);
	});

	it('SCSS Colors and TS Colors produce same number of semantic tokens', () => {
		const scssResults = transformToSCSS(lightColors, darkColors);
		const tsResults = transformToTS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);

		const scssColors = scssResults.find((r) => r.filename === 'Colors.scss')!;
		const tsColors = tsResults.find((r) => r.filename === 'Colors.ts')!;

		const scssCount = countPattern(scssColors.content, /@property --/g);
		const tsCount = countPattern(tsColors.content, /^export const /gm);

		expect(scssCount).toBe(tsCount);
	});

	it('SCSS Primitives and TS Primitives contain same token names', () => {
		const scssResults = transformToSCSS(lightColors, darkColors);
		const tsResults = transformToTS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);

		const scssPrims = scssResults.find((r) => r.filename === 'Primitives.scss')!;
		const tsPrims = tsResults.find((r) => r.filename === 'Primitives.ts')!;

		expect(scssPrims.content).toContain('$grey-750');
		expect(tsPrims.content).toContain('GREY_750');
		expect(scssPrims.content).toContain('$grey-0');
		expect(tsPrims.content).toContain('GREY_0');
		expect(scssPrims.content).toContain('$grey-50');
		expect(tsPrims.content).toContain('GREY_50');
	});
});

// ─── Name alignment ──────────────────────────────────────────────────────────

describe('cross-transformer name alignment', () => {
	it('SCSS and TS both contain expected token names from same input', () => {
		const scssResults = transformToSCSS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);
		const tsResults = transformToTS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);

		const scssColors = scssResults.find((r) => r.filename === 'Colors.scss')!;
		const tsColors = tsResults.find((r) => r.filename === 'Colors.ts')!;

		expect(scssColors.content).toContain('$text-primary');
		expect(tsColors.content).toContain('TEXT_PRIMARY');
		expect(scssColors.content).toContain('$fill-static-white');
		expect(tsColors.content).toContain('FILL_STATIC_WHITE');
	});

	it('SCSS and CSS both contain expected token CSS var names', () => {
		const scssResults = transformToSCSS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);
		const cssResults = transformToCSS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);

		const scssColors = scssResults.find((r) => r.filename === 'Colors.scss')!;
		const cssColors = cssResults.find((r) => r.filename === 'colors.css')!;

		expect(scssColors.content).toContain('--text-primary');
		expect(cssColors.content).toContain('--text-primary');
		expect(scssColors.content).toContain('--fill-static-white');
		expect(cssColors.content).toContain('--fill-static-white');
	});

	it('underscore separator produces consistent names across SCSS and TS', () => {
		const underscoreConv: DetectedConventions = {
			...conventions,
			scssSeparator: 'underscore'
		};

		const scssResults = transformToSCSS(lightColors, darkColors, underscoreConv);
		const tsResults = transformToTS(lightColors, darkColors, underscoreConv);

		const scssColors = scssResults.find((r) => r.filename === 'Colors.scss')!;
		const tsColors = tsResults.find((r) => r.filename === 'Colors.ts')!;

		expect(scssColors.content).toContain('$text_primary');
		expect(tsColors.content).toContain('TEXT_PRIMARY');
		expect(scssColors.content).toContain('--text_primary');
		expect(tsColors.content).toContain('--text_primary');
	});
});
