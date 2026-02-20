import { describe, it, expect } from 'vitest';
import { transformToOpacity, countOpacityTokens } from './opacity.js';

const opacityExport = {
	Opacity: {
		low: { $type: 'number', $value: 0.2 },
		medium: { $type: 'number', $value: 0.5 },
		high: { $type: 'number', $value: 0.8 },
		full: { $type: 'number', $value: 1 }
	}
};

describe('transformToOpacity', () => {
	it('generates SCSS for web platform', () => {
		const results = transformToOpacity(opacityExport, ['web']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Opacity.scss');
		expect(results[0].platform).toBe('web');
		expect(results[0].content).toContain('$opacity-low: 0.2');
		expect(results[0].content).toContain('$opacity-high: 0.8');
		expect(results[0].content).toContain('--opacity-low');
	});

	it('generates Swift for ios platform', () => {
		const results = transformToOpacity(opacityExport, ['ios']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Opacity.swift');
		expect(results[0].content).toContain('Opacity');
		expect(results[0].content).toContain('opacityLow');
	});

	it('generates Kotlin for android platform', () => {
		const results = transformToOpacity(opacityExport, ['android']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Opacity.kt');
		expect(results[0].content).toContain('opacityLow');
		expect(results[0].content).toContain('0.2f');
	});

	it('normalizes values > 1 to 0–1 range', () => {
		const export100 = {
			Opacity: {
				half: { $type: 'number', $value: 50 }
			}
		};
		const results = transformToOpacity(export100, ['web']);
		expect(results).toHaveLength(1);
		expect(results[0].content).toContain('0.5');
	});

	it('ignores non-opacity number tokens', () => {
		const noOpacity = {
			Spacing: {
				small: { $type: 'number', $value: 4 }
			}
		};
		expect(transformToOpacity(noOpacity, ['web'])).toHaveLength(0);
	});

	it('returns empty for no tokens', () => {
		expect(transformToOpacity({}, ['web'])).toHaveLength(0);
	});
});

describe('countOpacityTokens', () => {
	it('counts opacity tokens', () => {
		expect(countOpacityTokens(opacityExport)).toBe(4);
	});

	it('returns 0 for non-opacity tokens', () => {
		expect(countOpacityTokens({ Spacing: { a: { $type: 'number', $value: 4 } } })).toBe(0);
	});
});
