import { describe, it, expect } from 'vitest';
import { transformFigmaResponse } from './figma-api.js';
import type { FigmaVariablesResponse } from './figma-api.js';

function makeResponse(
	variables: FigmaVariablesResponse['meta']['variables'],
	collections: FigmaVariablesResponse['meta']['variableCollections']
): FigmaVariablesResponse {
	return { status: 200, error: false, meta: { variables, variableCollections: collections } };
}

describe('transformFigmaResponse', () => {
	it('transforms a simple color variable to DTCG format', () => {
		const response = makeResponse(
			{
				'v1': {
					id: 'v1',
					name: 'Grey/750',
					key: 'k1',
					variableCollectionId: 'c1',
					resolvedType: 'COLOR',
					description: '',
					hiddenFromPublishing: false,
					scopes: ['ALL_SCOPES'],
					codeSyntax: {},
					valuesByMode: {
						'm1': { r: 0.114, g: 0.114, b: 0.114, a: 1 }
					}
				}
			},
			{
				'c1': {
					id: 'c1',
					name: 'Colors',
					key: 'ck1',
					modes: [{ modeId: 'm1', name: 'Light' }],
					defaultModeId: 'm1',
					remote: false,
					hiddenFromPublishing: false,
					variableIds: ['v1']
				}
			}
		);

		const result = transformFigmaResponse(response);
		const grey = result.lightColors['Grey'] as Record<string, unknown>;
		const token = grey?.['750'] as Record<string, unknown>;
		expect(token.$type).toBe('color');
		expect(token.$value).toBeDefined();
		const value = token.$value as Record<string, unknown>;
		expect(value.colorSpace).toBe('srgb');
		expect(typeof value.hex).toBe('string');
	});

	it('transforms alias variables with extension data', () => {
		const response = makeResponse(
			{
				'v1': {
					id: 'v1',
					name: 'Colour/Grey/750',
					key: 'k1',
					variableCollectionId: 'c1',
					resolvedType: 'COLOR',
					description: '',
					hiddenFromPublishing: false,
					scopes: ['ALL_SCOPES'],
					codeSyntax: {},
					valuesByMode: {
						'm1': { r: 0.114, g: 0.114, b: 0.114, a: 1 }
					}
				},
				'v2': {
					id: 'v2',
					name: 'Text/primary',
					key: 'k2',
					variableCollectionId: 'c1',
					resolvedType: 'COLOR',
					description: '',
					hiddenFromPublishing: false,
					scopes: ['ALL_SCOPES'],
					codeSyntax: {},
					valuesByMode: {
						'm1': { type: 'VARIABLE_ALIAS', id: 'v1' }
					}
				}
			},
			{
				'c1': {
					id: 'c1',
					name: 'Colors',
					key: 'ck1',
					modes: [{ modeId: 'm1', name: 'Light' }],
					defaultModeId: 'm1',
					remote: false,
					hiddenFromPublishing: false,
					variableIds: ['v1', 'v2']
				}
			}
		);

		const result = transformFigmaResponse(response);
		const text = result.lightColors['Text'] as Record<string, unknown>;
		const token = text?.['primary'] as Record<string, unknown>;
		expect(token.$type).toBe('color');
		const ext = token.$extensions as Record<string, unknown>;
		expect(ext).toBeDefined();
		const aliasData = ext['com.figma.aliasData'] as Record<string, unknown>;
		expect(aliasData.targetVariableName).toBe('Colour/Grey/750');
	});

	it('handles light/dark modes separately', () => {
		const response = makeResponse(
			{
				'v1': {
					id: 'v1',
					name: 'BG/primary',
					key: 'k1',
					variableCollectionId: 'c1',
					resolvedType: 'COLOR',
					description: '',
					hiddenFromPublishing: false,
					scopes: [],
					codeSyntax: {},
					valuesByMode: {
						'light-mode': { r: 1, g: 1, b: 1, a: 1 },
						'dark-mode': { r: 0.1, g: 0.1, b: 0.1, a: 1 }
					}
				}
			},
			{
				'c1': {
					id: 'c1',
					name: 'Colors',
					key: 'ck1',
					modes: [
						{ modeId: 'light-mode', name: 'Light' },
						{ modeId: 'dark-mode', name: 'Dark' }
					],
					defaultModeId: 'light-mode',
					remote: false,
					hiddenFromPublishing: false,
					variableIds: ['v1']
				}
			}
		);

		const result = transformFigmaResponse(response);

		const lightBg = result.lightColors['BG'] as Record<string, unknown>;
		const lightToken = lightBg?.['primary'] as Record<string, unknown>;
		const lightVal = lightToken.$value as Record<string, unknown>;
		expect(lightVal.hex).toBe('#ffffff');

		const darkBg = result.darkColors['BG'] as Record<string, unknown>;
		const darkToken = darkBg?.['primary'] as Record<string, unknown>;
		const darkVal = darkToken.$value as Record<string, unknown>;
		expect(darkVal.hex).toBe('#1a1a1a');
	});

	it('transforms number variables to values export', () => {
		const response = makeResponse(
			{
				'v1': {
					id: 'v1',
					name: 'Integer/8',
					key: 'k1',
					variableCollectionId: 'c1',
					resolvedType: 'FLOAT',
					description: '',
					hiddenFromPublishing: false,
					scopes: [],
					codeSyntax: {},
					valuesByMode: { 'm1': 8 }
				}
			},
			{
				'c1': {
					id: 'c1',
					name: 'Values',
					key: 'ck1',
					modes: [{ modeId: 'm1', name: 'Default' }],
					defaultModeId: 'm1',
					remote: false,
					hiddenFromPublishing: false,
					variableIds: ['v1']
				}
			}
		);

		const result = transformFigmaResponse(response);
		const integer = result.values['Integer'] as Record<string, unknown>;
		const token = integer?.['8'] as Record<string, unknown>;
		expect(token.$type).toBe('number');
		expect(token.$value).toBe(8);
	});

	it('handles empty response', () => {
		const response = makeResponse({}, {});
		const result = transformFigmaResponse(response);
		expect(result.lightColors).toEqual({});
		expect(result.darkColors).toEqual({});
		expect(result.values).toEqual({});
	});
});
