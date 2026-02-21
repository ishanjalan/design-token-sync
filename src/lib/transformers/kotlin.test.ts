/**
 * Tests for kotlin.ts — Compose Material3 output.
 */

import { describe, it, expect } from 'vitest';
import { transformToKotlin, detectKotlinConventions } from './kotlin.js';
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
	it('returns filename Colors.kt, format kotlin, platform android', () => {
		const r = transformToKotlin(lightColors, darkColors);
		expect(r.filename).toBe('Colors.kt');
		expect(r.format).toBe('kotlin');
		expect(r.platform).toBe('android');
	});

	it('includes file header, package placeholder, and import', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		expect(content).toContain('// Colors.kt');
		expect(content).toContain('// Auto-generated from Figma Variables');
		expect(content).toContain('package com.example.design');
		expect(content).toContain('import androidx.compose.ui.graphics.Color');
	});
});

describe('transformToKotlin — Primitives object', () => {
	it('outputs object Primitives block', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		expect(content).toContain('object Primitives {');
	});

	it('outputs 0xFFRRGGBB format for opaque colors', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		// Grey750 = #1D1D1D → 0xFF1D1D1D
		expect(content).toContain('Color(0xFF1D1D1D)');
	});

	it('uses 0xAARRGGBB hex format for alpha colors', () => {
		const { content } = transformToKotlin(lightColorsAlpha, darkColorsAlpha);
		// 50% alpha = 0x80, rgb(29,29,29) = 1D1D1D → Color(0x801D1D1D)
		expect(content).toMatch(/Color\(0x80[0-9A-F]{6}\)/);
		expect(content).not.toContain('red =');
		expect(content).not.toContain('alpha =');
	});

	it('groups primitives by family', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		expect(content).toContain('// Grey');
	});

	it('sorts by sort key within a family', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		// default convention is camelCase
		const idx0 = content.indexOf('grey0');
		const idx50 = content.indexOf('grey50');
		const idx750 = content.indexOf('grey750');
		expect(idx0).toBeLessThan(idx50);
		expect(idx50).toBeLessThan(idx750);
	});

	it('uses localeCompare tie-breaker when sortKeys are equal', () => {
		const { content } = transformToKotlin(lightColorsWithSortTie, darkColorsWithSortTie);
		// camelCase default: grey0 before grey0Warm
		const idx0 = content.indexOf('val grey0 ');
		const idxWarm = content.indexOf('grey0Warm');
		expect(idx0).toBeGreaterThan(-1);
		expect(idx0).toBeLessThan(idxWarm);
	});
});

describe('transformToKotlin — Light/DarkColorTokens', () => {
	it('outputs LightColorTokens and DarkColorTokens objects', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		expect(content).toContain('object LightColorTokens {');
		expect(content).toContain('object DarkColorTokens {');
	});

	it('light references correct primitive', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		// textPrimary in light → grey750 (camelCase default)
		expect(content).toMatch(/LightColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});

	it('dark references correct primitive', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		// textPrimary in dark → grey50 (camelCase default)
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey50/);
	});

	it('Static tokens use same primitive in both light and dark', () => {
		const { content } = transformToKotlin(lightColors, darkColors);
		// Fill/Static/white references grey0 in both
		const lightSection = content.slice(content.indexOf('LightColorTokens'));
		const darkSection = content.slice(content.indexOf('DarkColorTokens'));
		expect(lightSection).toContain('Primitives.grey0');
		expect(darkSection).toContain('Primitives.grey0');
	});

	it('falls back to light primitive when dark aliases non-Colour path (unknown primitive)', () => {
		// darkColorsNonColourAlias has Spacing/4 as the alias → not in primitive map → ?? lightPrim
		const { content } = transformToKotlin(lightColors, darkColorsNonColourAlias);
		// Both dark and light textPrimary should use grey750 (light fallback)
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});

	it('resolves dark alias from its own primitive map entry', () => {
		// dark references Colour/Blue/900 which gets added as a primitive since it has a Colour/ path
		const { content } = transformToKotlin(lightColors, darkColorsUnknownPrimitive);
		// dark text/primary comes from blue900 (collected from dark)
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.blue900/);
	});

	it('skips tokens with no aliasData', () => {
		const { content } = transformToKotlin(lightColorsNoAlias, darkColors);
		expect(content).not.toContain('noAlias');
	});

	it('handles non-object intermediate path in dark (getTokenAtPath returns null → use light)', () => {
		const { content } = transformToKotlin(lightColors, darkColorsNonObjectPath);
		// dark returns null at path → dark is same as light
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});

	it('handles non-color node at exact path in dark (getTokenAtPath returns null → use light)', () => {
		const { content } = transformToKotlin(lightColors, darkColorsNonColorAtPath);
		expect(content).toMatch(/DarkColorTokens[\s\S]*?textPrimary = Primitives\.grey750/);
	});
});

describe('transformToKotlin — convention: PascalCase', () => {
	it('generates PascalCase val names when reference uses PascalCase', () => {
		const ref = `object Colors {\n  val TextPrimary = Primitives.Grey750\n}`;
		const { content } = transformToKotlin(lightColors, darkColors, ref, false);
		expect(content).toContain('val Grey750');
		expect(content).toContain('val TextPrimary = ColorsPrimitives.Grey750');
		expect(content).not.toMatch(/\bval grey750\b/);
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
		const { content } = transformToKotlin(light, dark);
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
		const { content } = transformToKotlin(light, dark);
		expect(content).toContain('Colors.kt');
	});
});

describe('transformToKotlin — no semantic tokens', () => {
	it('omits LightColorTokens and DarkColorTokens when no semantic entries', () => {
		// Use empty exports — no color tokens at all
		const empty: FigmaColorExport = {};
		const { content } = transformToKotlin(empty, empty);
		expect(content).not.toContain('LightColorTokens');
		expect(content).not.toContain('DarkColorTokens');
	});
});
