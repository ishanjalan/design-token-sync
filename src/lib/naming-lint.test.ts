import { describe, it, expect } from 'vitest';
import { lintTokenNames, lintSummary, WEB_RULES, IOS_RULES } from './naming-lint.js';
import type { NamingRule } from './naming-lint.js';

const sampleTokens = {
	Text: {
		primary: {
			$type: 'color',
			$value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#000000' }
		}
	},
	Background: {
		'default': {
			$type: 'color',
			$value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' }
		}
	}
};

describe('lintTokenNames', () => {
	it('passes kebab-case names with web rules', () => {
		const results = lintTokenNames(sampleTokens, WEB_RULES);
		const caseErrors = results.filter((r) => r.rule === 'web-kebab');
		expect(caseErrors).toHaveLength(0);
	});

	it('passes with default ios rules (camelCase token path becomes kebab)', () => {
		const results = lintTokenNames(sampleTokens, IOS_RULES);
		// "text-primary" is kebab, not camelCase — should flag
		const caseErrors = results.filter((r) => r.rule === 'ios-camel');
		expect(caseErrors.length).toBeGreaterThan(0);
	});

	it('flags tokens exceeding max depth', () => {
		const deepTokens = {
			A: { B: { C: { D: { E: { F: {
				$type: 'color',
				$value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#000000' }
			} } } } } }
		};
		const rules: NamingRule[] = [{ id: 'depth', maxDepth: 4, severity: 'warning' }];
		const results = lintTokenNames(deepTokens, rules);
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain('exceeds max depth');
	});

	it('flags tokens missing required prefix', () => {
		const rules: NamingRule[] = [{ id: 'prefix', prefix: 'color-', severity: 'error' }];
		const results = lintTokenNames(sampleTokens, rules);
		expect(results.length).toBe(2);
		expect(results[0].message).toContain('missing required prefix');
	});

	it('flags tokens not matching pattern', () => {
		const rules: NamingRule[] = [{ id: 'pattern', pattern: /^text-/, severity: 'warning' }];
		const results = lintTokenNames(sampleTokens, rules);
		const failures = results.filter((r) => r.token !== 'text-primary');
		expect(failures).toHaveLength(1);
	});

	it('returns empty for no tokens', () => {
		const results = lintTokenNames({}, WEB_RULES);
		expect(results).toHaveLength(0);
	});
});

describe('lintSummary', () => {
	it('counts errors and warnings', () => {
		const results = [
			{ token: 'a', rule: 'r1', message: 'msg', severity: 'error' as const },
			{ token: 'b', rule: 'r2', message: 'msg', severity: 'warning' as const },
			{ token: 'c', rule: 'r3', message: 'msg', severity: 'error' as const },
		];
		const summary = lintSummary(results);
		expect(summary.errors).toBe(2);
		expect(summary.warnings).toBe(1);
	});
});
