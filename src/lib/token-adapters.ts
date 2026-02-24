/**
 * Adapters to normalize different token formats (W3C DTCG, Tokens Studio)
 * into the internal Figma DTCG format expected by transformers.
 *
 * Internal format uses:
 *   - $type: 'color' | 'number' | 'shadow' | 'border' | 'typography'
 *   - $value: { r, g, b, a } for colors, number for values, etc.
 *   - $extensions: { 'com.figma.aliasData': { targetVariableName } } for aliases
 */

type AnyRecord = Record<string, unknown>;

export type TokenFormat = 'figma-dtcg' | 'w3c-dtcg' | 'tokens-studio' | 'unknown';

// ─── Format Detection ────────────────────────────────────────────────────────

export function detectTokenFormat(json: AnyRecord): TokenFormat {
	const sample = findFirstToken(json);
	if (!sample) return 'unknown';

	// Tokens Studio uses `value` (without $) and `type` (without $)
	if ('value' in sample && !('$value' in sample)) return 'tokens-studio';

	// W3C DTCG uses $value but not Figma-specific $extensions
	if ('$value' in sample && '$type' in sample) {
		const hasFigmaExt = hasDeep(json, 'com.figma.aliasData');
		if (hasFigmaExt) return 'figma-dtcg';
		// Check if $value is an object with r/g/b (Figma) vs a hex string (W3C)
		const val = sample.$value;
		if (typeof val === 'string' && val.startsWith('#')) return 'w3c-dtcg';
		if (typeof val === 'object' && val !== null && 'r' in (val as AnyRecord)) return 'figma-dtcg';
		return 'w3c-dtcg';
	}

	return 'unknown';
}

// ─── Normalization ───────────────────────────────────────────────────────────

export function normalizeTokens(json: AnyRecord): AnyRecord {
	const format = detectTokenFormat(json);
	switch (format) {
		case 'figma-dtcg':
			return json;
		case 'w3c-dtcg':
			return normalizeW3C(json);
		case 'tokens-studio':
			return normalizeTokensStudio(json);
		default:
			return json;
	}
}

function normalizeW3C(obj: AnyRecord, parentPath: string[] = []): AnyRecord {
	const result: AnyRecord = {};
	for (const [key, val] of Object.entries(obj)) {
		if (key.startsWith('$')) {
			result[key] = val;
			continue;
		}
		if (isTokenNode(val as AnyRecord, true)) {
			result[key] = normalizeW3CToken(val as AnyRecord, [...parentPath, key]);
		} else if (typeof val === 'object' && val !== null) {
			result[key] = normalizeW3C(val as AnyRecord, [...parentPath, key]);
		} else {
			result[key] = val;
		}
	}
	return result;
}

function normalizeW3CToken(token: AnyRecord, _path: string[]): AnyRecord {
	const type = token.$type as string;
	const value = token.$value;
	const result: AnyRecord = { $type: type };

	if (type === 'color' && typeof value === 'string') {
		result.$value = hexToFigmaColor(value);
	} else if (type === 'color' && typeof value === 'object' && value !== null) {
		result.$value = value;
	} else {
		result.$value = value;
	}

	if (token.$description) result.$description = token.$description;
	if (token.$extensions) result.$extensions = token.$extensions;

	// W3C alias format: {group.token}
	if (typeof value === 'string' && /^\{[^}]+\}$/.test(value)) {
		const ref = value.slice(1, -1);
		const parts = ref.split('.');
		result.$extensions = {
			'com.figma.aliasData': {
				targetVariableName: parts[parts.length - 1]
			}
		};
		delete result.$value;
	}

	return result;
}

function normalizeTokensStudio(obj: AnyRecord, parentPath: string[] = []): AnyRecord {
	const result: AnyRecord = {};
	for (const [key, val] of Object.entries(obj)) {
		if (key.startsWith('$') || key === 'tokenSetOrder') continue;
		if (typeof val !== 'object' || val === null) continue;

		const rec = val as AnyRecord;
		if (isTokensStudioToken(rec)) {
			result[key] = normalizeStudioToken(rec, [...parentPath, key]);
		} else {
			result[key] = normalizeTokensStudio(rec, [...parentPath, key]);
		}
	}
	return result;
}

function normalizeStudioToken(token: AnyRecord, _path: string[]): AnyRecord {
	const type = (token.type ?? token.$type) as string | undefined;
	const value = token.value ?? token.$value;
	const result: AnyRecord = {};

	if (type) result.$type = mapStudioType(type);

	if (typeof value === 'string' && /^\{[^}]+\}$/.test(value)) {
		const ref = value.slice(1, -1);
		const parts = ref.split('.');
		result.$extensions = {
			'com.figma.aliasData': {
				targetVariableName: parts[parts.length - 1]
			}
		};
	} else if (result.$type === 'color' && typeof value === 'string') {
		result.$value = hexToFigmaColor(value);
	} else {
		result.$value = value;
	}

	if (token.description) result.$description = token.description;

	return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapStudioType(type: string): string {
	const MAP: Record<string, string> = {
		color: 'color',
		sizing: 'number',
		spacing: 'number',
		borderRadius: 'number',
		borderWidth: 'number',
		opacity: 'number',
		fontFamilies: 'typography',
		fontWeights: 'typography',
		fontSizes: 'typography',
		lineHeights: 'typography',
		letterSpacing: 'typography',
		paragraphSpacing: 'typography',
		textDecoration: 'typography',
		textCase: 'typography',
		typography: 'typography',
		boxShadow: 'shadow',
		border: 'border',
		dimension: 'number',
		number: 'number'
	};
	return MAP[type] ?? type;
}

function hexToFigmaColor(hex: string): { r: number; g: number; b: number; a: number } {
	const clean = hex.replace('#', '');
	let r = 0, g = 0, b = 0, a = 1;
	if (clean.length === 3) {
		r = parseInt(clean[0] + clean[0], 16) / 255;
		g = parseInt(clean[1] + clean[1], 16) / 255;
		b = parseInt(clean[2] + clean[2], 16) / 255;
	} else if (clean.length === 6) {
		r = parseInt(clean.slice(0, 2), 16) / 255;
		g = parseInt(clean.slice(2, 4), 16) / 255;
		b = parseInt(clean.slice(4, 6), 16) / 255;
	} else if (clean.length === 8) {
		r = parseInt(clean.slice(0, 2), 16) / 255;
		g = parseInt(clean.slice(2, 4), 16) / 255;
		b = parseInt(clean.slice(4, 6), 16) / 255;
		a = parseInt(clean.slice(6, 8), 16) / 255;
	}
	return { r, g, b, a };
}

function isTokenNode(obj: AnyRecord, w3c: boolean): boolean {
	if (!obj || typeof obj !== 'object') return false;
	return w3c ? '$type' in obj && '$value' in obj : false;
}

function isTokensStudioToken(obj: AnyRecord): boolean {
	return ('value' in obj && 'type' in obj) || ('value' in obj && typeof obj.value === 'string');
}

function findFirstToken(obj: unknown): AnyRecord | null {
	if (!obj || typeof obj !== 'object') return null;
	const o = obj as AnyRecord;
	if ('$type' in o || 'type' in o) return o;
	for (const [k, v] of Object.entries(o)) {
		if (k.startsWith('$')) continue;
		const found = findFirstToken(v);
		if (found) return found;
	}
	return null;
}

function hasDeep(obj: unknown, key: string): boolean {
	if (!obj || typeof obj !== 'object') return false;
	const o = obj as AnyRecord;
	if (key in o) return true;
	return Object.values(o).some((v) => hasDeep(v, key));
}
