import { describe, it, expect } from 'vitest';
import { transformToSpacing } from './spacing.js';
import type { DetectedConventions } from '$lib/types.js';

const defaultConventions: DetectedConventions = {
	scssPrefix: '$',
	scssSeparator: 'hyphen',
	tsPrefix: 'export const ',
	tsNamingCase: 'screaming_snake',
	importStyle: 'use',
	hasTypeAnnotations: false
};

function makeValuesExport(entries: Record<string, number>): Record<string, unknown> {
	const Integer: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(entries)) {
		Integer[key] = { $type: 'number', $value: value };
	}
	return { Integer };
}

describe('transformToSpacing', () => {
	it('returns empty array when Integer section is missing', () => {
		expect(transformToSpacing({}, defaultConventions)).toEqual([]);
	});

	it('returns empty array when Integer section has no valid tokens', () => {
		expect(transformToSpacing({ Integer: {} }, defaultConventions)).toEqual([]);
	});

	it('generates both Spacing.scss and Spacing.ts', () => {
		const values = makeValuesExport({ '4': 4, '8': 8 });
		const results = transformToSpacing(values, defaultConventions);
		expect(results).toHaveLength(2);
		expect(results[0].filename).toBe('Spacing.scss');
		expect(results[1].filename).toBe('Spacing.ts');
	});

	it('generates correct SCSS variables for positive values', () => {
		const values = makeValuesExport({ '4': 4, '8': 8 });
		const [scss] = transformToSpacing(values, defaultConventions);
		expect(scss.content).toContain('$spacing-4: 4px;');
		expect(scss.content).toContain('$spacing-8: 8px;');
	});

	it('generates correct SCSS variables for negative values', () => {
		const values = makeValuesExport({ '-4': -4 });
		const [scss] = transformToSpacing(values, defaultConventions);
		expect(scss.content).toContain('$spacing-neg-4: -4px;');
	});

	it('names the 999 value as $spacing-max', () => {
		const values = makeValuesExport({ '999': 999 });
		const [scss] = transformToSpacing(values, defaultConventions);
		expect(scss.content).toContain('$spacing-max: 999px;');
	});

	it('includes a :root block with CSS custom properties in SCSS output', () => {
		const values = makeValuesExport({ '4': 4 });
		const [scss] = transformToSpacing(values, defaultConventions);
		expect(scss.content).toContain(':root {');
		expect(scss.content).toContain('--spacing-4: #{$spacing-4};');
	});

	it('generates correct TS exports (screaming_snake)', () => {
		const values = makeValuesExport({ '4': 4, '16': 16 });
		const [, ts] = transformToSpacing(values, defaultConventions);
		expect(ts.content).toContain("export const SPACING_4 = '4px' as const;");
		expect(ts.content).toContain("export const SPACING_16 = '16px' as const;");
	});

	it('generates correct TS exports for negative values', () => {
		const values = makeValuesExport({ '-4': -4 });
		const [, ts] = transformToSpacing(values, defaultConventions);
		expect(ts.content).toContain("export const SPACING_NEG_4 = '-4px' as const;");
	});

	it('sorts entries numerically', () => {
		const values = makeValuesExport({ '16': 16, '4': 4, '8': 8 });
		const [scss] = transformToSpacing(values, defaultConventions);
		const lines = scss.content.split('\n').filter((l) => l.startsWith('$spacing-'));
		const indices = ['$spacing-4', '$spacing-8', '$spacing-16'].map((v) =>
			lines.findIndex((l) => l.startsWith(v))
		);
		expect(indices[0]).toBeLessThan(indices[1]);
		expect(indices[1]).toBeLessThan(indices[2]);
	});

	it('skips keys that start with $', () => {
		const values = {
			Integer: {
				$metadata: { order: [] },
				'4': { $type: 'number', $value: 4 }
			}
		};
		const results = transformToSpacing(values, defaultConventions);
		expect(results[0].content).not.toContain('$metadata');
	});

	it('skips non-object token values', () => {
		const values = {
			Integer: {
				bad: 'not-an-object',
				'4': { $type: 'number', $value: 4 }
			}
		};
		const results = transformToSpacing(values, defaultConventions);
		expect(results[0].content).not.toContain('bad');
		expect(results[0].content).toContain('$spacing-4');
	});

	it('skips tokens with wrong $type', () => {
		const values = {
			Integer: {
				wrongType: { $type: 'color', $value: 8 },
				'4': { $type: 'number', $value: 4 }
			}
		};
		const results = transformToSpacing(values, defaultConventions);
		expect(results[0].content).not.toContain('wrongType');
	});

	it('skips tokens where $value is not a number', () => {
		const values = {
			Integer: {
				stringVal: { $type: 'number', $value: '4px' },
				'4': { $type: 'number', $value: 4 }
			}
		};
		const results = transformToSpacing(values, defaultConventions);
		expect(results[0].content).not.toContain('stringVal');
	});

	it('respects camelCase naming convention', () => {
		const conventions: DetectedConventions = { ...defaultConventions, tsNamingCase: 'camel' };
		const values = makeValuesExport({ '4': 4 });
		const [, ts] = transformToSpacing(values, conventions);
		expect(ts.content).toContain("export const spacing4 = '4px' as const;");
	});

	it('formats output as scss and typescript', () => {
		const values = makeValuesExport({ '4': 4 });
		const [scss, ts] = transformToSpacing(values, defaultConventions);
		expect(scss.format).toBe('scss');
		expect(ts.format).toBe('typescript');
	});
});
