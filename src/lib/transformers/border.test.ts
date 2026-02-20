import { describe, it, expect } from 'vitest';
import { transformToBorders, countBorderTokens } from './border.js';

const borderToken = (width: number, style: string, hex: string) => ({
	$type: 'border',
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
		width,
		style
	}
});

const borderExport = {
	Border: {
		thin: borderToken(1, 'solid', '#e0e0e0'),
		medium: borderToken(2, 'solid', '#cccccc'),
		thick: borderToken(4, 'dashed', '#999999')
	}
};

describe('transformToBorders', () => {
	it('generates SCSS for web platform', () => {
		const results = transformToBorders(borderExport, ['web']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Borders.scss');
		expect(results[0].platform).toBe('web');
		expect(results[0].content).toContain('$border-border-thin');
		expect(results[0].content).toContain('1px solid');
		expect(results[0].content).toContain('4px dashed');
	});

	it('generates Swift for ios platform', () => {
		const results = transformToBorders(borderExport, ['ios']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Borders.swift');
		expect(results[0].content).toContain('BorderToken');
		expect(results[0].content).toContain('borderThin');
	});

	it('generates Kotlin for android platform', () => {
		const results = transformToBorders(borderExport, ['android']);
		expect(results).toHaveLength(1);
		expect(results[0].filename).toBe('Borders.kt');
		expect(results[0].content).toContain('BorderStroke');
		expect(results[0].content).toContain('borderThin');
	});

	it('returns empty for no border tokens', () => {
		expect(transformToBorders({}, ['web'])).toHaveLength(0);
	});
});

describe('countBorderTokens', () => {
	it('counts border tokens', () => {
		expect(countBorderTokens(borderExport)).toBe(3);
	});
});
