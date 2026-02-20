import { describe, it, expect } from 'vitest';
import { generateTokenDocs, extractDocEntries } from './docs-generator.js';

const sampleTokens = {
	Text: {
		primary: {
			$type: 'color',
			$value: { colorSpace: 'srgb', components: [0.11, 0.11, 0.11], alpha: 1, hex: '#1d1d1d' },
			$extensions: {
				'com.figma.aliasData': {
					targetVariableId: 'v1',
					targetVariableName: 'Colour/Grey/750',
					targetVariableSetId: 's1',
					targetVariableSetName: 'Colors'
				}
			}
		}
	},
	Elevation: {
		sm: {
			$type: 'shadow',
			$value: {
				color: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.1, hex: '#000000' },
				offsetX: 0,
				offsetY: 2,
				blur: 4,
				spread: 0
			}
		}
	},
	spacing: {
		'8': {
			$type: 'number',
			$value: 8
		}
	}
};

describe('extractDocEntries', () => {
	it('extracts entries from token export', () => {
		const entries = extractDocEntries(sampleTokens);
		expect(entries.length).toBe(3);
	});

	it('captures alias info', () => {
		const entries = extractDocEntries(sampleTokens);
		const textEntry = entries.find((e) => e.name === 'Text/primary');
		expect(textEntry?.alias).toBe('Colour/Grey/750');
	});

	it('captures correct types', () => {
		const entries = extractDocEntries(sampleTokens);
		const types = entries.map((e) => e.type);
		expect(types).toContain('color');
		expect(types).toContain('shadow');
		expect(types).toContain('number');
	});
});

describe('generateTokenDocs', () => {
	it('produces valid JSON output', () => {
		const { jsonOutput } = generateTokenDocs(sampleTokens);
		const parsed = JSON.parse(jsonOutput);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBe(3);
	});

	it('produces HTML with correct structure', () => {
		const { htmlOutput } = generateTokenDocs(sampleTokens);
		expect(htmlOutput).toContain('<!DOCTYPE html>');
		expect(htmlOutput).toContain('Tokensmith');
		expect(htmlOutput).toContain('3 tokens');
	});

	it('HTML includes color swatch', () => {
		const { htmlOutput } = generateTokenDocs(sampleTokens);
		expect(htmlOutput).toContain('class="swatch"');
		expect(htmlOutput).toContain('#1d1d1d');
	});

	it('HTML includes alias reference', () => {
		const { htmlOutput } = generateTokenDocs(sampleTokens);
		expect(htmlOutput).toContain('class="alias"');
		expect(htmlOutput).toContain('Colour/Grey/750');
	});

	it('handles empty token export', () => {
		const { jsonOutput, htmlOutput } = generateTokenDocs({});
		expect(JSON.parse(jsonOutput)).toEqual([]);
		expect(htmlOutput).toContain('0 tokens');
	});
});
