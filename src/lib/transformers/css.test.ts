import { describe, it, expect } from 'vitest';
import { transformToCSS } from './css.js';
import { lightColors, darkColors } from './fixtures.js';
import type { DetectedConventions } from '$lib/types.js';

const defaultConventions: DetectedConventions = {
	scssPrefix: '$',
	scssSeparator: 'hyphen',
	tsPrefix: 'export const ',
	tsNamingCase: 'screaming_snake',
	importStyle: 'use',
	importSuffix: '',
	scssColorStructure: 'modern',
	hasTypeAnnotations: false
};

describe('transformToCSS', () => {
	it('generates primitives.css and colors.css', () => {
		const results = transformToCSS(lightColors, darkColors, defaultConventions);
		expect(results.length).toBeGreaterThanOrEqual(2);

		const primitives = results.find((r) => r.filename === 'primitives.css');
		expect(primitives).toBeDefined();
		expect(primitives!.format).toBe('css');
		expect(primitives!.platform).toBe('web');
		expect(primitives!.content).toContain(':root {');
		expect(primitives!.content).toContain('--grey-750');

		const colors = results.find((r) => r.filename === 'colors.css');
		expect(colors).toBeDefined();
		expect(colors!.content).toContain('color-scheme: light dark');
		expect(colors!.content).toContain('--text-primary');
		expect(colors!.content).toContain('light-dark(');
	});

	it('generates spacing.css when values are provided', () => {
		const values = {
			Integer: {
				'4': { $type: 'number', $value: 4 },
				'8': { $type: 'number', $value: 8 },
				'16': { $type: 'number', $value: 16 }
			}
		};
		const results = transformToCSS(lightColors, darkColors, defaultConventions, values);
		const spacing = results.find((r) => r.filename === 'spacing.css');
		expect(spacing).toBeDefined();
		expect(spacing!.content).toContain('--spacing-4: 4px');
		expect(spacing!.content).toContain('--spacing-16: 16px');
	});

	it('handles static tokens without light-dark()', () => {
		const lightStatic = {
			Fill: {
				Static: {
					white: {
						$type: 'color',
						$value: {
							colorSpace: 'srgb',
							components: [1, 1, 1],
							alpha: 1,
							hex: '#ffffff'
						},
						$extensions: {
							'com.figma.aliasData': {
								targetVariableId: 'v1',
								targetVariableName: 'Colour/Grey/0',
								targetVariableSetId: 's1',
								targetVariableSetName: '_Primitives'
							}
						}
					}
				}
			}
		};
		const darkStatic = { ...lightStatic };
		const results = transformToCSS(lightStatic, darkStatic, defaultConventions);
		const colors = results.find((r) => r.filename === 'colors.css');
		expect(colors).toBeDefined();
		const staticLine = colors!.content
			.split('\n')
			.find((l: string) => l.includes('--fill-static-white'));
		expect(staticLine).toBeDefined();
		expect(staticLine).not.toContain('light-dark');
	});

	it('returns empty primitives for empty exports', () => {
		const results = transformToCSS({}, {}, defaultConventions);
		expect(results).toHaveLength(2);
	});
});
