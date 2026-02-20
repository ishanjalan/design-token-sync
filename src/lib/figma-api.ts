/**
 * Figma Variables API client + normalization layer.
 *
 * Fetches variables from Figma's REST API and normalizes them to the
 * same DTCG-compatible shape that manual JSON upload produces, so all
 * downstream transformers work unchanged.
 *
 * API: GET /v1/files/:file_key/variables/local
 * Requires: Figma Enterprise/Organization plan, Personal Access Token
 */

// ─── Figma API Response Types ─────────────────────────────────────────────────

export interface FigmaVariable {
	id: string;
	name: string;
	key: string;
	variableCollectionId: string;
	resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';
	description: string;
	hiddenFromPublishing: boolean;
	scopes: string[];
	codeSyntax: Record<string, string>;
	valuesByMode: Record<string, FigmaVariableValue>;
}

export interface FigmaColorValue {
	r: number;
	g: number;
	b: number;
	a: number;
}

export interface FigmaVariableAlias {
	type: 'VARIABLE_ALIAS';
	id: string;
}

export type FigmaVariableValue = number | string | boolean | FigmaColorValue | FigmaVariableAlias;

export interface FigmaVariableCollection {
	id: string;
	name: string;
	key: string;
	modes: { modeId: string; name: string }[];
	defaultModeId: string;
	remote: boolean;
	hiddenFromPublishing: boolean;
	variableIds: string[];
}

export interface FigmaVariablesResponse {
	status: number;
	error: boolean;
	meta: {
		variables: Record<string, FigmaVariable>;
		variableCollections: Record<string, FigmaVariableCollection>;
	};
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchVariables(
	fileKey: string,
	pat: string
): Promise<FigmaVariablesResponse> {
	const url = `https://api.figma.com/v1/files/${fileKey}/variables/local`;

	const response = await fetch(url, {
		headers: {
			'X-FIGMA-TOKEN': pat
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Figma API error ${response.status}: ${text}`
		);
	}

	return (await response.json()) as FigmaVariablesResponse;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function isAlias(value: FigmaVariableValue): value is FigmaVariableAlias {
	return typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS';
}

function isColor(value: FigmaVariableValue): value is FigmaColorValue {
	return typeof value === 'object' && value !== null && 'r' in value && 'g' in value && 'b' in value;
}

function colorToHex(c: FigmaColorValue): string {
	const r = Math.round(c.r * 255);
	const g = Math.round(c.g * 255);
	const b = Math.round(c.b * 255);
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function setNestedValue(
	obj: Record<string, unknown>,
	pathParts: string[],
	value: Record<string, unknown>
): void {
	let current = obj;
	for (let i = 0; i < pathParts.length - 1; i++) {
		const key = pathParts[i];
		if (!current[key] || typeof current[key] !== 'object') {
			current[key] = {};
		}
		current = current[key] as Record<string, unknown>;
	}
	current[pathParts[pathParts.length - 1]] = value;
}

export interface NormalizedTokenExports {
	lightColors: Record<string, unknown>;
	darkColors: Record<string, unknown>;
	values: Record<string, unknown>;
	typography: Record<string, unknown>;
}

/**
 * Transform raw Figma Variables API response into the same shape as manual
 * JSON upload, so all downstream transformers work unchanged.
 */
export function transformFigmaResponse(
	response: FigmaVariablesResponse
): NormalizedTokenExports {
	const { variables, variableCollections } = response.meta;
	const variableMap = new Map<string, FigmaVariable>();
	for (const v of Object.values(variables)) {
		variableMap.set(v.id, v);
	}

	const lightColors: Record<string, unknown> = {};
	const darkColors: Record<string, unknown> = {};
	const values: Record<string, unknown> = {};
	const typography: Record<string, unknown> = {};

	for (const collection of Object.values(variableCollections)) {
		const modes = collection.modes;
		const lightMode = modes.find(
			(m) => m.name.toLowerCase().includes('light') || m.modeId === collection.defaultModeId
		);
		const darkMode = modes.find((m) => m.name.toLowerCase().includes('dark'));

		for (const varId of collection.variableIds) {
			const variable = variableMap.get(varId);
			if (!variable) continue;

			const pathParts = variable.name.split('/');
			const type = variable.resolvedType;

			if (type === 'COLOR') {
				if (lightMode) {
					const lightVal = variable.valuesByMode[lightMode.modeId];
					const lightToken = buildColorToken(lightVal, variable, variableMap);
					if (lightToken) setNestedValue(lightColors, pathParts, lightToken);
				}

				if (darkMode) {
					const darkVal = variable.valuesByMode[darkMode.modeId];
					const darkToken = buildColorToken(darkVal, variable, variableMap);
					if (darkToken) setNestedValue(darkColors, pathParts, darkToken);
				} else if (lightMode) {
					const lightVal = variable.valuesByMode[lightMode.modeId];
					const lightToken = buildColorToken(lightVal, variable, variableMap);
					if (lightToken) setNestedValue(darkColors, pathParts, lightToken);
				}
			} else if (type === 'FLOAT') {
				const modeId = lightMode?.modeId ?? collection.defaultModeId;
				const val = variable.valuesByMode[modeId];
				if (typeof val === 'number') {
					const token: Record<string, unknown> = {
						$type: 'number',
						$value: val
					};
					setNestedValue(values, pathParts, token);
				}
			}
		}
	}

	return { lightColors, darkColors, values, typography };
}

function buildColorToken(
	value: FigmaVariableValue | undefined,
	variable: FigmaVariable,
	variableMap: Map<string, FigmaVariable>
): Record<string, unknown> | null {
	if (!value) return null;

	if (isAlias(value)) {
		const target = variableMap.get(value.id);
		const resolvedValue = resolveAliasToColor(value, variableMap);
		if (!resolvedValue) return null;

		const token: Record<string, unknown> = {
			$type: 'color',
			$value: {
				colorSpace: 'srgb',
				components: [resolvedValue.r, resolvedValue.g, resolvedValue.b],
				alpha: resolvedValue.a,
				hex: colorToHex(resolvedValue)
			}
		};

		if (target) {
			token.$extensions = {
				'com.figma.variableId': variable.id,
				'com.figma.scopes': variable.scopes,
				'com.figma.aliasData': {
					targetVariableId: target.id,
					targetVariableName: target.name,
					targetVariableSetId: target.variableCollectionId,
					targetVariableSetName: ''
				}
			};
		}

		return token;
	}

	if (isColor(value)) {
		return {
			$type: 'color',
			$value: {
				colorSpace: 'srgb',
				components: [value.r, value.g, value.b],
				alpha: value.a,
				hex: colorToHex(value)
			},
			$extensions: {
				'com.figma.variableId': variable.id,
				'com.figma.scopes': variable.scopes
			}
		};
	}

	return null;
}

function resolveAliasToColor(
	alias: FigmaVariableAlias,
	variableMap: Map<string, FigmaVariable>,
	depth = 0
): FigmaColorValue | null {
	if (depth > 20) return null;

	const target = variableMap.get(alias.id);
	if (!target) return null;

	const modeIds = Object.keys(target.valuesByMode);
	if (modeIds.length === 0) return null;

	const value = target.valuesByMode[modeIds[0]];
	if (isAlias(value)) {
		return resolveAliasToColor(value, variableMap, depth + 1);
	}
	if (isColor(value)) {
		return value;
	}
	return null;
}
