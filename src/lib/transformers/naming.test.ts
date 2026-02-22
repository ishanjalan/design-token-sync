import { describe, it, expect } from 'vitest';
import { detectConventions, scssVarToTsName, cssVarToTsName } from './naming.js';

// ─── detectConventions ────────────────────────────────────────────────────────

describe('detectConventions', () => {
	it('returns best-practice defaults when no content provided (even with bestPractices=false)', () => {
		const c = detectConventions(undefined, undefined, undefined, undefined, false);
		expect(c.scssPrefix).toBe('$');
		expect(c.tsPrefix).toBe('export const ');
		expect(c.scssSeparator).toBe('hyphen');
		expect(c.tsNamingCase).toBe('screaming_snake');
		expect(c.importStyle).toBe('use');
		expect(c.hasTypeAnnotations).toBe(true);
	});

	it('detects @use import style', () => {
		const c = detectConventions(
			"@use './Primitives' as *;\n$grey-50: #fff;",
			undefined,
			undefined,
			undefined
		);
		expect(c.importStyle).toBe('use');
	});

	it('detects @import import style', () => {
		const c = detectConventions(
			"@import './Primitives';\n$grey-50: #fff;",
			undefined,
			undefined,
			undefined,
			false
		);
		expect(c.importStyle).toBe('import');
	});

	it('detects underscore SCSS separator when underscores dominate', () => {
		const scss = '$grey_50: #fff;\n$grey_100: #eee;\n$grey_200: #ddd;';
		const c = detectConventions(scss, undefined, undefined, undefined, false);
		expect(c.scssSeparator).toBe('underscore');
	});

	it('detects hyphen SCSS separator when hyphens dominate', () => {
		const scss = '$grey-50: #fff;\n$grey-100: #eee;\n$grey-200: #ddd;';
		const c = detectConventions(scss, undefined, undefined, undefined);
		expect(c.scssSeparator).toBe('hyphen');
	});

	it('detects screaming_snake TypeScript naming', () => {
		const ts = 'export const GREY_50 = "#fff";\nexport const GREY_100 = "#eee";';
		const c = detectConventions(undefined, undefined, ts, undefined);
		expect(c.tsNamingCase).toBe('screaming_snake');
	});

	it('detects camelCase TypeScript naming', () => {
		const ts = 'export const grey50 = "#fff";\nexport const grey100 = "#eee";';
		const c = detectConventions(undefined, undefined, ts, undefined, false);
		expect(c.tsNamingCase).toBe('camel');
	});

	it('detects PascalCase TypeScript naming', () => {
		const ts = 'export const GreyFifty = "#fff";\nexport const GreyHundred = "#eee";';
		const c = detectConventions(undefined, undefined, ts, undefined, false);
		expect(c.tsNamingCase).toBe('pascal');
	});

	it('detects type annotations', () => {
		const ts = 'export const GREY_50: string = "#fff";';
		const c = detectConventions(undefined, undefined, ts, undefined);
		expect(c.hasTypeAnnotations).toBe(true);
	});

	it('returns false for hasTypeAnnotations when absent', () => {
		const ts = "export const GREY_50 = '#fff' as const;";
		const c = detectConventions(undefined, undefined, ts, undefined, false);
		expect(c.hasTypeAnnotations).toBe(false);
	});

	it('combines all four files for detection', () => {
		// Primitives has underscores, Colors has hyphens — hyphen should still win (equal = default hyphen)
		const primitivesScss = '$grey_50: #fff;';
		const colorsScss = '@use "./Primitives" as *;\n$text-primary: red;';
		const primitivesTs = 'export const GREY_50 = "#fff";';
		const colorsTs = 'export const TEXT_PRIMARY = "red";';
		const c = detectConventions(primitivesScss, colorsScss, primitivesTs, colorsTs);
		// Both Ts files have screaming_snake — should detect it
		expect(c.tsNamingCase).toBe('screaming_snake');
		// @use found in colorsScss
		expect(c.importStyle).toBe('use');
	});

	// ─── scssColorStructure detection ────────────────────────────────────────

	it('detects inline structure when Colors.scss has light-dark() and no :root', () => {
		const colorsScss = [
			"@import './Primitives.scss';",
			'',
			'$fill-brand-primary: var(--fill-brand-primary, light-dark($red-300, $red-200));',
			'$fill-static-white: var(--fill-static-white, $grey-0);'
		].join('\n');
		const c = detectConventions(undefined, colorsScss, undefined, undefined, false);
		expect(c.scssColorStructure).toBe('inline');
	});

	it('detects media-query structure when Colors.scss has :root + @media prefers-color-scheme', () => {
		const colorsScss = [
			"@import './Primitives';",
			':root { --text-primary: #{$grey-750}; }',
			'@media (prefers-color-scheme: dark) { :root { --text-primary: #{$grey-50}; } }',
			'$text-primary: var(--text-primary);'
		].join('\n');
		const c = detectConventions(undefined, colorsScss, undefined, undefined, false);
		expect(c.scssColorStructure).toBe('media-query');
	});

	it('defaults to modern structure when Colors.scss has :root without media query', () => {
		const colorsScss = [
			"@use './Primitives' as *;",
			':root { color-scheme: light dark; --text-primary: light-dark(#{$grey-750}, #{$grey-50}); }'
		].join('\n');
		const c = detectConventions(undefined, colorsScss, undefined, undefined, false);
		expect(c.scssColorStructure).toBe('modern');
	});

	it('returns modern structure when no Colors.scss is provided', () => {
		const c = detectConventions('$grey-50: #fff;', undefined, undefined, undefined, false);
		expect(c.scssColorStructure).toBe('modern');
	});

	// ─── importSuffix detection ──────────────────────────────────────────────

	it('detects .scss import suffix', () => {
		const scss = "@import './Primitives.scss';\n$grey-50: #fff;";
		const c = detectConventions(scss, undefined, undefined, undefined, false);
		expect(c.importSuffix).toBe('.scss');
	});

	it('detects empty import suffix when .scss extension is absent', () => {
		const scss = "@import './Primitives';\n$grey-50: #fff;";
		const c = detectConventions(scss, undefined, undefined, undefined, false);
		expect(c.importSuffix).toBe('');
	});

	it('detects .scss suffix from @use statements', () => {
		const scss = "@use './Primitives.scss' as *;\n$grey-50: #fff;";
		const c = detectConventions(scss, undefined, undefined, undefined, false);
		expect(c.importSuffix).toBe('.scss');
	});
});

// ─── scssVarToTsName ──────────────────────────────────────────────────────────

describe('scssVarToTsName', () => {
	it('screaming_snake: $grey-750 → GREY_750', () => {
		expect(scssVarToTsName('$grey-750', 'screaming_snake')).toBe('GREY_750');
	});

	it('screaming_snake: $text-primary → TEXT_PRIMARY', () => {
		expect(scssVarToTsName('$text-primary', 'screaming_snake')).toBe('TEXT_PRIMARY');
	});

	it('screaming_snake: $grey-alpha-750-8 → GREY_ALPHA_750_8', () => {
		expect(scssVarToTsName('$grey-alpha-750-8', 'screaming_snake')).toBe('GREY_ALPHA_750_8');
	});

	it('snake: $grey-750 → grey_750', () => {
		expect(scssVarToTsName('$grey-750', 'snake')).toBe('grey_750');
	});

	it('camel: $text-primary → textPrimary', () => {
		expect(scssVarToTsName('$text-primary', 'camel')).toBe('textPrimary');
	});

	it('pascal: $text-primary → TextPrimary', () => {
		expect(scssVarToTsName('$text-primary', 'pascal')).toBe('TextPrimary');
	});

	it('kebab: $text-primary → text-primary', () => {
		expect(scssVarToTsName('$text-primary', 'kebab')).toBe('text-primary');
	});

	it('works without $ prefix', () => {
		expect(scssVarToTsName('grey-750', 'screaming_snake')).toBe('GREY_750');
	});
});

// ─── cssVarToTsName ───────────────────────────────────────────────────────────

describe('cssVarToTsName', () => {
	it('--text-primary → TEXT_PRIMARY (screaming_snake)', () => {
		expect(cssVarToTsName('--text-primary', 'screaming_snake')).toBe('TEXT_PRIMARY');
	});

	it('--fill-component-primary → fillComponentPrimary (camel)', () => {
		expect(cssVarToTsName('--fill-component-primary', 'camel')).toBe('fillComponentPrimary');
	});
});
