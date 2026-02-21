import { describe, it, expect } from 'vitest';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	isFigmaColorToken,
	figmaSegmentsToKebab,
	pathToTokenName,
	extractSortKey,
	capitalize,
	resolveColorValue,
	orderCategories,
	pathToKebab,
	pathToCamel,
	pathToPascal,
	extractNumericKey,
	collectSpacingEntries
} from './shared.js';

function colorToken(hex: string) {
	return {
		$type: 'color' as const,
		$value: {
			colorSpace: 'srgb' as const,
			components: [0.11, 0.11, 0.11] as [number, number, number],
			alpha: 1,
			hex
		}
	};
}

describe('walkColorTokens', () => {
	it('visits all color tokens', () => {
		const data = { A: { x: colorToken('#111111') }, B: colorToken('#222222') };
		const found: string[] = [];
		walkColorTokens(data, (t) => found.push(t.$value.hex));
		expect(found).toEqual(['#111111', '#222222']);
	});

	it('skips $-prefixed keys', () => {
		const data = { $meta: { nested: colorToken('#aaa') }, real: colorToken('#bbb') };
		const found: string[] = [];
		walkColorTokens(data, (t) => found.push(t.$value.hex));
		expect(found).toEqual(['#bbb']);
	});

	it('handles null/undefined gracefully', () => {
		const found: string[] = [];
		walkColorTokens(null, (t) => found.push(t.$value.hex));
		walkColorTokens(undefined, (t) => found.push(t.$value.hex));
		expect(found).toEqual([]);
	});
});

describe('walkColorTokensWithPath', () => {
	it('provides correct path', () => {
		const data = { Text: { primary: colorToken('#111') } };
		const paths: string[][] = [];
		walkColorTokensWithPath(data, (path) => paths.push(path));
		expect(paths).toEqual([['Text', 'primary']]);
	});
});

describe('getColorTokenAtPath', () => {
	it('returns token at valid path', () => {
		const data = { Text: { primary: colorToken('#111') } };
		const t = getColorTokenAtPath(data, ['Text', 'primary']);
		expect(t?.$value.hex).toBe('#111');
	});

	it('returns null for invalid path', () => {
		expect(getColorTokenAtPath({ a: 1 }, ['b'])).toBeNull();
	});

	it('returns null for non-color node', () => {
		expect(getColorTokenAtPath({ a: { $type: 'number', $value: 5 } }, ['a'])).toBeNull();
	});
});

describe('isFigmaColorToken', () => {
	it('returns true for valid color token', () => {
		expect(isFigmaColorToken(colorToken('#fff'))).toBe(true);
	});

	it('returns false for non-color', () => {
		expect(isFigmaColorToken({ $type: 'number', $value: 5 })).toBe(false);
		expect(isFigmaColorToken(null)).toBe(false);
		expect(isFigmaColorToken('string')).toBe(false);
	});
});

describe('figmaSegmentsToKebab', () => {
	it('handles PascalCase and underscores', () => {
		expect(figmaSegmentsToKebab(['Grey_Alpha', 'OtherOrange'])).toBe(
			'grey-alpha-other-orange'
		);
	});
});

describe('pathToTokenName', () => {
	it('drops Standard segments', () => {
		expect(pathToTokenName(['Stroke', 'Standard', 'strong'])).toBe('stroke-strong');
	});

	it('uses custom separator', () => {
		expect(pathToTokenName(['Text', 'primary'], '_')).toBe('text_primary');
	});
});

describe('extractSortKey', () => {
	it('extracts numeric sort key', () => {
		expect(extractSortKey('$grey-750')).toBe(750);
	});

	it('returns 0 for no numbers', () => {
		expect(extractSortKey('$no-nums')).toBe(0);
	});
});

describe('capitalize', () => {
	it('capitalizes first letter', () => {
		expect(capitalize('hello')).toBe('Hello');
	});
});

describe('resolveColorValue', () => {
	it('returns hex for opaque colors', () => {
		const token = colorToken('#1d1d1d');
		expect(resolveColorValue(token)).toBe('#1d1d1d');
	});
});

describe('orderCategories', () => {
	it('orders known categories first', () => {
		const result = orderCategories(['zebra', 'fill', 'text', 'alpha']);
		expect(result).toEqual(['fill', 'text', 'alpha', 'zebra']);
	});
});

describe('pathToKebab', () => {
	it('converts path to kebab-case', () => {
		expect(pathToKebab(['Elevation', 'Level_One'])).toBe('elevation-level-one');
	});
});

describe('pathToCamel', () => {
	it('converts path to camelCase', () => {
		expect(pathToCamel(['Elevation', 'Level_One'])).toBe('elevationLevelOne');
	});
});

describe('pathToPascal', () => {
	it('converts path to PascalCase', () => {
		expect(pathToPascal(['Elevation', 'Level_One'])).toBe('ElevationLevelOne');
	});
});

describe('extractNumericKey', () => {
	it('extracts first number', () => {
		expect(extractNumericKey('level-2')).toBe(2);
	});

	it('returns 0 for no numbers', () => {
		expect(extractNumericKey('none')).toBe(0);
	});
});

describe('collectSpacingEntries', () => {
	it('parses integer tokens into spacing entries', () => {
		const values = {
			Integer: {
				'4': { $type: 'number', $value: 4 },
				'8': { $type: 'number', $value: 8 },
				'999': { $type: 'number', $value: 999 }
			}
		};
		const entries = collectSpacingEntries(values);
		expect(entries).toHaveLength(3);
		expect(entries[0].cssVar).toBe('--spacing-4');
		expect(entries[2].cssVar).toBe('--spacing-max');
	});

	it('handles negative values', () => {
		const values = { Integer: { '-4': { $type: 'number', $value: -4 } } };
		const entries = collectSpacingEntries(values);
		expect(entries[0].cssVar).toBe('--spacing-neg-4');
	});

	it('returns empty for missing Integer section', () => {
		expect(collectSpacingEntries({})).toEqual([]);
	});

	it('skips $ prefixed keys', () => {
		const values = {
			Integer: {
				$type: 'collection',
				'4': { $type: 'number', $value: 4 }
			}
		};
		expect(collectSpacingEntries(values)).toHaveLength(1);
	});
});
