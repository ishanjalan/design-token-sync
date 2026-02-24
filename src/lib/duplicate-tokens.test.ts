import { describe, it, expect } from 'vitest';
import { detectDuplicateValues } from './duplicate-tokens.js';

describe('detectDuplicateValues', () => {
	it('finds tokens with the same resolved value', () => {
		const tokens = {
			brand: {
				primary: { $type: 'color', $value: { hex: '#0066FF' } },
				accent: { $type: 'color', $value: { hex: '#0066FF' } }
			},
			text: {
				main: { $type: 'color', $value: { hex: '#1d1d1d' } }
			}
		};
		const groups = detectDuplicateValues(tokens);
		expect(groups.length).toBe(1);
		expect(groups[0].tokens).toContain('brand/primary');
		expect(groups[0].tokens).toContain('brand/accent');
	});

	it('returns empty when no duplicates', () => {
		const tokens = {
			a: { $type: 'color', $value: { hex: '#111111' } },
			b: { $type: 'color', $value: { hex: '#222222' } }
		};
		const groups = detectDuplicateValues(tokens);
		expect(groups.length).toBe(0);
	});

	it('handles empty tokens', () => {
		expect(detectDuplicateValues({})).toEqual([]);
	});
});
