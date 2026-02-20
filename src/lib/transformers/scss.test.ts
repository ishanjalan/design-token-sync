import { describe, it, expect } from 'vitest';
import { transformToSCSS } from './scss.js';
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
	lightColorsLongName,
	darkColorsLongName,
	darkColorsNonColorAtPath,
	darkColorsNonObjectPath,
	lightColorsNonColourAlias,
	darkColorsUnknownPrimitive,
	lightColorsWithSortTie,
	darkColorsWithSortTie,
	lightColorsNoAlias,
	darkColorsNonColourAlias
} from './fixtures.js';

describe('transformToSCSS', () => {
	it('returns exactly two files: Primitives.scss and Colors.scss', () => {
		const results = transformToSCSS(lightColors, darkColors);
		expect(results).toHaveLength(2);
		expect(results[0].filename).toBe('Primitives.scss');
		expect(results[1].filename).toBe('Colors.scss');
	});

	it('sets format to scss for both files', () => {
		const [prims, colors] = transformToSCSS(lightColors, darkColors);
		expect(prims.format).toBe('scss');
		expect(colors.format).toBe('scss');
	});

	// ─── Primitives.scss ───────────────────────────────────────────────────────

	describe('Primitives.scss', () => {
		it('contains DO NOT EDIT header', () => {
			const [prims] = transformToSCSS(lightColors, darkColors);
			expect(prims.content).toContain('DO NOT EDIT');
		});

		it('generates $grey-750 SCSS variable with correct hex', () => {
			const [prims] = transformToSCSS(lightColors, darkColors);
			expect(prims.content).toContain('$grey-750: #1d1d1d;');
		});

		it('generates $grey-0 SCSS variable with correct hex', () => {
			const [prims] = transformToSCSS(lightColors, darkColors);
			expect(prims.content).toContain('$grey-0: #ffffff;');
		});

		it('generates $grey-50 SCSS variable from dark colors alias data', () => {
			const [prims] = transformToSCSS(lightColors, darkColors);
			expect(prims.content).toContain('$grey-50: #f5f5f5;');
		});

		it('generates 8-digit hex for alpha primitives', () => {
			const [prims] = transformToSCSS(lightColorsWithAlpha, darkColorsWithAlpha);
			// Colour/Grey_Alpha/750_50 → $grey-alpha-750-50 with 8-digit hex (#RRGGBBAA)
			expect(prims.content).toMatch(/\$grey-alpha-750-50: #[0-9a-f]{8};/);
		});

		it('groups primitives under family comment', () => {
			const [prims] = transformToSCSS(lightColors, darkColors);
			expect(prims.content).toMatch(/\/\/ grey/i);
		});
	});

	// ─── Colors.scss ───────────────────────────────────────────────────────────

	describe('Colors.scss', () => {
		it('uses @use instead of @import', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			expect(colors.content).toContain("@use './Primitives' as *;");
			expect(colors.content).not.toContain('@import');
		});

		it('includes :root { color-scheme: light dark; }', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			expect(colors.content).toContain(':root {');
			expect(colors.content).toContain('color-scheme: light dark;');
		});

		it('emits @property typed declarations for CSS custom properties', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			expect(colors.content).toContain('@property --text-primary {');
			expect(colors.content).toContain("  syntax: '<color>';");
			expect(colors.content).toContain('  inherits: true;');
			expect(colors.content).toContain('  initial-value: transparent;');
		});

		it('sets CSS custom properties in :root using SCSS interpolation for light-dark()', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			// The :root block should contain the light-dark() call with SCSS #{} interpolation
			expect(colors.content).toContain('--text-primary: light-dark(#{$grey-750}, #{$grey-50});');
		});

		it('generates light-dark() for semantic tokens that differ between modes', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			// light-dark() with SCSS interpolation appears in :root
			expect(colors.content).toContain('light-dark(#{$grey-750}, #{$grey-50})');
		});

		it('generates a simple var() SCSS alias (no inline fallback)', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			expect(colors.content).toContain('$text-primary: var(--text-primary);');
			// No inline fallback — the fallback is in :root
			expect(colors.content).not.toMatch(/\$text-primary: var\(--text-primary, light-dark/);
		});

		it('uses single primitive (no light-dark()) for static tokens', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			// Static token in :root uses SCSS interpolation directly (no light-dark)
			expect(colors.content).toContain('--fill-static-white: #{$grey-0};');
			expect(colors.content).toContain('$fill-static-white: var(--fill-static-white);');
			expect(colors.content).not.toMatch(/--fill-static-white.*light-dark/);
		});

		it('strips "Standard" from token names', () => {
			const [, colors] = transformToSCSS(lightColorsWithStandard, darkColorsWithStandard);
			// Stroke/Standard/strong → $stroke-strong (not $stroke-standard-strong)
			expect(colors.content).toContain('$stroke-strong');
			expect(colors.content).not.toContain('$stroke-standard-strong');
		});

		it('groups tokens under category comments', () => {
			const [, colors] = transformToSCSS(lightColors, darkColors);
			expect(colors.content).toMatch(/\/\/ Text colors/);
			expect(colors.content).toMatch(/\/\/ Fill colors/);
		});

		it('formats long token names correctly in :root and SCSS alias', () => {
			const [, colors] = transformToSCSS(lightColorsLongName, darkColorsLongName);
			// Token name "Fill/Component/some-very-long-descriptive-name" → kebab-case
			expect(colors.content).toContain('--fill-component-some-very-long-descriptive-name:');
			expect(colors.content).toContain(
				'$fill-component-some-very-long-descriptive-name: var(--fill-component-some-very-long-descriptive-name);'
			);
		});
	});

	// ─── Tree-walking edge cases ──────────────────────────────────────────────

	describe('tree-walking edge cases', () => {
		it('falls back to light primitive when dark path leads to a non-color node', () => {
			// getTokenAtPath returns null → darkPrim falls back to lightPrim
			const [, colors] = transformToSCSS(lightColors, darkColorsNonColorAtPath);
			// Should still generate the token, using lightPrim for both sides
			expect(colors.content).toContain('$text-primary');
		});

		it('handles dark colors with a non-object at an intermediate path', () => {
			// walkTokens/walkTokensWithPath null guard; getTokenAtPath non-object guard
			const [, colors] = transformToSCSS(lightColors, darkColorsNonObjectPath);
			expect(colors.content).toContain('$text-primary');
		});
	});

	// ─── buildPrimitiveMapFromExport path ─────────────────────────────────────

	describe('with explicit primitives export', () => {
		it('generates Primitives.scss from the dedicated export', () => {
			const [prims] = transformToSCSS(
				lightColorsForPrimitivesPath,
				darkColorsForPrimitivesPath,
				primitivesExport
			);
			expect(prims.content).toContain('$grey-750: #1d1d1d;');
			expect(prims.content).toContain('$grey-50: #f5f5f5;');
			expect(prims.content).toContain('$grey-0: #ffffff;');
		});

		it('generates Colors.scss using the primitives from the dedicated export', () => {
			const [, colors] = transformToSCSS(
				lightColorsForPrimitivesPath,
				darkColorsForPrimitivesPath,
				primitivesExport
			);
			expect(colors.content).toContain('light-dark(#{$grey-750}, #{$grey-50})');
		});

		it('skips non-Colour tokens in the primitives export (!scssVar guard)', () => {
			// primitivesExportWithNonColour has a Spacing/ entry that figmaNameToScssVar rejects
			const [prims] = transformToSCSS(
				lightColorsForPrimitivesPath,
				darkColorsForPrimitivesPath,
				primitivesExportWithNonColour
			);
			expect(prims.content).not.toContain('$spacing');
			expect(prims.content).toContain('$grey-750');
		});
	});

	// ─── buildPrimitiveMapFromAliasData edge cases ────────────────────────────

	describe('alias data edge cases', () => {
		it('skips tokens whose aliasData target is not under Colour/', () => {
			const [prims] = transformToSCSS(lightColorsNonColourAlias, darkColors);
			expect(prims.content).not.toContain('spacing');
		});

		it('skips light tokens with no aliasData (!lightFigmaName guard)', () => {
			const [, colors] = transformToSCSS(lightColorsNoAlias, darkColors);
			expect(colors.content).toContain('$text-primary');
			expect(colors.content).not.toContain('no-alias');
		});

		it('falls back to lightPrim when dark has non-Colour aliasData (?? lightPrim)', () => {
			const [, colors] = transformToSCSS(lightColors, darkColorsNonColourAlias);
			expect(colors.content).toContain('$text-primary');
		});

		it('falls back to lightPrim when dark references a Colour primitive not in the map', () => {
			const [, colors] = transformToSCSS(lightColors, darkColorsUnknownPrimitive);
			expect(colors.content).toContain('$text-primary');
		});

		it('uses localeCompare tie-breaker when two primitives in same family share sortKey', () => {
			// $grey-0 and $grey-0-warm both: family 'grey', sortKey 0
			const [prims] = transformToSCSS(lightColorsWithSortTie, darkColorsWithSortTie);
			expect(prims.content).toContain('$grey-0:');
			expect(prims.content).toContain('$grey-0-warm:');
		});
	});
});
