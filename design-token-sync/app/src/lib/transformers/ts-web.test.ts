import { describe, it, expect } from 'vitest';
import { transformToTS } from './ts-web.js';
import {
	lightColors,
	darkColors,
	lightColorsWithStandard,
	darkColorsWithStandard,
	lightColorsWithAlpha,
	darkColorsWithAlpha,
	primitivesExport,
	primitivesExportWithNonColour,
	lightColorsForPrimitivesPath,
	darkColorsForPrimitivesPath,
	darkColorsNonColorAtPath,
	darkColorsNonObjectPath,
	lightColorsNonColourAlias,
	darkColorsUnknownPrimitive,
	lightColorsWithSortTie,
	darkColorsWithSortTie,
	lightColorsNoAlias,
	darkColorsNonColourAlias,
	darkColorsNullAtLeaf
} from './fixtures.js';
import type { DetectedConventions } from '$lib/types.js';

const screamingSnake: DetectedConventions = {
	scssPrefix: '$',
	scssSeparator: 'hyphen',
	tsPrefix: 'export const ',
	tsNamingCase: 'screaming_snake',
	importStyle: 'use',
	hasTypeAnnotations: false
};

const camelCase: DetectedConventions = { ...screamingSnake, tsNamingCase: 'camel' };

describe('transformToTS', () => {
	it('returns exactly two files: Primitives.ts and Colors.ts', () => {
		const results = transformToTS(lightColors, darkColors, screamingSnake);
		expect(results).toHaveLength(2);
		expect(results[0].filename).toBe('Primitives.ts');
		expect(results[1].filename).toBe('Colors.ts');
	});

	it('sets format to typescript for both files', () => {
		const [prims, colors] = transformToTS(lightColors, darkColors, screamingSnake);
		expect(prims.format).toBe('typescript');
		expect(colors.format).toBe('typescript');
	});

	// ─── Primitives.ts ────────────────────────────────────────────────────────

	describe('Primitives.ts', () => {
		it('contains DO NOT EDIT header', () => {
			const [prims] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(prims.content).toContain('DO NOT EDIT');
		});

		it('exports primitive in screaming_snake case with as const', () => {
			const [prims] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(prims.content).toContain("export const GREY_750 = '#1d1d1d' as const;");
		});

		it('exports primitive in camelCase when convention says camel', () => {
			const [prims] = transformToTS(lightColors, darkColors, camelCase);
			expect(prims.content).toContain("export const grey750 = '#1d1d1d' as const;");
		});

		it('includes all primitives from both light and dark exports', () => {
			const [prims] = transformToTS(lightColors, darkColors, screamingSnake);
			// grey-750 from light, grey-50 from dark
			expect(prims.content).toContain('GREY_750');
			expect(prims.content).toContain('GREY_50');
		});

		it('groups primitives under family comments', () => {
			const [prims] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(prims.content).toMatch(/\/\/ Grey color family/);
		});
	});

	// ─── Colors.ts ────────────────────────────────────────────────────────────

	describe('Colors.ts', () => {
		it('imports from Primitives', () => {
			const [, colors] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(colors.content).toContain("import * as PRIMITIVES from './Primitives'");
		});

		it('generates light-dark() for tokens that differ between modes', () => {
			const [, colors] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(colors.content).toContain('light-dark(${PRIMITIVES.GREY_750}, ${PRIMITIVES.GREY_50})');
		});

		it('wraps the value in a var() CSS custom property call', () => {
			const [, colors] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(colors.content).toMatch(/TEXT_PRIMARY.*var\(--text-primary/);
		});

		it('uses as const on all exports', () => {
			const [, colors] = transformToTS(lightColors, darkColors, screamingSnake);
			const exportLines = colors.content.split('\n').filter((l) => l.startsWith('export const'));
			expect(exportLines.length).toBeGreaterThan(0);
			for (const line of exportLines) {
				expect(line).toContain('as const');
			}
		});

		it('uses single primitive (no light-dark()) for static tokens', () => {
			const [, colors] = transformToTS(lightColors, darkColors, screamingSnake);
			// Fill/Static/white should not have light-dark()
			expect(colors.content).toMatch(/FILL_STATIC_WHITE.*var\(--fill-static-white/);
			const staticLine = colors.content.split('\n').find((l) => l.includes('FILL_STATIC_WHITE'));
			expect(staticLine).not.toContain('light-dark');
		});

		it('strips "Standard" from token names', () => {
			const [, colors] = transformToTS(
				lightColorsWithStandard,
				darkColorsWithStandard,
				screamingSnake
			);
			// Stroke/Standard/strong → STROKE_STRONG
			expect(colors.content).toContain('STROKE_STRONG');
			expect(colors.content).not.toContain('STROKE_STANDARD_STRONG');
		});

		it('groups tokens under category comments', () => {
			const [, colors] = transformToTS(lightColors, darkColors, screamingSnake);
			expect(colors.content).toMatch(/\/\/ Text colors/);
			expect(colors.content).toMatch(/\/\/ Fill colors/);
		});

		it('uses camelCase when convention says camel', () => {
			const [, colors] = transformToTS(lightColors, darkColors, camelCase);
			expect(colors.content).toContain('textPrimary');
			expect(colors.content).not.toContain('TEXT_PRIMARY');
		});
	});

	// ─── buildPrimitiveMapFromExport path ────────────────────────────────────

	describe('with explicit primitives export', () => {
		it('generates Primitives.ts from the dedicated export', () => {
			const [prims] = transformToTS(
				lightColorsForPrimitivesPath,
				darkColorsForPrimitivesPath,
				screamingSnake,
				primitivesExport
			);
			expect(prims.content).toContain("export const GREY_750 = '#1d1d1d' as const;");
			expect(prims.content).toContain("export const GREY_0 = '#ffffff' as const;");
		});

		it('generates Colors.ts using the primitives from the dedicated export', () => {
			const [, colors] = transformToTS(
				lightColorsForPrimitivesPath,
				darkColorsForPrimitivesPath,
				screamingSnake,
				primitivesExport
			);
			expect(colors.content).toContain('light-dark(${PRIMITIVES.GREY_750}, ${PRIMITIVES.GREY_50})');
		});

		it('skips non-Colour tokens in primitives export (!scssVar guard)', () => {
			const [prims] = transformToTS(
				lightColorsForPrimitivesPath,
				darkColorsForPrimitivesPath,
				screamingSnake,
				primitivesExportWithNonColour
			);
			expect(prims.content).not.toContain('SPACING');
			expect(prims.content).toContain('GREY_750');
		});
	});

	// ─── alias data edge cases ────────────────────────────────────────────────

	describe('alias data edge cases', () => {
		it('skips tokens whose aliasData target is not under Colour/', () => {
			const [prims] = transformToTS(lightColorsNonColourAlias, darkColors, screamingSnake);
			expect(prims.content).not.toContain('SPACING');
		});

		it('skips light tokens with no aliasData (!lightFigmaName guard)', () => {
			const [, colors] = transformToTS(lightColorsNoAlias, darkColors, screamingSnake);
			expect(colors.content).toContain('TEXT_PRIMARY');
			expect(colors.content).not.toContain('NO_ALIAS');
		});

		it('falls back to lightPrim when dark has non-Colour aliasData (?? lightPrim)', () => {
			const [, colors] = transformToTS(lightColors, darkColorsNonColourAlias, screamingSnake);
			expect(colors.content).toContain('TEXT_PRIMARY');
		});

		it('falls back to lightPrim when dark references a Colour primitive not in the map', () => {
			const [, colors] = transformToTS(lightColors, darkColorsUnknownPrimitive, screamingSnake);
			expect(colors.content).toContain('TEXT_PRIMARY');
		});

		it('uses localeCompare tie-breaker when two primitives in same family share sortKey', () => {
			const [prims] = transformToTS(lightColorsWithSortTie, darkColorsWithSortTie, screamingSnake);
			expect(prims.content).toContain('GREY_0');
			expect(prims.content).toContain('GREY_0_WARM');
		});

		it('handles null leaf value in dark colors (getTokenAtPath post-loop null guard)', () => {
			// darkColorsNullAtLeaf has { Text: { primary: null } }
			const [, colors] = transformToTS(lightColors, darkColorsNullAtLeaf, screamingSnake);
			// Should still generate the token (fallback to lightPrim for dark)
			expect(colors.content).toContain('TEXT_PRIMARY');
		});
	});

	// ─── Tree-walking edge cases ────────────────────────────────────────────

	describe('tree-walking edge cases', () => {
		it('falls back to light primitive when dark path leads to a non-color node', () => {
			const [, colors] = transformToTS(lightColors, darkColorsNonColorAtPath, screamingSnake);
			expect(colors.content).toContain('TEXT_PRIMARY');
		});

		it('handles dark colors with a non-object at an intermediate path', () => {
			const [, colors] = transformToTS(lightColors, darkColorsNonObjectPath, screamingSnake);
			expect(colors.content).toContain('TEXT_PRIMARY');
		});
	});

	// ─── 8-digit hex branch in resolveColorValue ────────────────────────────

	describe('alpha primitives', () => {
		it('generates 8-digit hex primitives in Primitives.ts', () => {
			const [prims] = transformToTS(lightColorsWithAlpha, darkColorsWithAlpha, screamingSnake);
			expect(prims.content).toMatch(/GREY_ALPHA_750_50 = '#[0-9a-f]{8}' as const;/);
		});
	});
});
