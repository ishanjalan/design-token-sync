import { describe, it, expect } from 'vitest';
import {
	extractTokenNamesFromContent,
	extractTokenMapFromContent,
	appendRemovedTokenComments
} from './diff-utils.js';

// ─── extractTokenNamesFromContent ────────────────────────────────────────────

describe('extractTokenNamesFromContent', () => {
	it('extracts SCSS variable names', () => {
		const content = `$grey-750: #1d1d1d;\n$blue-200: #b3d4fc;\n`;
		const names = extractTokenNamesFromContent(content);
		expect(names).toEqual(new Set(['grey-750', 'blue-200']));
	});

	it('extracts CSS custom property names', () => {
		const content = `:root {\n  --text-primary: #000;\n  --bg-default: #fff;\n}\n`;
		const names = extractTokenNamesFromContent(content);
		expect(names).toEqual(new Set(['text-primary', 'bg-default']));
	});

	it('extracts TypeScript export const names', () => {
		const content = `export const GREY_750 = '#1d1d1d';\nexport const BLUE_200 = '#b3d4fc';\n`;
		const names = extractTokenNamesFromContent(content);
		expect(names).toEqual(new Set(['GREY_750', 'BLUE_200']));
	});

	it('extracts Swift static let names', () => {
		const content = `  static let grey750 = Color(hex: 0xFF1D1D1D)\n  static let blue200 = Color(hex: 0xFFB3D4FC)\n`;
		const names = extractTokenNamesFromContent(content);
		expect(names).toEqual(new Set(['grey750', 'blue200']));
	});

	it('extracts Kotlin val names', () => {
		const content = `    val grey750 = Color(0xFF1D1D1D)\n    val blue200 = Color(0xFFB3D4FC)\n`;
		const names = extractTokenNamesFromContent(content);
		expect(names).toEqual(new Set(['grey750', 'blue200']));
	});

	it('skips comment-only and empty lines', () => {
		const content = `// Header\n\n$grey-750: #1d1d1d;\n// Footer\n`;
		const names = extractTokenNamesFromContent(content);
		expect(names).toEqual(new Set(['grey-750']));
	});

	it('returns empty set for empty content', () => {
		expect(extractTokenNamesFromContent('')).toEqual(new Set());
	});
});

// ─── extractTokenMapFromContent ──────────────────────────────────────────────

describe('extractTokenMapFromContent', () => {
	it('extracts SCSS name-value pairs', () => {
		const content = `$grey-750: #1d1d1d;\n$blue-200: #b3d4fc;\n`;
		const map = extractTokenMapFromContent(content);
		expect(map.get('grey-750')).toBe('#1d1d1d');
		expect(map.get('blue-200')).toBe('#b3d4fc');
	});

	it('extracts CSS custom property name-value pairs', () => {
		const content = `  --text-primary: var(--grey-900);\n`;
		const map = extractTokenMapFromContent(content);
		expect(map.get('text-primary')).toBe('var(--grey-900)');
	});

	it('extracts TypeScript name-value pairs', () => {
		const content = `export const GREY_750 = '#1d1d1d';\n`;
		const map = extractTokenMapFromContent(content);
		expect(map.get('GREY_750')).toBe('#1d1d1d');
	});

	it('extracts Swift name-value pairs', () => {
		const content = `  static let grey750 = Color(hex: 0xFF1D1D1D)\n`;
		const map = extractTokenMapFromContent(content);
		expect(map.get('grey750')).toBe('Color(hex: 0xFF1D1D1D)');
	});

	it('extracts Kotlin name-value pairs', () => {
		const content = `    val grey750 = Color(0xFF1D1D1D)\n`;
		const map = extractTokenMapFromContent(content);
		expect(map.get('grey750')).toBe('Color(0xFF1D1D1D)');
	});

	it('returns empty map for empty content', () => {
		expect(extractTokenMapFromContent('')).toEqual(new Map());
	});
});

// ─── appendRemovedTokenComments ──────────────────────────────────────────────

describe('appendRemovedTokenComments', () => {
	it('returns content unchanged when no tokens removed', () => {
		const ref = `$grey-750: #1d1d1d;\n`;
		const gen = `$grey-750: #1d1d1d;\n`;
		expect(appendRemovedTokenComments(gen, ref, 'scss')).toBe(gen);
	});

	it('returns content unchanged when generated has more tokens', () => {
		const ref = `$grey-750: #1d1d1d;\n`;
		const gen = `$grey-750: #1d1d1d;\n$blue-200: #b3d4fc;\n`;
		expect(appendRemovedTokenComments(gen, ref, 'scss')).toBe(gen);
	});

	it('appends SCSS removal comments', () => {
		const ref = `$grey-750: #1d1d1d;\n$blue-200: #b3d4fc;\n`;
		const gen = `$grey-750: #1d1d1d;\n`;
		const result = appendRemovedTokenComments(gen, ref, 'scss');
		expect(result).toContain('// REMOVED');
		expect(result).toContain('// $blue-200: #b3d4fc;');
		expect(result).not.toContain('// $grey-750');
		expect(result.indexOf('// REMOVED')).toBeGreaterThan(gen.length - 2);
	});

	it('appends TypeScript removal comments', () => {
		const ref = `export const GREY_750 = '#1d1d1d';\nexport const BLUE_200 = '#b3d4fc';\n`;
		const gen = `export const GREY_750 = '#1d1d1d';\n`;
		const result = appendRemovedTokenComments(gen, ref, 'typescript');
		expect(result).toContain('// REMOVED');
		expect(result).toContain('// export const BLUE_200 = #b3d4fc;');
	});

	it('appends Swift removal comments', () => {
		const ref = `  static let grey750 = Color(hex: 0xFF1D1D1D)\n  static let blue200 = Color(hex: 0xFFB3D4FC)\n`;
		const gen = `  static let grey750 = Color(hex: 0xFF1D1D1D)\n`;
		const result = appendRemovedTokenComments(gen, ref, 'swift');
		expect(result).toContain('// REMOVED');
		expect(result).toContain('// static let blue200 = Color(hex: 0xFFB3D4FC)');
	});

	it('appends Kotlin removal comments', () => {
		const ref = `    val grey750 = Color(0xFF1D1D1D)\n    val blue200 = Color(0xFFB3D4FC)\n`;
		const gen = `    val grey750 = Color(0xFF1D1D1D)\n`;
		const result = appendRemovedTokenComments(gen, ref, 'kotlin');
		expect(result).toContain('// REMOVED');
		expect(result).toContain('// val blue200 = Color(0xFFB3D4FC)');
	});

	it('appends CSS removal comments with block comment syntax', () => {
		const ref = `  --text-primary: #000;\n  --bg-default: #fff;\n`;
		const gen = `  --text-primary: #000;\n`;
		const result = appendRemovedTokenComments(gen, ref, 'css');
		expect(result).toContain('/* REMOVED');
		expect(result).toContain('/* --bg-default: #fff; */');
	});

	it('handles multiple removed tokens', () => {
		const ref = `$red-500: #f00;\n$green-500: #0f0;\n$blue-500: #00f;\n$yellow-500: #ff0;\n`;
		const gen = `$red-500: #f00;\n$blue-500: #00f;\n`;
		const result = appendRemovedTokenComments(gen, ref, 'scss');
		expect(result).toContain('// $green-500: #0f0;');
		expect(result).toContain('// $yellow-500: #ff0;');
		expect(result).not.toContain('// $red-500');
		expect(result).not.toContain('// $blue-500');
	});

	it('handles empty reference gracefully', () => {
		const gen = `$grey-750: #1d1d1d;\n`;
		expect(appendRemovedTokenComments(gen, '', 'scss')).toBe(gen);
	});

	it('handles reference with only comments', () => {
		const ref = `// Header comment\n// Another comment\n`;
		const gen = `$grey-750: #1d1d1d;\n`;
		expect(appendRemovedTokenComments(gen, ref, 'scss')).toBe(gen);
	});

	it('ends with a trailing newline', () => {
		const ref = `$red-500: #f00;\n$green-500: #0f0;\n`;
		const gen = `$red-500: #f00;\n`;
		const result = appendRemovedTokenComments(gen, ref, 'scss');
		expect(result.endsWith('\n')).toBe(true);
	});
});
