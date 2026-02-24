import { describe, it, expect } from 'vitest';
import { detectRefCompleteness } from './ref-completeness.js';

describe('detectRefCompleteness', () => {
	it('returns no warnings when no reference content', () => {
		expect(detectRefCompleteness({})).toEqual([]);
	});

	it('returns no warnings when both primitives and semantics are present (Kotlin)', () => {
		const content = `
object RedPalette {
    val colorRed50 = Color(0xFFFDE6E5)
}
class RTextColors(
    textPrimary: Color,
)`;
		expect(detectRefCompleteness({ referenceColorsKotlin: content })).toEqual([]);
	});

	it('warns when Kotlin has primitives but no semantics', () => {
		const content = `
object GreyPalette {
    val colorGrey50 = Color(0xFFF5F5F5)
}`;
		const warnings = detectRefCompleteness({ referenceColorsKotlin: content });
		expect(warnings).toHaveLength(1);
		expect(warnings[0].key).toBe('referenceColorsKotlin');
		expect(warnings[0].message).toContain('primitives file');
	});

	it('warns when Kotlin has semantics but no primitives', () => {
		const content = `
class RTextColors(
    textPrimary: Color,
)`;
		const warnings = detectRefCompleteness({ referenceColorsKotlin: content });
		expect(warnings).toHaveLength(1);
		expect(warnings[0].key).toBe('referenceColorsKotlin');
		expect(warnings[0].message).toContain('semantic color files');
	});

	it('detects Kotlin Primitives object as primitives', () => {
		const content = `object Primitives { val grey50 = Color(0xFFF5F5F5) }`;
		const warnings = detectRefCompleteness({ referenceColorsKotlin: content });
		expect(warnings).toHaveLength(1);
		expect(warnings[0].message).toContain('primitives file');
	});

	it('detects LightColorTokens as semantics', () => {
		const content = `object LightColorTokens { val textPrimary = Primitives.grey750 }`;
		const warnings = detectRefCompleteness({ referenceColorsKotlin: content });
		expect(warnings).toHaveLength(1);
		expect(warnings[0].message).toContain('semantic color files');
	});

	it('returns no warnings when both primitives and semantics are present (Web)', () => {
		const content = `
$grey-750: #1d1d1d;
$text-primary: var(--text-primary);`;
		expect(detectRefCompleteness({ referenceColorsWeb: content })).toEqual([]);
	});

	it('warns when Web has primitives but no semantics', () => {
		const content = `$grey-750: #1d1d1d;`;
		const warnings = detectRefCompleteness({ referenceColorsWeb: content });
		expect(warnings).toHaveLength(1);
		expect(warnings[0].key).toBe('referenceColorsWeb');
		expect(warnings[0].message).toContain('primitives');
	});

	it('warns when Web has semantics but no primitives', () => {
		const content = `$text-primary: var(--text-primary);`;
		const warnings = detectRefCompleteness({ referenceColorsWeb: content });
		expect(warnings).toHaveLength(1);
		expect(warnings[0].key).toBe('referenceColorsWeb');
		expect(warnings[0].message).toContain('semantic color file');
	});

	it('returns no warnings for Swift (single-file convention)', () => {
		const content = `static let grey750 = Color(hex: "#1D1D1D")`;
		expect(detectRefCompleteness({ referenceColorsSwift: content })).toEqual([]);
	});
});
