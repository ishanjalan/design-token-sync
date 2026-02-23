/**
 * Tests for swift.ts — pure SwiftUI Color output.
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

	it('detects enum container style, string hex, flat Light/Dark, and imports', () => {
		const ref = `import Foundation
import SwiftUI
import UIKit

fileprivate enum primitiveColorCode {
    static let red50 = "#FDE6E5"
    static let red100 = "#FBC8C6"
}

enum ColorCodes {
    static let neutralPrimaryTextLight = "#1D1D1D"
    static let neutralPrimaryTextDark = "#FCFCFC"
}
`;
		const c = detectSwiftConventions(ref, false);
		expect(c.indent).toBe('    ');
		expect(c.primitiveFormat).toBe('stringHex');
		expect(c.containerStyle).toBe('enum');
		expect(c.primitiveEnumName).toBe('primitiveColorCode');
		expect(c.primitiveAccess).toBe('fileprivate');
		expect(c.semanticFormat).toBe('flatLightDark');
		expect(c.semanticEnumName).toBe('ColorCodes');
		expect(c.apiEnumName).toBe('ColorStyle');
		expect(c.imports).toEqual(['Foundation', 'SwiftUI', 'UIKit']);
	});

	it('detects apiEnumName from the third enum in reference', () => {
		const ref = `import Foundation
import SwiftUI
import UIKit

fileprivate enum primitiveColorCode {
    static let red50 = "#FDE6E5"
}

enum ColorCodes {
    static let textLight = "#1D1D1D"
    static let textDark = "#FCFCFC"
}

public enum AppColorStyle {
    public static var text: UIColor = color(ColorCodes.textLight)
}
`;
		const c = detectSwiftConventions(ref, false);
		expect(c.apiEnumName).toBe('AppColorStyle');
	});

	it('returns best-practice defaults when bestPractices is true even with reference', () => {
		const ref = `fileprivate enum primitiveColorCode { static let x = "#FFF" }`;
		const c = detectSwiftConventions(ref, true);
		expect(c.containerStyle).toBe('extension');
		expect(c.primitiveFormat).toBe('colorHex');
		expect(c.semanticFormat).toBe('dynamic');
	});

	it('detects extension style when reference uses extension Color', () => {
		const ref = `import SwiftUI\npublic extension Color {\n  static let red = Color(hex: 0xFF0000)\n}`;
		const c = detectSwiftConventions(ref, false);
		expect(c.containerStyle).toBe('extension');
		expect(c.primitiveFormat).toBe('colorHex');
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

	it('includes file header and SwiftUI import only', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('// Colors.swift');
		expect(content).toContain('// Auto-generated from Figma Variables');
		expect(content).toContain('import SwiftUI');
		expect(content).not.toMatch(/^import UIKit$/m);
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
	it('generates private Color(light:dark:) initializer for dynamic tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('init(light: Color, dark: Color)');
		expect(content).toContain('// MARK: - Dynamic Color Init');
	});

	it('outputs Color(light:dark:) for dynamic semantic tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('Color(light: .grey750, dark: .grey50)');
	});

	it('outputs Color.primitiveName for static semantic tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).toContain('Color.grey0');
	});

	it('does not expose UIColor in public extensions', () => {
		const { content } = transformToSwift(lightColors, darkColors);
		expect(content).not.toContain('public extension UIColor');
	});

	it('falls back to lightPrim when dark has unknown primitive', () => {
		const { content } = transformToSwift(lightColors, darkColorsUnknownPrimitive);
		expect(content).toContain('.grey750');
	});

	it('skips semantic tokens with no aliasData', () => {
		const { content } = transformToSwift(lightColorsNoAlias, darkColors);
		expect(content).not.toContain('noAlias');
	});

	it('falls back to lightPrim when dark aliases a non-Colour path', () => {
		const { content } = transformToSwift(lightColors, darkColorsNonColourAlias);
		expect(content).toContain('light: .grey750, dark: .grey750');
	});

	it('handles non-object intermediate path in dark (getTokenAtPath returns null)', () => {
		const { content } = transformToSwift(lightColors, darkColorsNonObjectPath);
		expect(content).toContain('light: .grey750, dark: .grey750');
	});

	it('handles non-color node at exact path in dark', () => {
		const { content } = transformToSwift(lightColors, darkColorsNonColorAtPath);
		expect(content).toContain('light: .grey750, dark: .grey750');
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
	it('omits semantic block and dynamic init when there are no semantic tokens', () => {
		const { content } = transformToSwift({}, {});
		expect(content).not.toContain('MARK: - Semantic Colors');
		expect(content).not.toContain('MARK: - Dynamic Color Init');
	});
});

describe('transformToSwift — match existing (enum + stringHex + flatLightDark)', () => {
	const enumRef = `import Foundation
import SwiftUI
import UIKit

fileprivate enum primitiveColorCode {
    static let red50 = "#FDE6E5"
    static let red100 = "#FBC8C6"
}

enum ColorCodes {
    static let neutralPrimaryTextLight = "#1D1D1D"
    static let neutralPrimaryTextDark = "#FCFCFC"
}
`;

	it('emits fileprivate enum container for primitives', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toContain('fileprivate enum primitiveColorCode {');
	});

	it('uses string hex format for primitive values', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toMatch(/static let grey\d+ = "#[0-9A-F]{6}"/);
	});

	it('emits semantic enum with flat Light/Dark suffixed properties', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toContain('enum ColorCodes {');
		expect(content).toContain('textPrimaryLight = "#');
		expect(content).toContain('textPrimaryDark = "#');
	});

	it('uses 4-space indentation from reference', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toMatch(/^ {4}static let/m);
	});

	it('includes all three imports from reference', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toContain('import Foundation');
		expect(content).toContain('import SwiftUI');
		expect(content).toContain('import UIKit');
	});

	it('omits Color(hex:) and Color(light:dark:) helper extensions', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).not.toContain('init(hex: UInt64)');
		expect(content).not.toContain('init(light: Color, dark: Color)');
	});

	it('emits single property (no Light/Dark suffix) for static semantic tokens', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toMatch(/static let fillStaticWhite = "#FFFFFF"/);
	});

	it('generates ColorStyle enum with suiColor helper (Tier 4)', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toContain('public enum ColorStyle {');
		expect(content).toContain('static func suiColor(');
		expect(content).toContain('colorFromHex');
	});

	it('generates SwiftUI Color API properties referencing primitiveColorCode', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toContain('public extension ColorStyle {');
		expect(content).toMatch(/static var textPrimary: Color = suiColor\(primitiveColorCode\.grey750, primitiveColorCode\.grey50\)/);
	});

	it('uses static suiColor with same primitive for static tokens in Tier 4', () => {
		const { content } = transformToSwift(lightColors, darkColors, enumRef, false);
		expect(content).toMatch(/static var fillStaticWhite: Color = suiColor\(primitiveColorCode\.grey0, primitiveColorCode\.grey0\)/);
	});

	it('detects custom apiEnumName from reference with 3 enums', () => {
		const ref3 = `import Foundation
import SwiftUI
import UIKit

fileprivate enum primitiveColorCode {
    static let red50 = "#FDE6E5"
}

enum ColorCodes {
    static let textLight = "#1D1D1D"
    static let textDark = "#FCFCFC"
}

public enum MyColors {
    public static var text: UIColor = color(ColorCodes.textLight)
}
`;
		const { content } = transformToSwift(lightColors, darkColors, ref3, false);
		expect(content).toContain('public enum MyColors {');
		expect(content).toContain('public extension MyColors {');
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
