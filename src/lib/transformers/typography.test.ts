import { describe, it, expect } from 'vitest';
import {
	detectTypographyConventions,
	transformToTypography
} from './typography.js';
import type { KotlinTypographyScope } from './typography-kotlin.js';

// ─── Reference file fixtures (based on user's web team files) ────────────────

const REF_SCSS = `// Font weights
$font-weight-400: 400;
$font-weight-500: 500;
$font-weight-700: 700;

// Font sizes, line heights, and letter spacings
$font-xxl-size: 2.8125rem;
$font-xxl-height: 3.25rem;
$font-xxl-spacing: -1px;

$font-m1-size: 1rem;
$font-m1-height: 1.5rem;
$font-m1-spacing: -0.18px;

// Typography mixins for easy usage
@mixin font-extra-large-title {
  font-size: $font-xxl-size;
  line-height: $font-xxl-height;
  letter-spacing: $font-xxl-spacing;
}

@mixin font-body {
  font-size: $font-m1-size;
  line-height: $font-m1-height;
  letter-spacing: $font-m1-spacing;
}
`;

const REF_TS = `export const FONT_WEIGHT_400 = 400;
export const FONT_WEIGHT_500 = 500;
export const FONT_WEIGHT_700 = 700;

const FONT_XXL = {
  fontSize: '2.8125rem',
  lineHeight: '3.25rem',
  letterSpacing: '-1px',
};
const FONT_M1 = {
  fontSize: '1rem',
  lineHeight: '1.5rem',
  letterSpacing: '-0.18px',
};

export const FONT_EXTRA_LARGE_TITLE = FONT_XXL;
export const FONT_BODY = FONT_M1;
`;

const SAMPLE_TYPOGRAPHY_JSON = {
	typography: {
		'droid/body/body-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'Inter',
				fontSize: 16,
				fontWeight: 400,
				lineHeight: 24,
				letterSpacing: -0.18
			}
		},
		'droid/xlarge title/xlarge title-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'Inter',
				fontSize: 44,
				fontWeight: 700,
				lineHeight: 52,
				letterSpacing: -1
			}
		}
	}
};

// ─── detectTypographyConventions ─────────────────────────────────────────────

describe('detectTypographyConventions', () => {
	it('returns best-practice defaults when no references provided', () => {
		const conv = detectTypographyConventions();
		expect(conv.scss.hasCssCustomProperties).toBe(true);
		expect(conv.scss.hasMixins).toBe(true);
		expect(conv.scss.includesFontFamily).toBe(true);
		expect(conv.ts.namingCase).toBe('camelCase');
		expect(conv.ts.hasInterface).toBe(true);
		expect(conv.ts.interfaceName).toBe('TypographyToken');
		expect(conv.ts.valueFormat).toBe('number');
		expect(conv.ts.twoTier).toBe(false);
		expect(conv.swift.architecture).toBe('struct');
		expect(conv.swift.typeName).toBe('TypographyStyle');
		expect(conv.swift.includesTracking).toBe(true);
		expect(conv.kotlin.architecture).toBe('object');
		expect(conv.kotlin.containerName).toBe('TypographyTokens');
		expect(conv.kotlin.includesM3Builder).toBe(true);
	});

	it('returns best-practice defaults when bestPractices=true even with references', () => {
		const conv = detectTypographyConventions(REF_SCSS, REF_TS, true);
		expect(conv.scss.hasCssCustomProperties).toBe(true);
		expect(conv.ts.namingCase).toBe('camelCase');
	});

	describe('SCSS convention detection', () => {
		it('detects variable prefix from reference', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.varPrefix).toBe('$font-');
		});

		it('detects no CSS custom properties', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.hasCssCustomProperties).toBe(false);
		});

		it('detects mixins are present', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.hasMixins).toBe(true);
		});

		it('detects no font-family', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.includesFontFamily).toBe(false);
		});

		it('detects font weight variables', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.includesFontWeight).toBe(true);
		});

		it('detects rem size units', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.sizeUnit).toBe('rem');
		});

		it('detects rem height units', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.heightUnit).toBe('rem');
		});

		it('detects px spacing units', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.spacingUnit).toBe('px');
		});

		it('detects two-tier structure', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.twoTier).toBe(true);
		});
	});

	describe('TS convention detection', () => {
		it('detects SCREAMING_SNAKE naming', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.namingCase).toBe('SCREAMING_SNAKE');
		});

		it('detects FONT_ const prefix', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.constPrefix).toBe('FONT_');
		});

		it('detects no font-family', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.includesFontFamily).toBe(false);
		});

		it('detects no interface', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.hasInterface).toBe(false);
		});

		it('detects string value format', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.valueFormat).toBe('string');
		});

		it('detects two-tier structure', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.twoTier).toBe(true);
		});

		it('detects weight exports', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.exportWeights).toBe(true);
		});
	});
});

// ─── transformToTypography — best practices ──────────────────────────────────

describe('transformToTypography — best practices', () => {
	it('generates SCSS with CSS custom properties and mixins', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web']);
		const scss = results.find((r) => r.filename === 'Typography.scss');
		expect(scss).toBeDefined();
		expect(scss!.content).toContain(':root {');
		expect(scss!.content).toContain('@mixin');
		expect(scss!.content).toContain('font-family');
	});

	it('generates TS with interface and camelCase', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web']);
		const ts = results.find((r) => r.filename === 'Typography.ts');
		expect(ts).toBeDefined();
		expect(ts!.content).toContain('export interface TypographyToken');
		expect(ts!.content).toContain('fontFamily');
		expect(ts!.content).toContain('fontSizeRem');
	});
});

// ─── transformToTypography — match existing ──────────────────────────────────

describe('transformToTypography — match existing', () => {
	const conv = detectTypographyConventions(REF_SCSS, REF_TS, false);

	it('generates SCSS in two-tier mode with variables + mixins', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const scss = results.find((r) => r.filename === 'Typography.scss');
		expect(scss).toBeDefined();
		const content = scss!.content;

		expect(content).not.toContain(':root {');
		expect(content).toContain('@mixin');
		expect(content).toContain('$font-');
		expect(content).toContain('-size:');
		expect(content).toContain('-height:');
		expect(content).toContain('-spacing:');
		expect(content).not.toContain('font-family');
	});

	it('generates SCSS weight variables when reference has them', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const scss = results.find((r) => r.filename === 'Typography.scss');
		expect(scss!.content).toContain('$font-weight-');
	});

	it('generates TS in two-tier mode with SCREAMING_SNAKE and string rem values', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const ts = results.find((r) => r.filename === 'Typography.ts');
		expect(ts).toBeDefined();
		const content = ts!.content;

		expect(content).not.toContain('export interface');
		expect(content).not.toContain('fontFamily');

		expect(content).toContain('FONT_WEIGHT_');
		expect(content).toMatch(/const FONT_[A-Z_]+ = \{/);
		expect(content).toContain("fontSize: '");
		expect(content).toContain("rem'");
	});

	it('generates TS with exported semantic aliases', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const ts = results.find((r) => r.filename === 'Typography.ts');
		expect(ts!.content).toMatch(/export const FONT_[A-Z_]+ = FONT_[A-Z_]+;/);
	});
});

// ─── transformToTypography — no typography entries ───────────────────────────

describe('transformToTypography — edge cases', () => {
	it('returns empty array when no typography entries exist', () => {
		const results = transformToTypography({ other: 'stuff' }, ['web']);
		expect(results).toEqual([]);
	});

	it('handles unwrapped format', () => {
		const unwrapped: Record<string, unknown> = {
			'droid/body/body-R': {
				$type: 'typography',
				$value: {
					fontFamily: 'Inter',
					fontSize: 16,
					fontWeight: 400,
					lineHeight: 24,
					letterSpacing: 0
				}
			}
		};
		const results = transformToTypography(unwrapped, ['web']);
		expect(results.length).toBeGreaterThan(0);
	});

	it('still works with conventions when no conventions are passed', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web']);
		expect(results.length).toBe(2);
		expect(results[0].filename).toBe('Typography.scss');
		expect(results[1].filename).toBe('Typography.ts');
	});
});

// ─── detectTypographyConventions — CSS custom props reference ────────────────

describe('detectTypographyConventions — CSS custom props style reference', () => {
	const cssPropsScss = `:root {
  --typo-body-family: 'Inter', sans-serif;
  --typo-body-size: 1rem;
}
@mixin typo-body {
  font-family: var(--typo-body-family);
  font-size: var(--typo-body-size);
}
`;

	it('detects CSS custom properties', () => {
		const conv = detectTypographyConventions(cssPropsScss, undefined, false);
		expect(conv.scss.hasCssCustomProperties).toBe(true);
		expect(conv.scss.includesFontFamily).toBe(true);
	});
});

// ─── Swift convention detection ──────────────────────────────────────────────

const REF_SWIFT_ENUM = `import Foundation
import UIKit
import SwiftUI

public enum TypographyStyle: String {

    case xLargeTitleR
    case xLargeTitleM
    case xLargeTitleB

    case bodyR
    case bodyM
    case bodyB

}

extension TypographyStyle {

    var fontData: FontData {

        switch self {

        case .xLargeTitleR:
            return FontData(fontWeight: .regular, size: 46, lineHeight: 53)
        case .xLargeTitleM:
            return FontData(fontWeight: .medium, size: 46, lineHeight: 53)
        case .xLargeTitleB:
            return FontData(fontWeight: .bold, size: 46, lineHeight: 53)

        case .bodyR:
            return FontData(fontWeight: .regular, size: 17, lineHeight: 22)
        case .bodyM:
            return FontData(fontWeight: .medium, size: 17, lineHeight: 22)
        case .bodyB:
            return FontData(fontWeight: .bold, size: 17, lineHeight: 22)

        }

    }

}

extension TypographyStyle {

    public var font: UIFont {
        return UIFont.systemFont(ofSize: fontData.size, weight: fontData.fontWeight)
    }

    public var suiFont: Font {
        return Font(font)
    }

}

public struct FontData {

    let fontWeight: UIFont.Weight
    let size: CGFloat
    let lineHeight: CGFloat

}
`;

const SAMPLE_IOS_JSON = {
	typography: {
		'ios/xlarge title/xlarge title-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'SF Pro',
				fontSize: 46,
				fontWeight: 400,
				lineHeight: 53,
				letterSpacing: 0.36
			}
		},
		'ios/xlarge title/xlarge title-B': {
			$type: 'typography',
			$value: {
				fontFamily: 'SF Pro',
				fontSize: 46,
				fontWeight: 700,
				lineHeight: 53,
				letterSpacing: 0.36
			}
		},
		'ios/body/body-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'SF Pro',
				fontSize: 17,
				fontWeight: 400,
				lineHeight: 22,
				letterSpacing: -0.43
			}
		},
		'ios/body/body-M': {
			$type: 'typography',
			$value: {
				fontFamily: 'SF Pro',
				fontSize: 17,
				fontWeight: 500,
				lineHeight: 22,
				letterSpacing: -0.43
			}
		}
	}
};

describe('detectTypographyConventions — Swift', () => {
	it('detects enum architecture', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.architecture).toBe('enum');
	});

	it('detects type name TypographyStyle', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.typeName).toBe('TypographyStyle');
	});

	it('detects FontData data struct', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.dataStructName).toBe('FontData');
	});

	it('detects data struct properties', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.dataStructProps).toEqual(['fontWeight', 'size', 'lineHeight']);
	});

	it('detects both UIKit and SwiftUI', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.uiFramework).toBe('both');
	});

	it('detects no tracking (reference has no tracking property)', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.includesTracking).toBe(false);
	});

	it('builds name map from case names with correct casing', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv.swift.nameMap['xlargetitler']).toBe('xLargeTitleR');
		expect(conv.swift.nameMap['xlargetitleb']).toBe('xLargeTitleB');
		expect(conv.swift.nameMap['bodyr']).toBe('bodyR');
	});

	it('returns struct best-practice defaults when no Swift reference provided', () => {
		const conv = detectTypographyConventions(REF_SCSS, undefined, false);
		expect(conv.swift.architecture).toBe('struct');
		expect(conv.swift.typeName).toBe('TypographyStyle');
		expect(conv.swift.includesTracking).toBe(true);
	});
});

// ─── Swift match-existing generation ─────────────────────────────────────────

describe('transformToTypography — Swift match-existing (enum)', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);

	it('generates enum with cases', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift');
		expect(swift).toBeDefined();
		expect(swift!.content).toContain('public enum TypographyStyle: String {');
		expect(swift!.content).toContain('case xLargeTitleR');
		expect(swift!.content).toContain('case bodyR');
	});

	it('generates fontData switch with FontData returns', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).toContain('var fontData: FontData {');
		expect(swift.content).toContain('switch self {');
		expect(swift.content).toContain('case .xLargeTitleR:');
		expect(swift.content).toMatch(
			/return FontData\(fontWeight: \.regular, size: 46, lineHeight: 53\)/
		);
		expect(swift.content).toMatch(
			/return FontData\(fontWeight: \.bold, size: 46, lineHeight: 53\)/
		);
	});

	it('uses correct name casing from reference (xLargeTitleR, not xlargeTitleR)', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).toContain('case xLargeTitleR');
		expect(swift.content).not.toContain('case xlargeTitleR');
	});

	it('includes UIKit imports when reference uses UIKit', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).toContain('import UIKit');
		expect(swift.content).toContain('import SwiftUI');
	});

	it('generates UIFont extension and SwiftUI bridge', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).toContain('public var font: UIFont {');
		expect(swift.content).toContain(
			'UIFont.systemFont(ofSize: fontData.size, weight: fontData.fontWeight)'
		);
		expect(swift.content).toContain('public var suiFont: Font {');
	});

	it('generates FontData struct with UIFont.Weight', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).toContain('public struct FontData {');
		expect(swift.content).toContain('let fontWeight: UIFont.Weight');
		expect(swift.content).toContain('let size: CGFloat');
		expect(swift.content).toContain('let lineHeight: CGFloat');
	});

	it('does NOT include tracking (reference FontData has no tracking)', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).not.toContain('tracking:');
		expect(swift.content).not.toContain('lineSpacing:');
	});

	it('does NOT include TypographyModifier boilerplate', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).not.toContain('ViewModifier');
		expect(swift.content).not.toContain('TypographyModifier');
	});
});

describe('transformToTypography — Swift best-practices (struct)', () => {
	it('generates struct + static let pattern with default conventions', () => {
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios']);
		const swift = results.find((r) => r.filename === 'Typography.swift');
		expect(swift).toBeDefined();
		expect(swift!.content).toContain('public struct TypographyStyle {');
		expect(swift!.content).toContain('static let');
		expect(swift!.content).toContain('tracking:');
		expect(swift!.content).toContain('ViewModifier');
	});
});

// ─── Kotlin convention detection ─────────────────────────────────────────────

const REF_KOTLIN = `package com.myapp.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object AppTypography {
    val xlargeTitleR = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 46.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 53.sp,
        letterSpacing = 0.sp,
    )
    val bodyR = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 17.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 22.sp,
        letterSpacing = 0.sp,
    )
}
`;

const SAMPLE_ANDROID_JSON = {
	typography: {
		'droid/xlarge title/xlarge title-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'Inter',
				fontSize: 46,
				fontWeight: 400,
				lineHeight: 53,
				letterSpacing: 0.36
			}
		},
		'droid/body/body-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'Inter',
				fontSize: 17,
				fontWeight: 400,
				lineHeight: 22,
				letterSpacing: -0.43
			}
		}
	}
};

describe('detectTypographyConventions — Kotlin', () => {
	it('detects object architecture', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN
		);
		expect(conv.kotlin.architecture).toBe('object');
	});

	it('detects container name AppTypography', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN
		);
		expect(conv.kotlin.containerName).toBe('AppTypography');
	});

	it('detects package name', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN
		);
		expect(conv.kotlin.packageName).toBe('com.myapp.ui.theme');
	});

	it('detects TextStyle usage', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN
		);
		expect(conv.kotlin.usesTextStyle).toBe(true);
	});

	it('detects no M3 builder', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN
		);
		expect(conv.kotlin.includesM3Builder).toBe(false);
	});

	it('builds name map from val declarations', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN
		);
		expect(conv.kotlin.nameMap['xlargetitler']).toBe('xlargeTitleR');
		expect(conv.kotlin.nameMap['bodyr']).toBe('bodyR');
	});
});

// ─── Kotlin match-existing generation ────────────────────────────────────────

describe('transformToTypography — Kotlin match-existing', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, undefined, REF_KOTLIN);

	it('uses detected package name', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv);
		const kt = results.find((r) => r.filename === 'Typography.kt');
		expect(kt).toBeDefined();
		expect(kt!.content).toContain('package com.myapp.ui.theme');
		expect(kt!.content).not.toContain('TODO: update to your package name');
	});

	it('uses detected container name AppTypography', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv);
		const kt = results.find((r) => r.filename === 'Typography.kt')!;
		expect(kt.content).toContain('object AppTypography {');
		expect(kt.content).not.toContain('TypographyTokens');
	});

	it('omits M3 builder when reference has none', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv);
		const kt = results.find((r) => r.filename === 'Typography.kt')!;
		expect(kt.content).not.toContain('fun appTypography()');
	});

	it('omits TODO comments when reference is provided', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv);
		const kt = results.find((r) => r.filename === 'Typography.kt')!;
		expect(kt.content).not.toContain('TODO: replace with bundled font');
		expect(kt.content).not.toContain('TODO: Replace FontFamily.Default');
	});
});

describe('transformToTypography — Kotlin best-practices', () => {
	it('includes TODO comments and M3 builder with default conventions', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android']);
		const kt = results.find((r) => r.filename === 'Typography.kt');
		expect(kt).toBeDefined();
		expect(kt!.content).toContain('TypographyTokens');
		expect(kt!.content).toContain('TODO: update to your package name');
		expect(kt!.content).toContain('TODO: replace with bundled font');
		expect(kt!.content).toContain('fun appTypography()');
	});
});

// ─── Kotlin with custom data class reference ─────────────────────────────────

const REF_KOTLIN_DATACLASS = `package com.myapp.design

import androidx.compose.ui.text.font.FontWeight

data class TypographyToken(val fontSize: Float, val fontWeight: FontWeight, val lineHeight: Float, val letterSpacing: Float)

object Fonts {
    val xlargeTitleR = TypographyToken(fontSize = 46f, fontWeight = FontWeight.Normal, lineHeight = 53f, letterSpacing = 0f)
    val bodyR = TypographyToken(fontSize = 17f, fontWeight = FontWeight.Normal, lineHeight = 22f, letterSpacing = 0f)
}
`;

describe('detectTypographyConventions — Kotlin data class', () => {
	it('detects custom data class TypographyToken', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN_DATACLASS
		);
		expect(conv.kotlin.customDataClass).toBe('TypographyToken');
	});

	it('detects data class properties', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN_DATACLASS
		);
		expect(conv.kotlin.dataClassProps).toEqual([
			'fontSize',
			'fontWeight',
			'lineHeight',
			'letterSpacing'
		]);
	});

	it('detects container name Fonts', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN_DATACLASS
		);
		expect(conv.kotlin.containerName).toBe('Fonts');
	});

	it('generates data class output', () => {
		const conv = detectTypographyConventions(
			undefined,
			undefined,
			false,
			undefined,
			REF_KOTLIN_DATACLASS
		);
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv);
		const kt = results.find((r) => r.filename === 'Typography.kt')!;
		expect(kt.content).toContain('data class TypographyToken(');
		expect(kt.content).toContain('object Fonts {');
		expect(kt.content).toMatch(/val \w+ = TypographyToken\(/);
	});
});

// ─── Swift struct reference detection ────────────────────────────────────────

const REF_SWIFT_STRUCT = `import SwiftUI

public struct FontStyle {
  public let font: Font
  public let lineSpacing: CGFloat

  public init(font: Font, lineSpacing: CGFloat = 0) {
    self.font = font
    self.lineSpacing = lineSpacing
  }
}

public extension FontStyle {
  static let xlargeTitleR = FontStyle(font: Font.system(size: 46, weight: .regular, design: .default), lineSpacing: 7)
  static let bodyR = FontStyle(font: Font.system(size: 17, weight: .regular, design: .default), lineSpacing: 5)
}
`;

describe('detectTypographyConventions — Swift struct reference', () => {
	it('detects struct architecture', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		expect(conv.swift.architecture).toBe('struct');
	});

	it('detects type name FontStyle', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		expect(conv.swift.typeName).toBe('FontStyle');
	});

	it('detects SwiftUI-only framework', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		expect(conv.swift.uiFramework).toBe('swiftui');
	});

	it('detects no tracking', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		expect(conv.swift.includesTracking).toBe(false);
	});

	it('builds name map from static let names', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		expect(conv.swift.nameMap['xlargetitler']).toBe('xlargeTitleR');
		expect(conv.swift.nameMap['bodyr']).toBe('bodyR');
	});

	it('generates struct output using detected typeName FontStyle', () => {
		const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
		const swift = results.find((r) => r.filename === 'Typography.swift')!;
		expect(swift.content).toContain('public struct FontStyle {');
		expect(swift.content).not.toContain('tracking');
		expect(swift.content).toContain('static let xlargeTitleR = FontStyle(');
	});
});

// ─── Swift enum with calculateFontSize (dynamic type scaling) ────────────────

const REF_SWIFT_DYNAMIC = `import Foundation
import UIKit
import SwiftUI

public enum TypographyStyle: String {

    case xLargeTitleR
    case xLargeTitleM
    case xLargeTitleB

    case bodyR
    case bodyM
    case bodyB

    case slPriceR

}

struct FontConstants {

    static let addingRatio: CGFloat = 1.5
    static let subtractingRatio: CGFloat = -1.0

}

extension TypographyStyle {

    var fontData: FontData {

        switch self {

        case .xLargeTitleR:
            return FontData(fontWeight: .regular, size: TypographyStyle.calculateFontSize(46), lineHeight: TypographyStyle.calculateFontSize(53))
        case .xLargeTitleM:
            return FontData(fontWeight: .medium, size: TypographyStyle.calculateFontSize(46), lineHeight: TypographyStyle.calculateFontSize(53))
        case .xLargeTitleB:
            return FontData(fontWeight: .bold, size: TypographyStyle.calculateFontSize(46), lineHeight: TypographyStyle.calculateFontSize(53))

        case .bodyR:
            return FontData(fontWeight: .regular, size: TypographyStyle.calculateFontSize(17), lineHeight: TypographyStyle.calculateFontSize(22))
        case .bodyM:
            return FontData(fontWeight: .medium, size: TypographyStyle.calculateFontSize(17), lineHeight: TypographyStyle.calculateFontSize(22))
        case .bodyB:
            return FontData(fontWeight: .bold, size: TypographyStyle.calculateFontSize(17), lineHeight: TypographyStyle.calculateFontSize(22))

        case .slPriceR:
            return FontData(fontWeight: .regular, size: TypographyStyle.calculateFontSize(10, fmax: 10, fmin: 10), lineHeight: TypographyStyle.calculateFontSize(10, fmax: 10, fmin: 10))

        }

    }
    public static func calculateFontSize(_ standardFontSize: CGFloat, fmax: CGFloat = .infinity, fmin: CGFloat = 11) -> CGFloat {

        var contentSize : UIContentSizeCategory = .large
        if UIAccessibility.isLargerTextEnabled {
            contentSize = UIApplication.shared.preferredContentSizeCategory
        }

        let minFontSize = standardFontSize < fmin ? standardFontSize : fmin
        let maxFontSize = standardFontSize > fmax ? standardFontSize : fmax
        switch (contentSize) {
        case .extraSmall:
            return max(minFontSize, standardFontSize+(FontConstants.subtractingRatio*3))
        case .large:
            return standardFontSize
        default:
            return standardFontSize
        }
    }

}

extension TypographyStyle {

    public var font: UIFont {
        return UIFont.systemFont(ofSize: fontData.size, weight: fontData.fontWeight)
    }

    public var suiFont: Font {
        return Font(font)
    }

}

public struct FontData {

    let fontWeight: UIFont.Weight
    let size: CGFloat
    let lineHeight: CGFloat

}
`;

describe('detectTypographyConventions — Swift dynamic type scaling', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_DYNAMIC);

	it('detects enum architecture', () => {
		expect(conv.swift.architecture).toBe('enum');
	});

	it('detects type name TypographyStyle', () => {
		expect(conv.swift.typeName).toBe('TypographyStyle');
	});

	it('detects usesDynamicTypeScaling', () => {
		expect(conv.swift.usesDynamicTypeScaling).toBe(true);
	});

	it('detects dynamicTypeMethodName as calculateFontSize', () => {
		expect(conv.swift.dynamicTypeMethodName).toBe('calculateFontSize');
	});

	it('detects both UIKit and SwiftUI framework', () => {
		expect(conv.swift.uiFramework).toBe('both');
	});

	it('detects FontData data struct', () => {
		expect(conv.swift.dataStructName).toBe('FontData');
	});

	it('detects data struct properties', () => {
		expect(conv.swift.dataStructProps).toEqual(['fontWeight', 'size', 'lineHeight']);
	});

	it('builds name map from case names', () => {
		expect(conv.swift.nameMap['xlargetitler']).toBe('xLargeTitleR');
		expect(conv.swift.nameMap['bodyr']).toBe('bodyR');
		expect(conv.swift.nameMap['slpricer']).toBe('slPriceR');
	});

	it('no dynamic type scaling for enum without calculateFontSize', () => {
		const conv2 = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		expect(conv2.swift.usesDynamicTypeScaling).toBe(false);
		expect(conv2.swift.dynamicTypeMethodName).toBeNull();
	});

	it('no dynamic type scaling for struct references', () => {
		const conv2 = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_STRUCT);
		expect(conv2.swift.usesDynamicTypeScaling).toBe(false);
		expect(conv2.swift.dynamicTypeMethodName).toBeNull();
	});
});

describe('transformToTypography — Swift dynamic type scaling generation', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_DYNAMIC);
	const results = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv);
	const swift = results.find((r) => r.filename === 'Typography.swift')!;

	it('wraps size in calculateFontSize()', () => {
		expect(swift.content).toContain('size: TypographyStyle.calculateFontSize(46)');
		expect(swift.content).toContain('size: TypographyStyle.calculateFontSize(17)');
	});

	it('wraps lineHeight in calculateFontSize()', () => {
		expect(swift.content).toContain('lineHeight: TypographyStyle.calculateFontSize(53)');
		expect(swift.content).toContain('lineHeight: TypographyStyle.calculateFontSize(22)');
	});

	it('includes FontConstants struct', () => {
		expect(swift.content).toContain('struct FontConstants {');
		expect(swift.content).toContain('static let addingRatio: CGFloat = 1.5');
		expect(swift.content).toContain('static let subtractingRatio: CGFloat = -1.0');
	});

	it('includes calculateFontSize static method', () => {
		expect(swift.content).toContain('public static func calculateFontSize(_ standardFontSize: CGFloat');
		expect(swift.content).toContain('fmax: CGFloat = .infinity');
		expect(swift.content).toContain('fmin: CGFloat = 11');
	});

	it('includes UIContentSizeCategory switch', () => {
		expect(swift.content).toContain('UIContentSizeCategory');
		expect(swift.content).toContain('case .extraSmall:');
		expect(swift.content).toContain('case .large:');
		expect(swift.content).toContain('case .accessibilityExtraExtraExtraLarge:');
	});

	it('includes UIAccessibility check', () => {
		expect(swift.content).toContain('UIAccessibility.isLargerTextEnabled');
	});

	it('still generates enum with cases', () => {
		expect(swift.content).toContain('public enum TypographyStyle: String {');
		expect(swift.content).toContain('case xLargeTitleR');
	});

	it('still generates FontData struct', () => {
		expect(swift.content).toContain('public struct FontData {');
		expect(swift.content).toContain('let fontWeight: UIFont.Weight');
	});

	it('still generates UIFont/SwiftUI bridge', () => {
		expect(swift.content).toContain('public var font: UIFont {');
		expect(swift.content).toContain('public var suiFont: Font {');
	});

	it('does NOT include calculateFontSize when not detected', () => {
		const conv2 = detectTypographyConventions(undefined, undefined, false, REF_SWIFT_ENUM);
		const results2 = transformToTypography(SAMPLE_IOS_JSON, ['ios'], conv2);
		const swift2 = results2.find((r) => r.filename === 'Typography.swift')!;
		expect(swift2.content).not.toContain('calculateFontSize');
		expect(swift2.content).not.toContain('FontConstants');
		expect(swift2.content).toContain('size: 46');
	});
});

// ─── Kotlin @Immutable class architecture ────────────────────────────────────

const REF_KOTLIN_CLASS = `package com.red.rubi.ions.ui.theme.typography

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp

@Immutable
class RTypography internal constructor(
    val large_title_r: TextStyle,
    val large_title_m: TextStyle,
    val body_r: TextStyle,
    val body_m: TextStyle
) {
    constructor(
        defaultFontFamily: FontFamily = FontFamily.Default,
        large_title_r: TextStyle = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = 32.sp,
            lineHeight = 40.sp,
            letterSpacing = (-0.69).sp,
            lineHeightStyle = LineHeightStyle(
                alignment = LineHeightStyle.Alignment.Center,
                trim = LineHeightStyle.Trim.None
            )
        ),
        large_title_m: TextStyle = TextStyle(
            fontWeight = FontWeight.Medium,
            fontSize = 32.sp,
            lineHeight = 40.sp,
            letterSpacing = (-0.69).sp,
            lineHeightStyle = LineHeightStyle(
                alignment = LineHeightStyle.Alignment.Center,
                trim = LineHeightStyle.Trim.None
            )
        ),
        body_r: TextStyle = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            letterSpacing = (-0.43).sp,
            lineHeightStyle = LineHeightStyle(
                alignment = LineHeightStyle.Alignment.Center,
                trim = LineHeightStyle.Trim.None
            )
        ),
        body_m: TextStyle = TextStyle(
            fontWeight = FontWeight.Medium,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            letterSpacing = (-0.43).sp,
            lineHeightStyle = LineHeightStyle(
                alignment = LineHeightStyle.Alignment.Center,
                trim = LineHeightStyle.Trim.None
            )
        )
    ) : this(
        large_title_r = large_title_r.withDefaultFontFamily(defaultFontFamily),
        large_title_m = large_title_m.withDefaultFontFamily(defaultFontFamily),
        body_r = body_r.withDefaultFontFamily(defaultFontFamily),
        body_m = body_m.withDefaultFontFamily(defaultFontFamily)
    )
}
`;

describe('detectTypographyConventions — Kotlin @Immutable class', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, undefined, REF_KOTLIN_CLASS);

	it('detects class architecture', () => {
		expect(conv.kotlin.architecture).toBe('class');
	});

	it('detects className RTypography', () => {
		expect(conv.kotlin.className).toBe('RTypography');
	});

	it('detects @Immutable annotation', () => {
		expect(conv.kotlin.isImmutable).toBe(true);
	});

	it('detects snake_case naming', () => {
		expect(conv.kotlin.namingStyle).toBe('snake_case');
	});

	it('detects LineHeightStyle usage', () => {
		expect(conv.kotlin.includesLineHeightStyle).toBe(true);
	});

	it('detects package name', () => {
		expect(conv.kotlin.packageName).toBe('com.red.rubi.ions.ui.theme.typography');
	});

	it('builds name map from val declarations', () => {
		expect(conv.kotlin.nameMap['large_title_r']).toBe('large_title_r');
		expect(conv.kotlin.nameMap['body_r']).toBe('body_r');
	});
});

describe('transformToTypography — Kotlin @Immutable class generation', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, undefined, REF_KOTLIN_CLASS);
	const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv);
	const kt = results.find((r) => r.filename === 'Typography.kt')!;

	it('generates @Immutable annotation', () => {
		expect(kt.content).toContain('@Immutable');
	});

	it('generates class with internal constructor', () => {
		expect(kt.content).toContain('class RTypography internal constructor(');
	});

	it('uses snake_case property names', () => {
		expect(kt.content).toContain('val xlarge_title_r: TextStyle');
		expect(kt.content).toContain('val body_r: TextStyle');
	});

	it('includes LineHeightStyle in TextStyle defaults', () => {
		expect(kt.content).toContain('lineHeightStyle = LineHeightStyle(');
		expect(kt.content).toContain('alignment = LineHeightStyle.Alignment.Center');
		expect(kt.content).toContain('trim = LineHeightStyle.Trim.None');
	});

	it('imports LineHeightStyle', () => {
		expect(kt.content).toContain('import androidx.compose.ui.text.style.LineHeightStyle');
	});

	it('imports Immutable', () => {
		expect(kt.content).toContain('import androidx.compose.runtime.Immutable');
	});

	it('generates copy() method', () => {
		expect(kt.content).toContain('fun copy(');
		expect(kt.content).toContain('): RTypography = RTypography(');
	});

	it('generates equals() method', () => {
		expect(kt.content).toContain('override fun equals(other: Any?): Boolean');
		expect(kt.content).toContain('if (other !is RTypography) return false');
	});

	it('generates hashCode() method', () => {
		expect(kt.content).toContain('override fun hashCode(): Int');
	});

	it('generates withDefaultFontFamily helper', () => {
		expect(kt.content).toContain('private fun TextStyle.withDefaultFontFamily');
	});

	it('uses detected package name', () => {
		expect(kt.content).toContain('package com.red.rubi.ions.ui.theme.typography');
	});
});

// ─── Kotlin multi-file output (definition + accessor) ────────────────────────

const _REF_KOTLIN_ACCESSOR = `package com.red.rubi.ions.ui.theme.typography

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import com.red.rubi.ions.ui.theme.LocalTypography

enum class RLocalTypography {
    large_title_r,
    body_r,
    body_m
    ;
    val textStyle: TextStyle
        @Composable
        get() = when (this) {
            large_title_r -> {
                MaterialTheme.LocalTypography.large_title_r
            }
            body_r -> {
                MaterialTheme.LocalTypography.body_r
            }
            body_m -> {
                MaterialTheme.LocalTypography.body_m
            }
        }
}
`;

describe('transformToTypography — Kotlin multi-file (definition + accessor)', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, undefined, REF_KOTLIN_CLASS);
	const scope: KotlinTypographyScope = {
		generateDefinition: true,
		generateAccessor: true,
		definitionFilename: 'RTypography.kt',
		accessorClassName: 'RLocalTypography',
		accessorContainerRef: 'LocalTypography',
		accessorFilename: 'RLocalTypography.kt'
	};

	const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv, scope);

	it('produces two output files', () => {
		expect(results.filter((r) => r.platform === 'android')).toHaveLength(2);
	});

	it('produces a definition file with correct filename', () => {
		const def = results.find((r) => r.filename === 'RTypography.kt');
		expect(def).toBeDefined();
		expect(def!.content).toContain('@Immutable');
		expect(def!.content).toContain('class RTypography internal constructor(');
	});

	it('produces an accessor file with correct filename', () => {
		const acc = results.find((r) => r.filename === 'RLocalTypography.kt');
		expect(acc).toBeDefined();
	});

	it('accessor file contains enum class with correct name', () => {
		const acc = results.find((r) => r.filename === 'RLocalTypography.kt')!;
		expect(acc.content).toContain('enum class RLocalTypography {');
	});

	it('accessor file references MaterialTheme.LocalTypography', () => {
		const acc = results.find((r) => r.filename === 'RLocalTypography.kt')!;
		expect(acc.content).toContain('MaterialTheme.LocalTypography.');
	});

	it('accessor file has @Composable textStyle getter', () => {
		const acc = results.find((r) => r.filename === 'RLocalTypography.kt')!;
		expect(acc.content).toContain('val textStyle: TextStyle');
		expect(acc.content).toContain('@Composable');
		expect(acc.content).toContain('get() = when (this) {');
	});

	it('accessor file uses same package as definition', () => {
		const acc = results.find((r) => r.filename === 'RLocalTypography.kt')!;
		expect(acc.content).toContain('package com.red.rubi.ions.ui.theme.typography');
	});

	it('accessor file lists token names matching definition', () => {
		const acc = results.find((r) => r.filename === 'RLocalTypography.kt')!;
		expect(acc.content).toMatch(/xlarge_title_r,/);
		expect(acc.content).toMatch(/body_r,/);
	});
});

describe('transformToTypography — Kotlin definition-only scope', () => {
	const conv = detectTypographyConventions(undefined, undefined, false, undefined, REF_KOTLIN_CLASS);
	const scope: KotlinTypographyScope = {
		generateDefinition: true,
		generateAccessor: false,
		definitionFilename: 'RTypography.kt'
	};

	it('produces only the definition file', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android'], conv, scope);
		const androidResults = results.filter((r) => r.platform === 'android');
		expect(androidResults).toHaveLength(1);
		expect(androidResults[0].filename).toBe('RTypography.kt');
	});
});

describe('transformToTypography — Kotlin no scope (best practices)', () => {
	it('produces single Typography.kt with default name when no scope', () => {
		const results = transformToTypography(SAMPLE_ANDROID_JSON, ['android']);
		const androidResults = results.filter((r) => r.platform === 'android');
		expect(androidResults).toHaveLength(1);
		expect(androidResults[0].filename).toBe('Typography.kt');
	});
});
