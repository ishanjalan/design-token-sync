/**
 * Shared Figma token fixtures for transformer tests.
 *
 * Mimics the structure of Figma's native DTCG JSON export including
 * aliasData extensions so the alias-reconstruction path is exercised.
 */

import type { FigmaColorExport } from '$lib/types.js';

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

/**
 * Minimal light color export.
 * Text/primary → Colour/Grey/750 (#1d1d1d)
 * Fill/Static/white → Colour/Grey/0 (#ffffff)
 */
export const lightColors: FigmaColorExport = {
	Text: {
		primary: colorToken('#1d1d1d', 'Colour/Grey/750')
	},
	Fill: {
		Static: {
			white: colorToken('#ffffff', 'Colour/Grey/0')
		}
	}
};

/**
 * Minimal dark color export.
 * Text/primary → Colour/Grey/50 (#f5f5f5)
 * Fill/Static/white → Colour/Grey/0 (#ffffff) — same as light
 */
export const darkColors: FigmaColorExport = {
	Text: {
		primary: colorToken('#f5f5f5', 'Colour/Grey/50')
	},
	Fill: {
		Static: {
			white: colorToken('#ffffff', 'Colour/Grey/0')
		}
	}
};

/**
 * Light colors with a Stroke/Standard group to test "Standard" segment stripping.
 */
export const lightColorsWithStandard: FigmaColorExport = {
	Stroke: {
		Standard: {
			strong: colorToken('#1d1d1d', 'Colour/Grey/750')
		}
	}
};

export const darkColorsWithStandard: FigmaColorExport = {
	Stroke: {
		Standard: {
			strong: colorToken('#f5f5f5', 'Colour/Grey/50')
		}
	}
};

/**
 * A standalone Figma _Primitives collection export (no aliasData needed).
 * Used to test the buildPrimitiveMapFromExport path in scss.ts and ts-web.ts.
 * Shape: { "Colour": { "Grey": { "750": token, "50": token } } }
 */
export const primitivesExport: Record<string, unknown> = {
	Colour: {
		Grey: {
			'750': {
				$type: 'color',
				$value: {
					colorSpace: 'srgb',
					components: hexToComponents('#1d1d1d'),
					alpha: 1,
					hex: '#1d1d1d'
				}
			},
			'50': {
				$type: 'color',
				$value: {
					colorSpace: 'srgb',
					components: hexToComponents('#f5f5f5'),
					alpha: 1,
					hex: '#f5f5f5'
				}
			},
			'0': {
				$type: 'color',
				$value: {
					colorSpace: 'srgb',
					components: hexToComponents('#ffffff'),
					alpha: 1,
					hex: '#ffffff'
				}
			}
		}
	}
};

/**
 * Light/dark color exports whose tokens have NO aliasData — they reference a
 * colour by name but the resolved value has to come from the explicit primitives
 * export above.  These are used when calling transformToSCSS(light, dark, primitives).
 */
function colorTokenNoAlias(hex: string) {
	return {
		$type: 'color',
		$value: {
			colorSpace: 'srgb' as const,
			components: hexToComponents(hex),
			alpha: 1,
			hex
		}
	};
}

export const lightColorsForPrimitivesPath: FigmaColorExport = {
	Text: {
		primary: {
			...colorTokenNoAlias('#1d1d1d'),
			$extensions: {
				'com.figma.aliasData': {
					targetVariableId: 'v1',
					targetVariableName: 'Colour/Grey/750',
					targetVariableSetId: 'set-1',
					targetVariableSetName: '_Primitives'
				}
			}
		}
	}
};

export const darkColorsForPrimitivesPath: FigmaColorExport = {
	Text: {
		primary: {
			...colorTokenNoAlias('#f5f5f5'),
			$extensions: {
				'com.figma.aliasData': {
					targetVariableId: 'v2',
					targetVariableName: 'Colour/Grey/50',
					targetVariableSetId: 'set-1',
					targetVariableSetName: '_Primitives'
				}
			}
		}
	}
};

/**
 * Light/dark exports with a very long token path to exercise the multi-line
 * formatSemanticToken branch in scss.ts (> 80 char line).
 */
export const lightColorsLongName: FigmaColorExport = {
	Fill: {
		Component: {
			'some-very-long-descriptive-name': colorToken('#1d1d1d', 'Colour/Grey/750')
		}
	}
};

export const darkColorsLongName: FigmaColorExport = {
	Fill: {
		Component: {
			'some-very-long-descriptive-name': colorToken('#f5f5f5', 'Colour/Grey/50')
		}
	}
};

/**
 * Light colors with an alpha primitive to test rgba() output.
 */
export const lightColorsWithAlpha: FigmaColorExport = {
	Fill: {
		overlay: alphaColorToken(29, 29, 29, 0.5, 'Colour/Grey_Alpha/750_50')
	}
};

export const darkColorsWithAlpha: FigmaColorExport = {
	Fill: {
		overlay: alphaColorToken(29, 29, 29, 0.5, 'Colour/Grey_Alpha/750_50')
	}
};

/**
 * Dark colors where the matching token path exists but is NOT a color node.
 * Exercises the `getTokenAtPath` branch that returns null for non-color nodes.
 */
export const darkColorsNonColorAtPath: FigmaColorExport = {
	Text: {
		primary: { $type: 'string', $value: 'not-a-color' }
	}
};

/**
 * Dark colors where the intermediate path is a primitive (not an object).
 * Exercises the `if (!cur || typeof cur !== 'object') return null` guard in
 * getTokenAtPath, and the null-guard early-return in walkTokens/walkTokensWithPath.
 */
export const darkColorsNonObjectPath: FigmaColorExport = {
	Text: 'not-an-object' as unknown as Record<string, unknown>
};

/**
 * Primitives export with an extra non-Colour token that figmaNameToScssVar
 * cannot convert (returns null). Exercises the !scssVar guard in
 * buildPrimitiveMapFromExport.
 */
export const primitivesExportWithNonColour: Record<string, unknown> = {
	...primitivesExport,
	Spacing: {
		'4': {
			$type: 'color',
			$value: {
				colorSpace: 'srgb',
				components: [1, 1, 1] as [number, number, number],
				alpha: 1,
				hex: '#ffffff'
			}
		}
	}
};

/**
 * Light colors where the aliasData target is NOT under Colour/ — exercises the
 * !scssVar guard in buildPrimitiveMapFromAliasData.
 */
export const lightColorsNonColourAlias: FigmaColorExport = {
	Text: {
		primary: {
			$type: 'color',
			$value: {
				colorSpace: 'srgb' as const,
				components: hexToComponents('#1d1d1d'),
				alpha: 1,
				hex: '#1d1d1d'
			},
			$extensions: {
				'com.figma.aliasData': {
					targetVariableId: 'v99',
					targetVariableName: 'Spacing/4',
					targetVariableSetId: 'set-x',
					targetVariableSetName: '_Spacing'
				}
			}
		}
	}
};

/**
 * Dark colors where Text/primary references a primitive NOT present in the
 * light's aliasData — exercises the `?? lightPrim` fallback in buildSemanticTokens.
 */
export const darkColorsUnknownPrimitive: FigmaColorExport = {
	Text: {
		primary: colorToken('#0a0a0a', 'Colour/Blue/900')
	}
};

/**
 * Two primitives in the SAME family ('grey') with the SAME sortKey (0), forcing
 * the secondary `scssVar.localeCompare` tie-breaker in generatePrimitivesScss /
 * generatePrimitivesTs.
 *
 * Colour/Grey/0       → $grey-0         (family 'grey', sortKey 0)
 * Colour/Grey/0/Warm  → $grey-0-warm    (family 'grey', sortKey 0)
 */
export const lightColorsWithSortTie: FigmaColorExport = {
	Text: {
		cool: colorToken('#ffffff', 'Colour/Grey/0'),
		warm: colorToken('#fafafa', 'Colour/Grey/0/Warm')
	}
};

export const darkColorsWithSortTie: FigmaColorExport = {
	Text: {
		cool: colorToken('#ffffff', 'Colour/Grey/0'),
		warm: colorToken('#fafafa', 'Colour/Grey/0/Warm')
	}
};

/**
 * Light colors with a token that has NO aliasData — exercises the
 * `if (!lightFigmaName) return;` guard in buildSemanticTokens.
 */
export const lightColorsNoAlias: FigmaColorExport = {
	Text: {
		noAlias: {
			$type: 'color',
			$value: {
				colorSpace: 'srgb' as const,
				components: hexToComponents('#111111'),
				alpha: 1,
				hex: '#111111'
			}
			// deliberately no $extensions
		},
		primary: colorToken('#1d1d1d', 'Colour/Grey/750')
	}
};

/**
 * Dark colors where Text/primary aliasData points to a non-Colour path —
 * exercises the `?? lightPrim` fallback in buildSemanticTokens (darkFigmaName is
 * truthy but the target is not in the primitive map because figmaNameToScssVar
 * returns null for non-Colour paths).
 */
export const darkColorsNonColourAlias: FigmaColorExport = {
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

/**
 * Dark colors where the path exists but the leaf value is null —
 * exercises the post-loop `if (!cur || typeof cur !== 'object') return null`
 * guard in getTokenAtPath (ts-web.ts only, typed strictly).
 */
export const darkColorsNullAtLeaf: FigmaColorExport = {
	Text: {
		primary: null as unknown as Record<string, unknown>
	}
};
