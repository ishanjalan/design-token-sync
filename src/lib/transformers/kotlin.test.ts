/**
 * Tests for kotlin.ts — Compose Material3 output.
 */

import { describe, it, expect } from 'vitest';
import { transformToKotlin, detectKotlinConventions } from './kotlin.js';
import type { FigmaColorExport } from '$lib/types.js';
import type { TransformResult } from '$lib/types.js';

function primContent(r: TransformResult[]): string {
	return r.find((x) => x.filename === 'Color.kt')?.content ?? r[0]?.content ?? '';
}
function semContent(r: TransformResult[]): string {
	return r.find((x) => x.filename === 'Colors.kt')?.content ?? '';
}

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

const darkColorsUnknownPrimitive: FigmaColorExport = {
	Text: {
		primary: colorToken('#0a0a0a', 'Colour/Blue/900')
	}
};

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
		},
		primary: colorToken('#1d1d1d', 'Colour/Grey/750')
	}
};

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

const darkColorsNonObjectPath: FigmaColorExport = {
	Text: 'not-an-object' as unknown as Record<string, unknown>
};

const darkColorsNonColorAtPath: FigmaColorExport = {
	Text: {
		primary: { $type: 'string', $value: 'not-a-color' }
	}
};

// ─── detectKotlinConventions ──────────────────────────────────────────────────

describe('detectKotlinConventions', () => {
	it('returns camelCase + AppColors defaults with no reference', () => {
		const c = detectKotlinConventions();
		expect(c.namingCase).toBe('camel');
		expect(c.objectName).toBe('AppColors');
	});

	it('detects PascalCase property names from reference', () => {
		const ref = `
object MyColors {
  val TextPrimary = Primitives.Grey750
  val FillWhite = Primitives.Grey0
}`;
		const c = detectKotlinConventions(ref, false);
		expect(c.namingCase).toBe('pascal');
	});

	it('detects camelCase property names from reference', () => {
		const ref = `
object AppColors {
  val textPrimary = Primitives.grey750
  val fillWhite = Primitives.grey0
}`;
		const c = detectKotlinConventions(ref, false);
		expect(c.namingCase).toBe('camel');
	});

	it('extracts object name from reference', () => {
		const ref = `object BrandColors {`;
		const c = detectKotlinConventions(ref, false);
		expect(c.objectName).toBe('BrandColors');
	});

	it('uses AppColors when no object found in reference', () => {
		const ref = `// no object definition here`;
		const c = detectKotlinConventions(ref, false);
		expect(c.objectName).toBe('AppColors');
	});
});

// ─── transformToKotlin ────────────────────────────────────────────────────────

describe('transformToKotlin — output structure', () => {
	it('returns filename Color.kt (primitives) and Colors.kt (semantics), format kotlin, platform android', () => {
		const r = transformToKotlin(lightColors, darkColors);
		expect(r.some((x) => x.filename === 'Color.kt')).toBe(true);
		expect(r.some((x) => x.filename === 'Colors.kt')).toBe(true);
		expect(r[0].format).toBe('kotlin');
		expect(r[0].platform).toBe('android');
	});

	it('includes file header, package placeholder, and import', () => {
		const content = primContent(transformToKotlin(lightColors, darkColors));
		expect(content).toContain('// Color.kt');
		expect(content).toContain('// Auto-generated from Figma Variables');
		expect(content).toContain('package com.example.design');
		expect(content).toContain('import androidx.compose.ui.graphics.Color');
	});
});

describe('transformToKotlin — Primitives object', () => {
	it('outputs object Primitives block', () => {
		const content = primContent(transformToKotlin(lightColors, darkColors));
		expect(content).toContain('object Primitives {');
	});

	it('outputs 0xFFRRGGBB format for opaque colors', () => {
		const content = primContent(transformToKotlin(lightColors, darkColors));
		// Grey750 = #1D1D1D → 0xFF1D1D1D
		expect(content).toContain('Color(0xFF1D1D1D)');
	});

	it('uses 0xAARRGGBB hex format for alpha colors', () => {
		const content = primContent(transformToKotlin(lightColorsAlpha, darkColorsAlpha));
		// 50% alpha = 0x80, rgb(29,29,29) = 1D1D1D → Color(0x801D1D1D)
		expect(content).toMatch(/Color\(0x80[0-9A-F]{6}\)/);
		expect(content).not.toContain('red =');
		expect(content).not.toContain('alpha =');
	});

	it('groups primitives by family', () => {
		const content = primContent(transformToKotlin(lightColors, darkColors));
		expect(content).toContain('// Grey');
	});

	it('sorts by sort key within a family', () => {
		const content = primContent(transformToKotlin(lightColors, darkColors));
		// default convention is camelCase
		const idx0 = content.indexOf('grey0');
		const idx50 = content.indexOf('grey50');
		const idx750 = content.indexOf('grey750');
		expect(idx0).toBeLessThan(idx50);
		expect(idx50).toBeLessThan(idx750);
	});

	it('uses localeCompare tie-breaker when sortKeys are equal', () => {
		const content = primContent(transformToKotlin(lightColorsWithSortTie, darkColorsWithSortTie));
		// camelCase default: grey0 before grey0Warm
		const idx0 = content.indexOf('val grey0 ');
		const idxWarm = content.indexOf('grey0Warm');
		expect(idx0).toBeGreaterThan(-1);
		expect(idx0).toBeLessThan(idxWarm);
	});
});

describe('transformToKotlin — Light/DarkColorTokens', () => {
	it('outputs LightColorTokens and DarkColorTokens objects', () => {
		const content = semContent(transformToKotlin(lightColors, darkColors));
		expect(content).toContain('object LightColorTokens {');
		expect(content).toContain('object DarkColorTokens {');
	});

	it('light references correct primitive', () => {
		const content = semContent(transformToKotlin(lightColors, darkColors));
		// textPrimary in light → grey750 (camelCase default)
		expect(content).toMatch(/LightColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});

	it('dark references correct primitive', () => {
		const content = semContent(transformToKotlin(lightColors, darkColors));
		// textPrimary in dark → grey50 (camelCase default)
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey50/);
	});

	it('Static tokens use same primitive in both light and dark', () => {
		const content = semContent(transformToKotlin(lightColors, darkColors));
		// Fill/Static/white references grey0 in both
		const lightSection = content.slice(content.indexOf('LightColorTokens'));
		const darkSection = content.slice(content.indexOf('DarkColorTokens'));
		expect(lightSection).toContain('Primitives.grey0');
		expect(darkSection).toContain('Primitives.grey0');
	});

	it('falls back to light primitive when dark aliases non-Colour path (unknown primitive)', () => {
		// darkColorsNonColourAlias has Spacing/4 as the alias → not in primitive map → ?? lightPrim
		const content = semContent(transformToKotlin(lightColors, darkColorsNonColourAlias));
		// Both dark and light textPrimary should use grey750 (light fallback)
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});

	it('resolves dark alias from its own primitive map entry', () => {
		// dark references Colour/Blue/900 which gets added as a primitive since it has a Colour/ path
		const content = semContent(transformToKotlin(lightColors, darkColorsUnknownPrimitive));
		// dark text/primary comes from blue900 (collected from dark)
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.blue900/);
	});

	it('skips tokens with no aliasData', () => {
		const content = primContent(transformToKotlin(lightColorsNoAlias, darkColors));
		expect(content).not.toContain('noAlias');
	});

	it('handles non-object intermediate path in dark (getTokenAtPath returns null → use light)', () => {
		const content = semContent(transformToKotlin(lightColors, darkColorsNonObjectPath));
		// dark returns null at path → dark is same as light
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});

	it('handles non-color node at exact path in dark (getTokenAtPath returns null → use light)', () => {
		const content = semContent(transformToKotlin(lightColors, darkColorsNonColorAtPath));
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});
});

describe('transformToKotlin — convention: PascalCase', () => {
	it('generates PascalCase val names when reference uses PascalCase', () => {
		const ref = `object Colors {\n  val TextPrimary = Primitives.Grey750\n}`;
		const r = transformToKotlin(lightColors, darkColors, ref, false);
		const prim = primContent(r);
		const sem = semContent(r);
		expect(prim).toContain('val Grey750');
		expect(sem).toContain('val TextPrimary = ColorsPrimitives.Grey750');
		expect(prim).not.toMatch(/\bval grey750\b/);
	});
});

describe('transformToKotlin — Standard path stripping', () => {
	it('strips Standard from token name', () => {
		const light: FigmaColorExport = {
			Fill: { Standard: { white: colorToken('#ffffff', 'Colour/Grey/0') } }
		};
		const dark: FigmaColorExport = {
			Fill: { Standard: { white: colorToken('#ffffff', 'Colour/Grey/0') } }
		};
		const content = semContent(transformToKotlin(light, dark));
		expect(content).toContain('fillWhite');
		expect(content).not.toContain('fillStandard');
	});
});

describe('transformToKotlin — digit-leading family name (topSegment fallback)', () => {
	it('handles a primitive whose top segment starts with a digit', () => {
		const light: FigmaColorExport = {
			Text: { primary: colorToken('#1d1d1d', 'Colour/750/Cool') }
		};
		const dark: FigmaColorExport = {
			Text: { primary: colorToken('#f5f5f5', 'Colour/750/Cool') }
		};
		const r = transformToKotlin(light, dark);
		expect(r.some((x) => x.filename === 'Colors.kt')).toBe(true);
	});
});

describe('transformToKotlin — no semantic tokens', () => {
	it('omits LightColorTokens and DarkColorTokens when no semantic entries', () => {
		const empty: FigmaColorExport = {};
		const r = transformToKotlin(empty, empty);
		const content = primContent(r);
		expect(content).not.toContain('LightColorTokens');
		expect(content).not.toContain('DarkColorTokens');
	});
});

// ─── Multi-file architecture ──────────────────────────────────────────────────

const MULTI_FILE_REF = `package com.red.rubi.ions.ui.theme.color
import androidx.compose.ui.graphics.Color

object RedPalette {
    val colorRed50 = Color(0xFFFDE6E5)
}

enum class RTextColor {
    TEXTPRIMARY;
}

class RTextColors(
    textPrimary: Color,
) {
    var textPrimary by mutableStateOf(textPrimary, structuralEqualityPolicy())
}

val LocalTextColor = compositionLocalOf { TextLightColorScheme }

enum class RFillColor {
    FILLPRIMARY;
}

class RFillColors(
    fillPrimary: Color,
) {
    var fillPrimary by mutableStateOf(fillPrimary, structuralEqualityPolicy())
}

val LocalFillColor = compositionLocalOf { FillLightColorScheme }
`;

describe('detectKotlinConventions — multi-file architecture', () => {
	it('detects multi-file architecture from class patterns', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.architecture).toBe('multi-file');
	});

	it('detects palette-objects primitive style', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.primitiveStyle).toBe('palette-objects');
	});

	it('detects semantic categories', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.semanticCategories).toContain('text');
		expect(conv.semanticCategories).toContain('fill');
	});

	it('detects class prefix R', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.classPrefix).toBe('R');
	});

	it('detects compositionLocalOf usage', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.usesCompositionLocal).toBe(true);
	});

	it('detects enum usage', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.usesEnum).toBe(true);
	});

	it('detects mutableStateOf usage', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.usesMutableState).toBe(true);
	});

	it('detects package from reference', () => {
		const conv = detectKotlinConventions(MULTI_FILE_REF, false);
		expect(conv.kotlinPackage).toBe('com.red.rubi.ions.ui.theme.color');
	});
});

describe('transformToKotlin — multi-file output', () => {
	it('returns multiple files when multi-file architecture detected', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		expect(results.length).toBeGreaterThan(1);
	});

	it('first file is Color.kt (primitives)', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		expect(results[0].filename).toBe('Color.kt');
	});

	it('Color.kt contains palette objects when detected', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const colorKt = results[0].content;
		expect(colorKt).toContain('Palette');
	});

	it('generates semantic category files with R prefix', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const filenames = results.map((r) => r.filename);
		expect(filenames).toContain('RTextColors.kt');
		expect(filenames).toContain('RFillColors.kt');
	});

	it('semantic files contain enum class', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const textFile = results.find((r) => r.filename === 'RTextColors.kt');
		expect(textFile).toBeDefined();
		expect(textFile!.content).toContain('enum class RTextColor {');
	});

	it('semantic files contain mutableStateOf class', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const textFile = results.find((r) => r.filename === 'RTextColors.kt');
		expect(textFile!.content).toContain('class RTextColors(');
		expect(textFile!.content).toContain('mutableStateOf');
	});

	it('semantic files contain compositionLocalOf', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const textFile = results.find((r) => r.filename === 'RTextColors.kt');
		expect(textFile!.content).toContain('compositionLocalOf');
		expect(textFile!.content).toContain('LocalTextColor');
	});

	it('semantic files contain dark/light factory functions', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const textFile = results.find((r) => r.filename === 'RTextColors.kt');
		expect(textFile!.content).toContain('textDarkColors()');
		expect(textFile!.content).toContain('textLightColors()');
	});

	it('semantic files contain MaterialTheme extension', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		const textFile = results.find((r) => r.filename === 'RTextColors.kt');
		expect(textFile!.content).toContain('MaterialTheme.LocalTextColors');
	});

	it('all output files have android platform', () => {
		const results = transformToKotlin(lightColors, darkColors, MULTI_FILE_REF, false);
		for (const r of results) {
			expect(r.platform).toBe('android');
			expect(r.format).toBe('kotlin');
		}
	});
});

// ─── Scope filtering ─────────────────────────────────────────────────────────

describe('transformToKotlin — scope filtering', () => {
	it('generates only primitives when scope.generatePrimitives=true, generateSemantics=false', () => {
		const r = transformToKotlin(lightColors, darkColors, undefined, true, {
			generatePrimitives: true,
			generateSemantics: false
		});
		expect(r).toHaveLength(1);
		expect(r[0].filename).toBe('Color.kt');
		expect(r[0].content).toContain('object Primitives');
		expect(r[0].content).not.toContain('LightColorTokens');
	});

	it('generates only semantics when scope.generateSemantics=true, generatePrimitives=false', () => {
		const r = transformToKotlin(lightColors, darkColors, undefined, true, {
			generatePrimitives: false,
			generateSemantics: true
		});
		expect(r).toHaveLength(1);
		expect(r[0].filename).toBe('Colors.kt');
		expect(r[0].content).toContain('LightColorTokens');
		expect(r[0].content).not.toContain('object Primitives');
	});

	it('generates both files when scope has both true', () => {
		const r = transformToKotlin(lightColors, darkColors, undefined, true, {
			generatePrimitives: true,
			generateSemantics: true
		});
		expect(r.length).toBeGreaterThanOrEqual(2);
		expect(r.some((x) => x.filename === 'Color.kt')).toBe(true);
		expect(r.some((x) => x.filename === 'Colors.kt')).toBe(true);
	});

	it('falls back to primitives when both are false', () => {
		const r = transformToKotlin(lightColors, darkColors, undefined, true, {
			generatePrimitives: false,
			generateSemantics: false
		});
		expect(r.length).toBeGreaterThanOrEqual(1);
		expect(r[0].filename).toBe('Color.kt');
	});

	it('primitives-only reference produces only Color.kt with no semantic objects', () => {
		const ref = `package com.example\nimport androidx.compose.ui.graphics.Color\nobject Primitives {\n    val grey750 = Color(0xFF1D1D1D)\n}`;
		const r = transformToKotlin(lightColors, darkColors, ref, false, {
			generatePrimitives: true,
			generateSemantics: false
		});
		expect(r).toHaveLength(1);
		expect(r[0].filename).toBe('Color.kt');
		expect(r[0].content).not.toContain('LightColorTokens');
		expect(r[0].content).not.toContain('DarkColorTokens');
	});
});
