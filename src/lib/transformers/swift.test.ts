/**
 * Tests for swift.ts — modern SwiftUI / UIKit output.
 */

import { describe, it, expect } from 'vitest';
import { transformToSwift, detectSwiftConventions } from './swift.js';
import type { FigmaColorExport } from '$lib/types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function colorToken(hex: string, aliasTarget: string) {
	return {
		$type: 'color',
		$value: {
			colorSpace: 'srgb' as const,
			components: hexToComponents(hex),
			alpha: 1,
			hex
		},
		$extensions: {
			'com.figma.aliasData': {
				targetVariableId: aliasTarget,
				targetVariableName: aliasTarget,
				targetVariableSetId: 'set-1',
				targetVariableSetName: '_Primitives'
			}
		}
	};
}

function alphaColorToken(r: number, g: number, b: number, alpha: number, aliasTarget: string) {
	return {
		$type: 'color',
		$value: {
			colorSpace: 'srgb' as const,
			components: [r / 255, g / 255, b / 255] as [number, number, number],
			alpha,
			hex: ''
		},
		$extensions: {
			'com.figma.aliasData': {
				targetVariableId: aliasTarget,
				targetVariableName: aliasTarget,
				targetVariableSetId: 'set-1',
				targetVariableSetName: '_Primitives'
			}
		}
	};
}

function hexToComponents(hex: string): [number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	return [r, g, b];
}

const lightColors: FigmaColorExport = {
	Text: {
		primary: colorToken('#1d1d1d', 'Colour/Grey/750')
	},
	Fill: {
		Static: {
			white: colorToken('#ffffff', 'Colour/Grey/0')
		}
	}
};

const darkColors: FigmaColorExport = {
	Text: {
		primary: colorToken('#f5f5f5', 'Colour/Grey/50')
	},
	Fill: {
		Static: {
			white: colorToken('#ffffff', 'Colour/Grey/0')
		}
	}
};

const lightColorsAlpha: FigmaColorExport = {
	Fill: {
		overlay: alphaColorToken(29, 29, 29, 0.5, 'Colour/Grey_Alpha/750_50')
	}
};

const darkColorsAlpha: FigmaColorExport = {
	Fill: {
		overlay: alphaColorToken(29, 29, 29, 0.5, 'Colour/Grey_Alpha/750_50')
	}
};

// Sort tie-breaker: two entries in the same 'grey' family, same numeric prefix
const lightColorsWithSortTie: FigmaColorExport = {
	Text: {
		cool: colorToken('#ffffff', 'Colour/Grey/0'),
		warm: colorToken('#fafafa', 'Colour/Grey/0/Warm')
	}
};
const darkColorsWithSortTie: FigmaColorExport = {
	Text: {
		cool: colorToken('#ffffff', 'Colour/Grey/0'),
		warm: colorToken('#fafafa', 'Colour/Grey/0/Warm')
	}
};

// Dark colors with unknown primitive — exercises ?? lightPrim fallback
const darkColorsUnknownPrimitive: FigmaColorExport = {
	Text: {
		primary: colorToken('#0a0a0a', 'Colour/Blue/900')
	}
};

// Light colors with no aliasData — exercises !lightFigmaName guard
const lightColorsNoAlias: FigmaColorExport = {
	Text: {
		noAlias: {
			$type: 'color',
			$value: {
				colorSpace: 'srgb' as const,
				components: hexToComponents('#111111'),
				alpha: 1,
				hex: '#111111'
			}
			// no $extensions
		},
		primary: colorToken('#1d1d1d', 'Colour/Grey/750')
	}
};

// Dark colors with non-Colour alias — exercises ?? lightPrim fallback
const darkColorsNonColourAlias: FigmaColorExport = {
	Text: {
		primary: {
			$type: 'color',
			$value: {
				colorSpace: 'srgb' as const,
				components: hexToComponents('#f5f5f5'),
				alpha: 1,
				hex: '#f5f5f5'
			},
			$extensions: {
				'com.figma.aliasData': {
					targetVariableId: 'v-spacing',
					targetVariableName: 'Spacing/4',
					targetVariableSetId: 'set-s',
					targetVariableSetName: '_Spacing'
				}
			}
		}
	}
};

// Dark colors where the path is a non-object (exercises getTokenAtPath null return)
const darkColorsNonObjectPath: FigmaColorExport = {
	Text: 'not-an-object' as unknown as Record<string, unknown>
};

// Dark colors where path has non-color $type (exercises getTokenAtPath null for non-color)
const darkColorsNonColorAtPath: FigmaColorExport = {
	Text: {
		primary: { $type: 'string', $value: 'not-a-color' }
	}
};

// ─── detectSwiftConventions ───────────────────────────────────────────────────

describe('detectSwiftConventions', () => {
	it('returns camelCase + static let defaults with no reference', () => {
		const c = detectSwiftConventions();
		expect(c.namingCase).toBe('camel');
		expect(c.useComputedVar).toBe(false);
	});

	it('detects static var style from reference', () => {
		const ref = `
			static var textPrimary: Color { .init(...) }
			static var fillWhite: Color { .init(...) }
		`;
		const c = detectSwiftConventions(ref, false);
		expect(c.useComputedVar).toBe(true);
	});

	it('static let wins if both static let and static var present', () => {
		const ref = `
			static let primary = Color(...)
			static let secondary = Color(...)
			static var computed: Color { ... }
		`;
		const c = detectSwiftConventions(ref, false);
		expect(c.useComputedVar).toBe(false);
	});

	it('detects snake_case from reference', () => {
		const ref = `
			static let text_primary = Color(...)
			static let fill_white = Color(...)
		`;
		const c = detectSwiftConventions(ref, false);
		expect(c.namingCase).toBe('snake');
	});

	it('defaults to camelCase when no naming signals', () => {
		const ref = `// empty`;
		const c = detectSwiftConventions(ref, false);
		expect(c.namingCase).toBe('camel');
	});
});

// ─── transformToSwift ─────────────────────────────────────────────────────────

describe('transformToSwift — output structure', () => {
	it('returns filename Colors.swift, format swift, platform ios', () => {
		const r = transformToSwift(lightColors, darkColors);
		expect(r.filename).toBe('Colors.swift');
		expect(r.format).toBe('swift');
		expect(r.platform).toBe('ios');
	});

	it('includes file header and imports', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('// Colors.swift');
		expect(content).toContain('// Auto-generated from Figma Variables');
		expect(content).toContain('import SwiftUI');
		expect(content).toContain('#if canImport(UIKit)');
		expect(content).toContain('import UIKit');
		expect(content).toContain('#endif');
	});
});

describe('transformToSwift — primitives block', () => {
	it('outputs MARK - Primitives + public extension Color', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('// MARK: - Primitives');
		expect(content).toContain('public extension Color {');
	});

	it('outputs static let for each primitive', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		// grey750, grey50, grey0 are the three primitives from aliasData
		expect(content).toContain('static let grey750');
		expect(content).toContain('static let grey50');
		expect(content).toContain('static let grey0');
	});

	it('uses Color(hex:) format for opaque primitives', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toMatch(/Color\(hex: 0x[0-9A-F]{6}\)/);
	});

	it('includes private hex Color init extension with UInt64', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('private extension Color');
		expect(content).toContain('init(hex: UInt64)');
	});

	it('uses 8-digit hex for alpha primitives (no separate alpha param)', () => {
		const { content } = transformToSwift(lightColorsAlpha, darkColorsAlpha);
		// 50% alpha on rgb(29,29,29) → 0x1D1D1D80 (RRGGBBAA)
		expect(content).toMatch(/Color\(hex: 0x[0-9A-F]{8}\)/);
		expect(content).not.toContain('alpha:');
	});

	it('sorts primitives by sort key within family', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		const idx0 = content.indexOf('grey0');
		const idx50 = content.indexOf('grey50');
		const idx750 = content.indexOf('grey750');
		expect(idx0).toBeLessThan(idx50);
		expect(idx50).toBeLessThan(idx750);
	});

	it('uses localeCompare tie-breaker when sortKeys are equal', () => {
		const { content } = transformToSwift(lightColorsWithSortTie, darkColorsWithSortTie);
		// grey0 should appear before grey0Warm (locale sort)
		const idx0 = content.indexOf('grey0 ');
		const idxWarm = content.indexOf('grey0Warm');
		expect(idx0).toBeLessThan(idxWarm);
	});
});

describe('transformToSwift — semantic block', () => {
	it('outputs UIColor dynamic provider for light/dark tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('UIColor { trait in');
		expect(content).toContain('trait.userInterfaceStyle == .dark');
		expect(content).toContain('UIColor(Color.grey50)');
		expect(content).toContain('UIColor(Color.grey750)');
	});

	it('outputs static UIColor for Static tokens (no trait)', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		// Fill/Static/white is in "Static" group so should be UIColor(Color.grey0)
		expect(content).toContain('UIColor(Color.grey0)');
	});

	it('outputs Color(light:dark:) for SwiftUI semantic tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('Color(light: .grey750, dark: .grey50)');
	});

	it('outputs Color.primitiveName for static SwiftUI semantic tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('Color.grey0');
	});

	it('falls back to lightPrim when dark has unknown primitive', () => {
		const { content } = transformToSwift(lightColors, darkColorsUnknownPrimitive);
		// dark references Colour/Blue/900 which is not in primitive map → fallback
		expect(content).toContain('UIColor(Color.grey750)'); // light side still used
	});

	it('skips semantic tokens with no aliasData', () => {
		const { content } = transformToSwift(lightColorsNoAlias, darkColors);
		// noAlias token should NOT appear as a semantic entry
		expect(content).not.toContain('noAlias');
	});

	it('falls back to lightPrim when dark aliases a non-Colour path', () => {
		const { content } = transformToSwift(lightColors, darkColorsNonColourAlias);
		// Both light and dark should reference grey750
		expect(content).toContain('UIColor(Color.grey750)');
	});

	it('handles non-object intermediate path in dark (getTokenAtPath returns null)', () => {
		const { content } = transformToSwift(lightColors, darkColorsNonObjectPath);
		// Should still generate output (dark path null → falls back to light)
		expect(content).toContain('UIColor(Color.grey750)');
	});

	it('handles non-color node at exact path in dark', () => {
		const { content } = transformToSwift(lightColors, darkColorsNonColorAtPath);
		// dark node is string, not color → falls back to light primitive
		expect(content).toContain('UIColor(Color.grey750)');
	});
});

describe('transformToSwift — convention: snake_case', () => {
	it('generates snake_case property names when reference uses snake_case', () => {
		const ref = `static let text_primary = Color(...)\nstatic let fill_white = Color(...)`;
		const { content } = transformToSwift(lightColors, darkColors, ref, false);
		expect(content).toContain('static let grey_750');
		expect(content).toContain('static let text_primary');
	});
});

describe('transformToSwift — convention: static var', () => {
	it('uses static var when reference uses computed var style', () => {
		const ref = `static var textPrimary: Color { Color(UIColor.textPrimary) }`;
		const { content } = transformToSwift(lightColors, darkColors, ref, false);
		expect(content).toContain('static var ');
	});
});

describe('transformToSwift — digit-leading family name (topSegment fallback)', () => {
	it('handles a primitive whose top segment starts with a digit', () => {
		// Colour/750/test → topSegment = '750', parts = ['750'], digits trigger break immediately
		// so familyParts is empty → || topSegment covers the fallback
		const light: FigmaColorExport = {
			Text: { primary: colorToken('#1d1d1d', 'Colour/750/Cool') }
		};
		const dark: FigmaColorExport = {
			Text: { primary: colorToken('#f5f5f5', 'Colour/750/Cool') }
		};
		const { content } = transformToSwift(light, dark);
		// should still produce some output without crashing
		expect(content).toContain('Colors.swift');
	});
});

describe('transformToSwift — no semantic tokens', () => {
	it('omits UIColor semantic block when there are no semantic tokens', () => {
		const { content } = transformToSwift({}, {});
		// The #if canImport(UIKit) header is present but the UIColor semantic extension is not
		expect(content).not.toContain('UIColor {');
		expect(content).not.toContain('MARK: - Semantic Colors');
	});
});

describe('transformToSwift — Standard path stripping', () => {
	it('strips Standard from token name', () => {
		const light: FigmaColorExport = {
			Fill: { Standard: { white: colorToken('#ffffff', 'Colour/Grey/0') } }
		};
		const dark: FigmaColorExport = {
			Fill: { Standard: { white: colorToken('#ffffff', 'Colour/Grey/0') } }
		};
		const { content } = transformToSwift(light, dark);
		// The semantic name should be "fillWhite" not "fillStandardWhite"
		expect(content).toContain('fillWhite');
		expect(content).not.toContain('fillStandard');
	});
});
