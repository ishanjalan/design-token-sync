/**
 * APCA contrast validation.
 *
 * Uses the apca-w3 package (W3C reference implementation for WCAG 3)
 * to compute perceptual lightness contrast (Lc) between foreground/background
 * color pairs and recommend minimum font sizes.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — apca-w3 ships no type declarations
import { APCAcontrast, sRGBtoY, fontLookupAPCA } from 'apca-w3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContrastPair {
	fgName: string;
	bgName: string;
	fgHex: string;
	bgHex: string;
}

export interface ContrastResult {
	fgName: string;
	bgName: string;
	fgHex: string;
	bgHex: string;
	lc: number;
	absLc: number;
	level: 'pass' | 'large' | 'non-text' | 'fail';
	minFontSize?: string;
}

export interface ContrastSummary {
	total: number;
	pass: number;
	large: number;
	nonText: number;
	fail: number;
	results: ContrastResult[];
}

// APCA thresholds (absolute Lc values)
const THRESHOLD_BODY = 75;
const THRESHOLD_LARGE = 60;
const THRESHOLD_NON_TEXT = 45;

// ─── Core Contrast Check ──────────────────────────────────────────────────────

function hexToRgbArray(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return [r, g, b];
}

export function checkContrast(fgHex: string, bgHex: string): number {
	const fg = hexToRgbArray(fgHex);
	const bg = hexToRgbArray(bgHex);
	const lc = APCAcontrast(sRGBtoY(fg), sRGBtoY(bg));
	return typeof lc === 'number' ? Math.round(lc * 10) / 10 : 0;
}

function classifyContrast(absLc: number): ContrastResult['level'] {
	if (absLc >= THRESHOLD_BODY) return 'pass';
	if (absLc >= THRESHOLD_LARGE) return 'large';
	if (absLc >= THRESHOLD_NON_TEXT) return 'non-text';
	return 'fail';
}

function lookupMinFont(absLc: number): string | undefined {
	try {
		const result = fontLookupAPCA(absLc);
		if (Array.isArray(result) && result.length > 0) {
			return `${result[0]}px @ weight 400`;
		}
	} catch {
		// fontLookupAPCA may throw for very low contrast
	}
	return undefined;
}

// ─── Pair Detection ───────────────────────────────────────────────────────────

export interface TokenColorMap {
	[tokenName: string]: string; // name → hex
}

/**
 * Auto-detect foreground/background pairings from token names.
 * Pairs text-* and icon-* tokens with background-* tokens.
 */
export function detectPairings(
	tokens: TokenColorMap,
	manualPairings?: Record<string, string>
): ContrastPair[] {
	if (manualPairings) {
		return Object.entries(manualPairings)
			.filter(([fg, bg]) => tokens[fg] && tokens[bg])
			.map(([fg, bg]) => ({
				fgName: fg,
				bgName: bg,
				fgHex: tokens[fg],
				bgHex: tokens[bg]
			}));
	}

	const pairs: ContrastPair[] = [];
	const fgTokens = Object.entries(tokens).filter(
		([name]) => name.startsWith('text-') || name.startsWith('icon-')
	);
	const bgTokens = Object.entries(tokens).filter(([name]) =>
		name.startsWith('background-')
	);

	for (const [fgName, fgHex] of fgTokens) {
		for (const [bgName, bgHex] of bgTokens) {
			pairs.push({ fgName, bgName, fgHex, bgHex });
		}
	}

	return pairs;
}

// ─── Palette Validation ───────────────────────────────────────────────────────

export function validatePalette(pairs: ContrastPair[]): ContrastSummary {
	const results: ContrastResult[] = [];

	for (const pair of pairs) {
		const lc = checkContrast(pair.fgHex, pair.bgHex);
		const absLc = Math.abs(lc);
		const level = classifyContrast(absLc);
		results.push({
			...pair,
			lc,
			absLc,
			level,
			minFontSize: level !== 'pass' ? lookupMinFont(absLc) : undefined
		});
	}

	return {
		total: results.length,
		pass: results.filter((r) => r.level === 'pass').length,
		large: results.filter((r) => r.level === 'large').length,
		nonText: results.filter((r) => r.level === 'non-text').length,
		fail: results.filter((r) => r.level === 'fail').length,
		results
	};
}

/**
 * Extract semantic color token names and hex values from generated CSS output.
 * Works with Colors.scss output (parses `:root { --token: light-dark(...) }` blocks).
 */
export function extractSemanticColors(
	lightColors: Record<string, unknown>
): TokenColorMap {
	const map: TokenColorMap = {};

	function walk(obj: unknown, path: string[]): void {
		if (!obj || typeof obj !== 'object') return;
		const o = obj as Record<string, unknown>;
		if (o.$type === 'color' && o.$value && typeof o.$value === 'object') {
			const v = o.$value as Record<string, unknown>;
			if (typeof v.hex === 'string') {
				const name = path
					.filter((p) => p.toLowerCase() !== 'standard')
					.map((p) => p.toLowerCase().replace(/\s+/g, '-'))
					.join('-');
				map[name] = v.hex.toLowerCase();
			}
			return;
		}
		for (const [key, val] of Object.entries(o)) {
			if (!key.startsWith('$')) walk(val, [...path, key]);
		}
	}

	walk(lightColors, []);
	return map;
}
