// ─── Token Explorer — pure parsers, no SvelteKit deps ────────────────────────

export interface ColorEntry {
	name: string;
	subFamily?: string; // intermediate path segments between family and name
	fullPath: string;
	lightHex: string;
	darkHex?: string; // only set when different from lightHex
	isPrimitive: boolean;
	alias?: string; // targetVariableName for semantic tokens
}

export interface ColorFamily {
	family: string;
	count: number;
	tokens: ColorEntry[];
}

export interface TypographyEntry {
	name: string;
	group: string; // raw group path: e.g. "ios/xlarge title"
	fullPath: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: number | string;
	lineHeight?: number | string;
	letterSpacing?: number | string;
}

export interface ValueEntry {
	name: string;
	fullPath: string;
	category: string;
	value: number;
}

// ─── Path normalization ───────────────────────────────────────────────────────

/**
 * Figma can export tokens as either nested JSON objects OR as flat keys with
 * slash-separated names (e.g. "ios/xlarge title/xlarge title-R").
 * This expands the latter into proper path segments so grouping works correctly.
 */
function expandPath(rawPath: string[]): string[] {
	const result: string[] = [];
	for (const segment of rawPath) {
		if (segment.includes('/')) {
			result.push(...segment.split('/').map((s) => s.trim()).filter(Boolean));
		} else {
			result.push(segment);
		}
	}
	return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveHex(value: unknown): string | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as Record<string, unknown>;

	// Figma DTCG with direct hex field (most common)
	if (typeof v.hex === 'string' && v.hex.length >= 3) {
		const h = v.hex.toLowerCase();
		return h.startsWith('#') ? h : `#${h}`;
	}

	// Figma components array: [r, g, b] floats 0–1 with separate alpha
	if (Array.isArray(v.components) && v.components.length >= 3 && typeof v.alpha === 'number') {
		const [r, g, b] = v.components as number[];
		const a = v.alpha;
		const ri = Math.round(r * 255);
		const gi = Math.round(g * 255);
		const bi = Math.round(b * 255);
		if (a < 0.999) {
			const ai = Math.round(a * 255);
			return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}${ai.toString(16).padStart(2, '0')}`;
		}
		return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`;
	}

	// W3C DTCG: r/g/b/a as floats
	if (typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number') {
		const a = typeof v.a === 'number' ? v.a : 1;
		const ri = Math.round(v.r * 255);
		const gi = Math.round(v.g * 255);
		const bi = Math.round(v.b * 255);
		if (a < 0.999) {
			const ai = Math.round(a * 255);
			return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}${ai.toString(16).padStart(2, '0')}`;
		}
		return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`;
	}

	return null;
}

function walkColorTokens(
	obj: unknown,
	path: string[],
	callback: (path: string[], value: unknown, extensions: unknown) => void
): void {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
	const o = obj as Record<string, unknown>;
	if (o.$type === 'color') {
		callback(path, o.$value, o.$extensions);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (key.startsWith('$')) continue;
		walkColorTokens(val, [...path, key], callback);
	}
}

// Build a path→hex lookup for the dark JSON
function buildDarkHexMap(darkJson: Record<string, unknown>): Map<string, string> {
	const map = new Map<string, string>();
	walkColorTokens(darkJson, [], (path, value, extensions) => {
		const hex = resolveHex(value);
		if (!hex) return;
		// Index by both raw path and expanded path
		const rawKey = path.join('/');
		const expandedKey = expandPath(path).join('/');
		map.set(rawKey, hex);
		if (expandedKey !== rawKey) map.set(expandedKey, hex);
		// Also index by alias target
		const aliasData = (extensions as Record<string, unknown> | undefined)?.[
			'com.figma.aliasData'
		] as Record<string, unknown> | undefined;
		const targetName = aliasData?.targetVariableName as string | undefined;
		if (targetName) map.set(targetName, hex);
	});
	return map;
}

// Sort tokens: numeric leaf names ("100", "200") sort numerically; else alphabetically.
function sortTokens(tokens: ColorEntry[]): ColorEntry[] {
	return [...tokens].sort((a, b) => {
		// Group by subFamily first, then sort within
		if ((a.subFamily ?? '') !== (b.subFamily ?? '')) {
			return (a.subFamily ?? '').localeCompare(b.subFamily ?? '');
		}
		const aNum = parseInt(a.name, 10);
		const bNum = parseInt(b.name, 10);
		if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
		return a.name.localeCompare(b.name);
	});
}

// ─── buildColorFamilies ───────────────────────────────────────────────────────

export function buildColorFamilies(
	lightJson: Record<string, unknown>,
	darkJson?: Record<string, unknown>
): ColorFamily[] {
	const familyMap = new Map<string, ColorEntry[]>();
	const darkHexMap = darkJson ? buildDarkHexMap(darkJson) : new Map<string, string>();

	walkColorTokens(lightJson, [], (path, value, extensions) => {
		if (path.length === 0) return;
		const hex = resolveHex(value);
		if (!hex) return;

		const normalizedPath = expandPath(path);

		const aliasData = (extensions as Record<string, unknown> | undefined)?.[
			'com.figma.aliasData'
		] as Record<string, unknown> | undefined;
		const targetName = aliasData?.targetVariableName as string | undefined;

		// family = first segment
		// subFamily = middle segments (if path length >= 3)
		// name = last segment
		const family = normalizedPath[0];
		const name = normalizedPath[normalizedPath.length - 1] || normalizedPath[0];
		const subFamily =
			normalizedPath.length >= 3
				? normalizedPath.slice(1, -1).join('/')
				: undefined;
		const fullPath = normalizedPath.join('/');

		const rawDark =
			darkHexMap.get(fullPath) ??
			darkHexMap.get(path.join('/')) ??
			(targetName ? darkHexMap.get(targetName) : undefined);
		const darkHex =
			rawDark && rawDark.toLowerCase() !== hex.toLowerCase() ? rawDark : undefined;

		const entry: ColorEntry = {
			name,
			subFamily,
			fullPath,
			lightHex: hex,
			darkHex,
			isPrimitive: !aliasData,
			alias: targetName
		};

		if (!familyMap.has(family)) familyMap.set(family, []);
		familyMap.get(family)!.push(entry);
	});

	return [...familyMap.entries()].map(([family, tokens]) => ({
		family,
		count: tokens.length,
		tokens: sortTokens(tokens)
	}));
}

// ─── parseTypographyTokens ────────────────────────────────────────────────────

export function parseTypographyTokens(typoJson: Record<string, unknown>): TypographyEntry[] {
	const entries: TypographyEntry[] = [];

	function walk(obj: unknown, path: string[]) {
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
		const o = obj as Record<string, unknown>;

		if (o.$type === 'typography' && o.$value && typeof o.$value === 'object') {
			const v = o.$value as Record<string, unknown>;
			const rawSize = v.fontSize;
			const fontSize =
				typeof rawSize === 'number'
					? rawSize
					: typeof rawSize === 'string'
						? parseFloat(rawSize)
						: 0;
			if (fontSize > 0) {
				// Expand slash-separated flat keys into proper path segments
				const normalizedPath = expandPath(path);
				// group = all segments except the last (e.g. "ios/xlarge title")
				// name = last segment (e.g. "xlarge title-R")
				const group = normalizedPath.slice(0, -1).join('/');
				const name =
					normalizedPath[normalizedPath.length - 1] || normalizedPath.join('/');
				const fullPath = normalizedPath.join('/');

				entries.push({
					name,
					group,
					fullPath,
					fontSize,
					fontFamily: typeof v.fontFamily === 'string' ? v.fontFamily : '',
					fontWeight:
						typeof v.fontWeight === 'number'
							? v.fontWeight
							: typeof v.fontWeight === 'string'
								? v.fontWeight
								: 400,
					lineHeight: v.lineHeight as number | string | undefined,
					letterSpacing: v.letterSpacing as number | string | undefined
				});
			}
			return;
		}

		for (const [key, val] of Object.entries(o)) {
			if (key.startsWith('$')) continue;
			walk(val, [...path, key]);
		}
	}

	walk(typoJson, []);
	// Sort: by group (alphabetical), then by fontSize descending within each group
	return entries.sort((a, b) => {
		if (a.group !== b.group) return a.group.localeCompare(b.group);
		return b.fontSize - a.fontSize;
	});
}

// ─── parseValueTokens ─────────────────────────────────────────────────────────

export function parseValueTokens(valuesJson: Record<string, unknown>): ValueEntry[] {
	const entries: ValueEntry[] = [];

	function walk(obj: unknown, path: string[]) {
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
		const o = obj as Record<string, unknown>;

		if (o.$type === 'number' && o.$value !== undefined) {
			const raw = o.$value;
			const value = typeof raw === 'number' ? raw : parseFloat(String(raw));
			if (!isNaN(value)) {
				const normalizedPath = expandPath(path);
				const category = normalizedPath[0] ?? 'values';
				const nameParts = normalizedPath.slice(1);
				const name =
					nameParts.length > 0
						? nameParts.join('/')
						: normalizedPath[normalizedPath.length - 1] ?? '';
				entries.push({
					name,
					fullPath: normalizedPath.join('/'),
					category,
					value
				});
			}
			return;
		}

		for (const [key, val] of Object.entries(o)) {
			if (key.startsWith('$')) continue;
			walk(val, [...path, key]);
		}
	}

	walk(valuesJson, []);
	// Sort by category then value ascending
	return entries.sort((a, b) =>
		a.category !== b.category ? a.category.localeCompare(b.category) : a.value - b.value
	);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Returns a CSS-safe contrasting text color (black or white) for a given hex bg */
export function contrastColor(hex: string): string {
	const h = hex.replace('#', '').slice(0, 6);
	if (h.length < 6) return '#ffffff';
	const r = parseInt(h.slice(0, 2), 16) / 255;
	const g = parseInt(h.slice(2, 4), 16) / 255;
	const b = parseInt(h.slice(4, 6), 16) / 255;
	const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
	return L > 0.179 ? '#09090B' : '#FAFAFA';
}

/** Format a path string as a human-readable label: "ios/xlarge title" → "iOS · Xlarge Title" */
export function pathToLabel(path: string): string {
	return path
		.split('/')
		.map((p) => {
			const t = p.trim();
			// Common platform shorthands
			if (t.toLowerCase() === 'ios') return 'iOS';
			if (t.toLowerCase() === 'droid') return 'Android';
			// Title-case each word
			return t.replace(/\b\w/g, (c) => c.toUpperCase());
		})
		.join(' · ');
}
