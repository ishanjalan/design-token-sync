import { describe, it, expect } from 'vitest';
import {
	checkContrast,
	detectPairings,
	validatePalette,
	extractSemanticColors
} from './contrast.js';
import type { TokenColorMap, ContrastPair } from './contrast.js';

describe('checkContrast', () => {
	it('returns high Lc for black on white', () => {
		const lc = checkContrast('#000000', '#ffffff');
		expect(Math.abs(lc)).toBeGreaterThan(100);
	});

	it('returns low Lc for similar colors', () => {
		const lc = checkContrast('#777777', '#888888');
		expect(Math.abs(lc)).toBeLessThan(10);
	});

	it('returns 0 for identical colors', () => {
		const lc = checkContrast('#cccccc', '#cccccc');
		expect(lc).toBe(0);
	});

	it('handles dark on light (positive Lc)', () => {
		const lc = checkContrast('#1d1d1d', '#f5f5f5');
		expect(Math.abs(lc)).toBeGreaterThan(90);
	});
});

describe('detectPairings', () => {
	it('auto-pairs text/icon tokens with background tokens', () => {
		const tokens: TokenColorMap = {
			'text-primary': '#000000',
			'icon-default': '#333333',
			'background-default': '#ffffff',
			'fill-primary': '#0066ff'
		};
		const pairs = detectPairings(tokens);
		expect(pairs).toHaveLength(2);
		expect(pairs[0].fgName).toBe('text-primary');
		expect(pairs[0].bgName).toBe('background-default');
		expect(pairs[1].fgName).toBe('icon-default');
	});

	it('uses manual pairings when provided', () => {
		const tokens: TokenColorMap = {
			'text-primary': '#000000',
			'background-default': '#ffffff',
			'fill-brand': '#0066ff'
		};
		const pairs = detectPairings(tokens, {
			'fill-brand': 'background-default'
		});
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fgName).toBe('fill-brand');
	});

	it('returns empty when no matching tokens', () => {
		const tokens: TokenColorMap = { 'fill-primary': '#000000' };
		expect(detectPairings(tokens)).toHaveLength(0);
	});
});

describe('validatePalette', () => {
	it('classifies high-contrast pair as pass', () => {
		const pairs: ContrastPair[] = [
			{ fgName: 'text', bgName: 'bg', fgHex: '#000000', bgHex: '#ffffff' }
		];
		const result = validatePalette(pairs);
		expect(result.total).toBe(1);
		expect(result.pass).toBe(1);
		expect(result.fail).toBe(0);
		expect(result.results[0].level).toBe('pass');
	});

	it('classifies low-contrast pair as fail', () => {
		const pairs: ContrastPair[] = [
			{ fgName: 'text', bgName: 'bg', fgHex: '#888888', bgHex: '#999999' }
		];
		const result = validatePalette(pairs);
		expect(result.fail).toBe(1);
		expect(result.results[0].level).toBe('fail');
	});

	it('returns empty summary for no pairs', () => {
		const result = validatePalette([]);
		expect(result.total).toBe(0);
		expect(result.pass).toBe(0);
	});
});

describe('extractSemanticColors', () => {
	it('extracts color tokens from Figma light export', () => {
		const lightColors = {
			Text: {
				primary: {
					$type: 'color',
					$value: { colorSpace: 'srgb', components: [0.11, 0.11, 0.11], alpha: 1, hex: '#1d1d1d' }
				}
			},
			Background: {
				'default': {
					$type: 'color',
					$value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' }
				}
			}
		};
		const map = extractSemanticColors(lightColors);
		expect(map['text-primary']).toBe('#1d1d1d');
		expect(map['background-default']).toBe('#ffffff');
	});
});
