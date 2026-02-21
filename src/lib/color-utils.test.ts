import { describe, it, expect } from 'vitest';
import { figmaToHex, figmaToKotlinHex, figmaToSwiftHex } from './color-utils.js';

describe('figmaToHex', () => {
	it('returns 6-digit hex for opaque colors', () => {
		const hex = figmaToHex(1, 1, 1);
		expect(hex).toBe('#ffffff');
	});

	it('returns 6-digit hex for black', () => {
		expect(figmaToHex(0, 0, 0)).toBe('#000000');
	});

	it('returns 8-digit hex for alpha < 1', () => {
		const hex = figmaToHex(1, 1, 1, 0.5);
		expect(hex).toMatch(/^#[0-9a-f]{8}$/);
		expect(hex).toContain('80'); // ~50% alpha
	});
});

describe('figmaToKotlinHex', () => {
	it('returns 0xFFRRGGBB for opaque colors', () => {
		expect(figmaToKotlinHex(1, 1, 1)).toBe('0xFFFFFFFF');
		expect(figmaToKotlinHex(0, 0, 0)).toBe('0xFF000000');
	});

	it('returns 0xAARRGGBB for alpha colors', () => {
		const hex = figmaToKotlinHex(0, 0, 0, 0.5);
		expect(hex).toMatch(/^0x80/);
	});

	it('clamps values to 0-1 range', () => {
		expect(figmaToKotlinHex(-0.5, 1.5, 0.5)).toBe('0xFF00FF80');
	});
});

describe('figmaToSwiftHex', () => {
	it('returns 0xRRGGBB for opaque colors', () => {
		expect(figmaToSwiftHex(1, 1, 1)).toBe('0xFFFFFF');
		expect(figmaToSwiftHex(0, 0, 0)).toBe('0x000000');
	});

	it('returns 0xRRGGBBAA for alpha colors', () => {
		const hex = figmaToSwiftHex(1, 1, 1, 0.5);
		expect(hex).toMatch(/^0x[0-9A-F]{8}$/);
		expect(hex).toMatch(/80$/); // ~50% alpha at the end
	});

	it('uses 6-digit format when alpha is exactly 1', () => {
		const hex = figmaToSwiftHex(0.5, 0.5, 0.5, 1);
		expect(hex).toMatch(/^0x[0-9A-F]{6}$/);
	});
});
