import { describe, it, expect } from 'vitest';
import { transformToShadows, countShadowTokens } from './shadow.js';

const shadowToken = (offsetX: number, offsetY: number, blur: number, spread: number, hex: string) => ({
	$type: 'shadow',
	$value: {
		color: {
			colorSpace: 'srgb',
			components: [
				parseInt(hex.slice(1, 3), 16) / 255,
				parseInt(hex.slice(3, 5), 16) / 255,
				parseInt(hex.slice(5, 7), 16) / 255
			],
			alpha: 1,
			hex
		},
		offsetX,
		offsetY,
		blur,
		spread
	}
});

const shadowExport = {
	Elevation: {
		small: shadowToken(0, 1, 3, 0, '#000000'),
		medium: shadowToken(0, 4, 8, -1, '#000000'),
		large: shadowToken(0, 10, 24, -4, '#000000')
	}
};

describe('transformToShadows', () => {
	it('generates SCSS for web platform', () => {
		const results = transformToShadows(shadowExport, ['web']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Shadows.scss');
		expect(results[0].platform).toBe('web');
		expect(results[0].content).toContain('$shadow-elevation-small');
		expect(results[0].content).toContain('$shadow-elevation-large');
		expect(results[0].content).toContain(':root {');
		expect(results[0].content).toContain('--shadow-elevation-small');
	});

	it('generates Swift for ios platform', () => {
		const results = transformToShadows(shadowExport, ['ios']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Shadows.swift');
		expect(results[0].platform).toBe('ios');
		expect(results[0].content).toContain('ShadowToken');
		expect(results[0].content).toContain('elevationSmall');
	});

	it('generates Kotlin for android platform', () => {
		const results = transformToShadows(shadowExport, ['android']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Shadows.kt');
		expect(results[0].platform).toBe('android');
		expect(results[0].content).toContain('ShadowSpec');
		expect(results[0].content).toContain('ElevationSmall');
	});

	it('generates all platforms', () => {
		const results = transformToShadows(shadowExport, ['web', 'ios', 'android']);
		expect(results).toHaveLength(3);
	});

	it('returns empty for no shadow tokens', () => {
		expect(transformToShadows({}, ['web'])).toHaveLength(0);
		expect(transformToShadows({ Colour: { a: { $type: 'color', $value: {} } } }, ['web'])).toHaveLength(0);
	});
});

describe('countShadowTokens', () => {
	it('counts shadow tokens', () => {
		expect(countShadowTokens(shadowExport)).toBe(3);
	});

	it('returns 0 for empty export', () => {
		expect(countShadowTokens({})).toBe(0);
	});
});
