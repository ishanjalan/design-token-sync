import { formatHex, formatHex8 } from 'culori';
import type { Color } from 'culori';

/**
 * Build a 6-digit hex (#RRGGBB) or 8-digit hex (#RRGGBBAA) from Figma's
 * 0–1 color components and alpha.
 *
 * Replaces manual `Math.round(x * 255).toString(16).padStart(2, '0')` patterns.
 */
export function figmaToHex(r: number, g: number, b: number, alpha: number = 1): string {
	const color: Color = { mode: 'rgb', r, g, b, alpha };
	if (alpha < 1) {
		return formatHex8(color);
	}
	return formatHex(color);
}

/**
 * Build a Kotlin-style 0xAARRGGBB hex string from Figma components.
 * Kotlin's Compose Color(Long) uses alpha-first byte order.
 */
export function figmaToKotlinHex(r: number, g: number, b: number, alpha: number = 1): string {
	const r8 = Math.round(Math.min(1, Math.max(0, r)) * 255);
	const g8 = Math.round(Math.min(1, Math.max(0, g)) * 255);
	const b8 = Math.round(Math.min(1, Math.max(0, b)) * 255);
	const a8 = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
	const long = ((a8 << 24) | (r8 << 16) | (g8 << 8) | b8) >>> 0;
	return `0x${long.toString(16).padStart(8, '0').toUpperCase()}`;
}

/**
 * Build a quoted hex string "#RRGGBB" or "#RRGGBBAA" from Figma 0–1 components.
 * Used by the Swift "match existing" mode when the reference uses string literals.
 */
export function figmaToStringHex(r: number, g: number, b: number, alpha: number = 1): string {
	const r8 = Math.round(Math.min(1, Math.max(0, r)) * 255);
	const g8 = Math.round(Math.min(1, Math.max(0, g)) * 255);
	const b8 = Math.round(Math.min(1, Math.max(0, b)) * 255);
	if (alpha < 1) {
		const a8 = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
		return `#${r8.toString(16).padStart(2, '0').toUpperCase()}${g8.toString(16).padStart(2, '0').toUpperCase()}${b8.toString(16).padStart(2, '0').toUpperCase()}${a8.toString(16).padStart(2, '0').toUpperCase()}`;
	}
	return `#${r8.toString(16).padStart(2, '0').toUpperCase()}${g8.toString(16).padStart(2, '0').toUpperCase()}${b8.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Build a Swift-style 0xRRGGBB or 0xRRGGBBAA hex string from Figma components.
 * Swift uses RRGGBB for opaque colors and RRGGBBAA for transparent.
 */
export function figmaToSwiftHex(r: number, g: number, b: number, alpha: number = 1): string {
	const r8 = Math.round(Math.min(1, Math.max(0, r)) * 255);
	const g8 = Math.round(Math.min(1, Math.max(0, g)) * 255);
	const b8 = Math.round(Math.min(1, Math.max(0, b)) * 255);
	if (alpha < 1) {
		const a8 = Math.round(alpha * 255);
		const hex = ((r8 << 24) | (g8 << 16) | (b8 << 8) | a8) >>> 0;
		return `0x${hex.toString(16).padStart(8, '0').toUpperCase()}`;
	}
	const hex = ((r8 << 16) | (g8 << 8) | b8).toString(16).padStart(6, '0').toUpperCase();
	return `0x${hex}`;
}
