import { describe, it, expect } from 'vitest';
import { validateFigmaJson, computeInsight } from './file-validation.js';

// ─── validateFigmaJson ───────────────────────────────────────────────────────

describe('validateFigmaJson', () => {
	it('returns null for non-JSON keys (reference files)', () => {
		expect(validateFigmaJson('referenceColorsWeb', 'not json')).toBeNull();
		expect(validateFigmaJson('referenceColorsSwift', '')).toBeNull();
	});

	it('returns null for valid light/dark color JSON', () => {
		const json = JSON.stringify({
			Text: { primary: { $type: 'color', $value: { hex: '#000000' } } }
		});
		expect(validateFigmaJson('lightColors', json)).toBeNull();
		expect(validateFigmaJson('darkColors', json)).toBeNull();
	});

	it('accepts shadow tokens in light/dark files', () => {
		const json = JSON.stringify({
			Elevation: { small: { $type: 'shadow', $value: {} } }
		});
		expect(validateFigmaJson('lightColors', json)).toBeNull();
	});

	it('accepts border tokens in light/dark files', () => {
		const json = JSON.stringify({
			Border: { thin: { $type: 'border', $value: {} } }
		});
		expect(validateFigmaJson('darkColors', json)).toBeNull();
	});

	it('warns when light/dark has no recognized token types', () => {
		const json = JSON.stringify({ foo: { bar: 'baz' } });
		expect(validateFigmaJson('lightColors', json)).toContain('No $type');
	});

	it('returns null for valid values JSON', () => {
		const json = JSON.stringify({
			Integer: { '4': { $type: 'number', $value: 4 } }
		});
		expect(validateFigmaJson('values', json)).toBeNull();
	});

	it('warns when values has no number tokens', () => {
		const json = JSON.stringify({ foo: { bar: 'baz' } });
		expect(validateFigmaJson('values', json)).toContain('No $type: "number"');
	});

	it('returns null for valid typography JSON', () => {
		const json = JSON.stringify({
			typography: { heading: { $type: 'typography', $value: {} } }
		});
		expect(validateFigmaJson('typography', json)).toBeNull();
	});

	it('warns when typography key missing', () => {
		const json = JSON.stringify({ foo: {} });
		expect(validateFigmaJson('typography', json)).toContain('No typography');
	});

	it('returns error for invalid JSON', () => {
		expect(validateFigmaJson('lightColors', 'not json {')).toContain('Invalid JSON');
	});
});

// ─── computeInsight ──────────────────────────────────────────────────────────

describe('computeInsight', () => {
	it('counts lines for reference files', () => {
		const result = computeInsight('referenceColorsWeb', '$a: 1;\n$b: 2;\n$c: 3;');
		expect(result).toEqual({ count: 3, label: 'lines' });
	});

	it('counts color tokens in light/dark files', () => {
		const json = JSON.stringify({
			Text: { primary: { $type: 'color', $value: {} } },
			Fill: { secondary: { $type: 'color', $value: {} } }
		});
		const result = computeInsight('lightColors', json);
		expect(result).toEqual({ count: 2, label: 'color tokens' });
	});

	it('counts spacing tokens in values files', () => {
		const json = JSON.stringify({
			Integer: {
				'4': { $type: 'number', $value: 4 },
				'8': { $type: 'number', $value: 8 },
				'16': { $type: 'number', $value: 16 }
			}
		});
		const result = computeInsight('values', json);
		expect(result).toEqual({ count: 3, label: 'spacing tokens' });
	});

	it('counts typography styles', () => {
		const json = JSON.stringify({
			typography: {
				heading: { $type: 'typography', $value: {} },
				body: { $type: 'typography', $value: {} }
			}
		});
		const result = computeInsight('typography', json);
		expect(result).toEqual({ count: 2, label: 'text styles' });
	});

	it('returns undefined for invalid JSON on json keys', () => {
		const result = computeInsight('lightColors', 'broken {');
		expect(result).toBeUndefined();
	});

	it('handles deeply nested tokens', () => {
		const json = JSON.stringify({
			Category: {
				Sub: {
					deep: { $type: 'color', $value: {} }
				}
			}
		});
		const result = computeInsight('darkColors', json);
		expect(result).toEqual({ count: 1, label: 'color tokens' });
	});
});
