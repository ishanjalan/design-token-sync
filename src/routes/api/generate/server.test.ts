import { describe, it, expect } from 'vitest';
import { POST } from './+server.js';

const lightColors = {
	Colour: {
		Text: {
			Primary: {
				$type: 'color',
				$value: {
					colorSpace: 'srgb',
					components: [0.114, 0.114, 0.114],
					alpha: 1,
					hex: '#1d1d1d'
				},
				$extensions: {
					'com.figma.aliasData': {
						targetVariableId: 'id',
						targetVariableName: 'Colour/Grey/750',
						targetVariableSetId: 'set-1',
						targetVariableSetName: '_Primitives'
					}
				}
			}
		}
	}
};

const darkColors = {
	Colour: {
		Text: {
			Primary: {
				$type: 'color',
				$value: {
					colorSpace: 'srgb',
					components: [0.96, 0.96, 0.96],
					alpha: 1,
					hex: '#f5f5f5'
				},
				$extensions: {
					'com.figma.aliasData': {
						targetVariableId: 'id',
						targetVariableName: 'Colour/Grey/50',
						targetVariableSetId: 'set-1',
						targetVariableSetName: '_Primitives'
					}
				}
			}
		}
	}
};

const values = {
	Integer: {
		'4': { $type: 'number', $value: 4 }
	}
};

type Overrides = {
	lightColors?: Record<string, unknown>;
	darkColors?: Record<string, unknown>;
	values?: Record<string, unknown>;
	platforms?: string[];
	outputs?: string[];
	typography?: Record<string, unknown>;
	additionalThemes?: Array<{ label: string; tokens: Record<string, unknown> }>;
	omitLightColors?: boolean;
	omitDarkColors?: boolean;
	omitValues?: boolean;
	invalidJsonFile?: 'lightColors' | 'darkColors' | 'values';
	oversizedFile?: 'lightColors' | 'darkColors' | 'values';
};

function makeRequest(overrides: Overrides = {}): Request {
	const fd = new FormData();

	const light = overrides.lightColors ?? lightColors;
	const dark = overrides.darkColors ?? darkColors;
	const vals = overrides.values ?? values;

	if (!overrides.omitLightColors) {
		let lightContent: string;
		if (overrides.invalidJsonFile === 'lightColors') {
			lightContent = 'not json';
		} else if (overrides.oversizedFile === 'lightColors') {
			lightContent = 'x'.repeat(10 * 1024 * 1024 + 1);
		} else {
			lightContent = JSON.stringify(light);
		}
		fd.append(
			'lightColors',
			new File([lightContent], 'Light.tokens.json', { type: 'application/json' })
		);
	}

	if (!overrides.omitDarkColors) {
		let darkContent: string;
		if (overrides.invalidJsonFile === 'darkColors') {
			darkContent = 'not json';
		} else if (overrides.oversizedFile === 'darkColors') {
			darkContent = 'x'.repeat(10 * 1024 * 1024 + 1);
		} else {
			darkContent = JSON.stringify(dark);
		}
		fd.append(
			'darkColors',
			new File([darkContent], 'Dark.tokens.json', { type: 'application/json' })
		);
	}

	if (!overrides.omitValues) {
		let valuesContent: string;
		if (overrides.invalidJsonFile === 'values') {
			valuesContent = 'not json';
		} else if (overrides.oversizedFile === 'values') {
			valuesContent = 'x'.repeat(10 * 1024 * 1024 + 1);
		} else {
			valuesContent = JSON.stringify(vals);
		}
		fd.append(
			'values',
			new File([valuesContent], 'Value.tokens.json', { type: 'application/json' })
		);
	}

	if (overrides.platforms !== undefined) {
		fd.append('platforms', JSON.stringify(overrides.platforms));
	} else {
		fd.append('platforms', JSON.stringify(['web']));
	}

	if (overrides.outputs !== undefined) {
		fd.append('outputs', JSON.stringify(overrides.outputs));
	}

	if (overrides.typography !== undefined) {
		fd.append(
			'typography',
			new File([JSON.stringify(overrides.typography)], 'typography.tokens.json', {
				type: 'application/json'
			})
		);
	}

	if (overrides.additionalThemes !== undefined) {
		for (const theme of overrides.additionalThemes) {
			fd.append(
				'additionalThemes',
				new File([JSON.stringify(theme.tokens)], `${theme.label}.tokens.json`, {
					type: 'application/json'
				})
			);
		}
	}

	return new Request('http://localhost/api/generate', { method: 'POST', body: fd });
}

function makeEvent(req: Request) {
	return {
		request: req,
		params: {},
		url: new URL(req.url),
		locals: {},
		platform: undefined,
		route: { id: '/api/generate' },
		isDataRequest: false,
		isSubRequest: false
	} as Parameters<typeof POST>[0];
}

describe('POST /api/generate', () => {
	it('valid FormData returns success with correct stats shape', async () => {
		const req = makeRequest();
		const res = await POST(makeEvent(req));
		const data = await res.json();

		expect(data.success).toBe(true);
		expect(Array.isArray(data.files)).toBe(true);
		expect(data.platforms).toEqual(['web']);
		expect(data.stats).toEqual(
			expect.objectContaining({
				primitiveColors: expect.any(Number),
				semanticColors: expect.any(Number),
				spacingSteps: expect.any(Number),
				typographyStyles: expect.any(Number),
				shadowTokens: expect.any(Number),
				borderTokens: expect.any(Number),
				opacityTokens: expect.any(Number),
				gradientTokens: expect.any(Number),
				radiusTokens: expect.any(Number),
				motionTokens: expect.any(Number)
			})
		);
	});

	it('missing required files returns 400', async () => {
		const req = makeRequest({ omitLightColors: true });
		try {
			await POST(makeEvent(req));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect((e as { status?: number }).status).toBe(400);
		}
	});

	it('invalid JSON in a token file returns 400', async () => {
		const req = makeRequest({ invalidJsonFile: 'lightColors' });
		try {
			await POST(makeEvent(req));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect((e as { status?: number }).status).toBe(400);
		}
	});

	it('file size exceeding limit returns 413', async () => {
		const req = makeRequest({ oversizedFile: 'lightColors' });
		try {
			await POST(makeEvent(req));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect((e as { status?: number }).status).toBe(413);
		}
	});

	it('platform filtering (only web)', async () => {
		const req = makeRequest({ platforms: ['web'] });
		const res = await POST(makeEvent(req));
		const data = await res.json();

		expect(data.success).toBe(true);
		for (const file of data.files) {
			expect(file.platform).toBe('web');
		}
	});

	it('platform filtering (only ios)', async () => {
		const req = makeRequest({ platforms: ['ios'] });
		const res = await POST(makeEvent(req));
		const data = await res.json();

		expect(data.success).toBe(true);
		for (const file of data.files) {
			expect(file.platform).toBe('ios');
		}
	});

	it('output category filtering (colors only)', async () => {
		const req = makeRequest({
			outputs: ['colors'],
			typography: {
				Typography: {
					Body: {
						$type: 'typography',
						$value: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400 }
					}
				}
			}
		});
		const res = await POST(makeEvent(req));
		const data = await res.json();

		expect(data.success).toBe(true);
		const typographyFiles = data.files.filter(
			(f: { filename: string }) =>
				f.filename.includes('Typography') && f.filename.endsWith('.scss')
		);
		expect(typographyFiles.length).toBe(0);
	});

	it('output category filtering (typography only)', async () => {
		const req = makeRequest({
			outputs: ['typography'],
			typography: {
				Typography: {
					Body: {
						$type: 'typography',
						$value: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400 }
					}
				}
			}
		});
		const res = await POST(makeEvent(req));
		const data = await res.json();

		expect(data.success).toBe(true);
		const colorFiles = data.files.filter(
			(f: { filename: string }) =>
				f.filename === 'Primitives.scss' || f.filename === 'Colors.scss'
		);
		expect(colorFiles.length).toBe(0);
	});

	it('stats object has all expected fields', async () => {
		const req = makeRequest();
		const res = await POST(makeEvent(req));
		const data = await res.json();

		const expectedFields = [
			'primitiveColors',
			'semanticColors',
			'spacingSteps',
			'typographyStyles',
			'shadowTokens',
			'borderTokens',
			'opacityTokens',
			'gradientTokens',
			'radiusTokens',
			'motionTokens'
		];
		for (const field of expectedFields) {
			expect(data.stats).toHaveProperty(field);
			expect(typeof data.stats[field]).toBe('number');
		}
	});

	it('additional themes generate theme-labeled files', async () => {
		const themeTokens = {
			Colour: {
				Brand: {
					Primary: {
						$type: 'color',
						$value: {
							colorSpace: 'srgb',
							components: [0.2, 0.4, 0.8],
							alpha: 1,
							hex: '#3366cc'
						}
					}
				}
			}
		};
		const req = makeRequest({
			additionalThemes: [{ label: 'Brand', tokens: themeTokens }]
		});
		const res = await POST(makeEvent(req));
		const data = await res.json();

		expect(data.success).toBe(true);
		const themeFiles = data.files.filter(
			(f: { filename: string }) => f.filename.includes('.brand.')
		);
		expect(themeFiles.length).toBeGreaterThan(0);
		expect(themeFiles.some((f: { filename: string }) => f.filename.includes('brand'))).toBe(true);
	});
});
