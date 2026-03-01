import { describe, it, expect } from 'vitest';
import {
	classifyWebColorFiles,
	classifyKotlinRefFiles,
	classifyKotlinTypographyRefFiles,
	classifyWebTypographyFiles,
	type RefEntry
} from './classify.js';

// ─── classifyWebColorFiles ────────────────────────────────────────────────────

describe('classifyWebColorFiles', () => {
	it('returns empty object for undefined input', () => {
		expect(classifyWebColorFiles(undefined)).toEqual({});
	});

	it('returns empty object for empty array', () => {
		expect(classifyWebColorFiles([])).toEqual({});
	});

	it('classifies scss primitive file by content pattern', () => {
		const entries: RefEntry[] = [
			{ filename: 'colors.scss', content: '$red-100: #ff0000;\n$blue-200: #0000ff;' }
		];
		const result = classifyWebColorFiles(entries);
		expect(result.primitivesScss).toBeDefined();
		expect(result.colorsScss).toBeUndefined();
	});

	it('classifies scss semantic file (no numeric suffix)', () => {
		const entries: RefEntry[] = [
			{ filename: 'colors.scss', content: '$color-primary: $red-500;\n$color-secondary: $blue-300;' }
		];
		const result = classifyWebColorFiles(entries);
		expect(result.colorsScss).toBeDefined();
		expect(result.primitivesScss).toBeUndefined();
	});

	it('classifies ts primitive file by export const pattern', () => {
		const entries: RefEntry[] = [
			{ filename: 'colors.ts', content: 'export const RED_500 = "#ff0000";\nexport const BLUE_200 = "#0000ff";' }
		];
		const result = classifyWebColorFiles(entries);
		expect(result.primitivesTs).toBeDefined();
		expect(result.colorsTs).toBeUndefined();
	});

	it('classifies ts semantic file', () => {
		const entries: RefEntry[] = [
			{ filename: 'colors.ts', content: 'export const primary = RED_500;\nexport const secondary = BLUE_200;' }
		];
		const result = classifyWebColorFiles(entries);
		expect(result.colorsTs).toBeDefined();
		expect(result.primitivesTs).toBeUndefined();
	});

	it('classifies file as primitive by filename containing "primitive"', () => {
		const entries: RefEntry[] = [
			{ filename: 'Primitives.scss', content: '$some-color: #abc;' }
		];
		const result = classifyWebColorFiles(entries);
		expect(result.primitivesScss).toBeDefined();
	});

	it('handles multiple files of different types', () => {
		const entries: RefEntry[] = [
			{ filename: 'primitives.scss', content: '$red-100: #ff0000;' },
			{ filename: 'colors.ts', content: 'export const primary = RED_100;' }
		];
		const result = classifyWebColorFiles(entries);
		expect(result.primitivesScss).toBeDefined();
		expect(result.colorsTs).toBeDefined();
	});
});

// ─── classifyKotlinRefFiles ───────────────────────────────────────────────────

describe('classifyKotlinRefFiles', () => {
	it('returns defaults for undefined input', () => {
		const result = classifyKotlinRefFiles(undefined);
		expect(result).toEqual({ hasPrimitives: false, hasSemantics: false, semanticCategories: [] });
	});

	it('detects primitive object by Palette pattern', () => {
		const entries: RefEntry[] = [
			{ filename: 'ColorPalette.kt', content: 'object RedPalette {\n  val red100 = Color(0xFFFF0000)\n}' }
		];
		const result = classifyKotlinRefFiles(entries);
		expect(result.hasPrimitives).toBe(true);
	});

	it('detects primitive by top-level val Color pattern', () => {
		const entries: RefEntry[] = [
			{ filename: 'Colors.kt', content: 'val RedBase = Color(0xFFFF0000)\nval BlueBase = Color(0xFF0000FF)' }
		];
		const result = classifyKotlinRefFiles(entries);
		expect(result.hasPrimitives).toBe(true);
	});

	it('detects semantics by Light/DarkColorTokens pattern', () => {
		const entries: RefEntry[] = [
			{ filename: 'Colors.kt', content: 'object LightColorTokens {\n  val primary = RedBase\n}' }
		];
		const result = classifyKotlinRefFiles(entries);
		expect(result.hasSemantics).toBe(true);
	});

	it('emits classificationWarning when Color() present but no known class pattern detected', () => {
		// Uses Color() but doesn't match object Palette, top-level val Color, Light/DarkColorTokens,
		// or the extractKotlinColorClassInfo class<Prefix><Category>Colors pattern
		const entries: RefEntry[] = [
			{ filename: 'Colors.kt', content: 'class WeirdColors {\n  fun getColor(): Color = Color(0xFFFF0000)\n}' }
		];
		const result = classifyKotlinRefFiles(entries);
		expect(result.classificationWarning).toBeDefined();
	});

	it('does not emit warning when no Color() content', () => {
		const entries: RefEntry[] = [
			{ filename: 'Colors.kt', content: 'val myString = "hello"' }
		];
		const result = classifyKotlinRefFiles(entries);
		expect(result.classificationWarning).toBeUndefined();
	});
});

// ─── classifyKotlinTypographyRefFiles ─────────────────────────────────────────

describe('classifyKotlinTypographyRefFiles', () => {
	it('returns defaults for undefined input', () => {
		const result = classifyKotlinTypographyRefFiles(undefined);
		expect(result).toEqual({ hasDefinition: false, hasAccessor: false });
	});

	it('detects enum accessor file', () => {
		const entries: RefEntry[] = [
			{
				filename: 'RLocalTypography.kt',
				content: 'enum class RLocalTypography {\n  HEADING;\n  val style get() = MaterialTheme.typography.headlineLarge\n}'
			}
		];
		const result = classifyKotlinTypographyRefFiles(entries);
		expect(result.hasAccessor).toBe(true);
		expect(result.accessorFilename).toBe('RLocalTypography.kt');
	});

	it('detects definition class with @Immutable', () => {
		const entries: RefEntry[] = [
			{
				filename: 'RTypography.kt',
				content: '@Immutable\nclass RTypography(\n  val headlineLarge: TextStyle = TextStyle()\n)'
			}
		];
		const result = classifyKotlinTypographyRefFiles(entries);
		expect(result.hasDefinition).toBe(true);
		expect(result.definitionFilename).toBe('RTypography.kt');
	});

	it('handles both definition and accessor files', () => {
		const entries: RefEntry[] = [
			{
				filename: 'RTypography.kt',
				content: '@Immutable\nclass RTypography(\n  val headlineLarge: TextStyle = TextStyle()\n)'
			},
			{
				filename: 'RLocalTypography.kt',
				content: 'enum class RLocalTypography {\n  HEADING;\n  val style get() = MaterialTheme.typography.headlineLarge\n}'
			}
		];
		const result = classifyKotlinTypographyRefFiles(entries);
		expect(result.hasDefinition).toBe(true);
		expect(result.hasAccessor).toBe(true);
	});
});

// ─── classifyWebTypographyFiles ───────────────────────────────────────────────

describe('classifyWebTypographyFiles', () => {
	it('returns empty object for undefined input', () => {
		expect(classifyWebTypographyFiles(undefined)).toEqual({});
	});

	it('classifies scss typography file', () => {
		const entries: RefEntry[] = [
			{ filename: 'typography.scss', content: '.heading { font-size: 24px; }' }
		];
		const result = classifyWebTypographyFiles(entries);
		expect(result.typoScss).toBeDefined();
		expect(result.typoTs).toBeUndefined();
	});

	it('classifies ts typography file', () => {
		const entries: RefEntry[] = [
			{ filename: 'typography.ts', content: 'export const heading = { fontSize: 24 };' }
		];
		const result = classifyWebTypographyFiles(entries);
		expect(result.typoTs).toBeDefined();
		expect(result.typoScss).toBeUndefined();
	});

	it('classifies css file as scss', () => {
		const entries: RefEntry[] = [
			{ filename: 'typography.css', content: '.heading { font-size: 24px; }' }
		];
		const result = classifyWebTypographyFiles(entries);
		expect(result.typoScss).toBeDefined();
	});

	it('handles both scss and ts files', () => {
		const entries: RefEntry[] = [
			{ filename: 'typography.scss', content: '.heading { font-size: 24px; }' },
			{ filename: 'typography.ts', content: 'export const heading = { fontSize: 24 };' }
		];
		const result = classifyWebTypographyFiles(entries);
		expect(result.typoScss).toBeDefined();
		expect(result.typoTs).toBeDefined();
	});
});
