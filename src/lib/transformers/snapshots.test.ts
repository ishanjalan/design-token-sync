/**
 * Snapshot tests for all transformer outputs.
 *
 * Each test calls a transformer with fixed fixtures and snapshots the output.
 * This catches unintentional formatting or structural changes across all
 * generated file variants (SCSS, CSS, TS, Swift, Kotlin, shadows, borders, etc).
 */

import { describe, it, expect } from 'vitest';
import { transformToSCSS } from './scss.js';
import { transformToCSS } from './css.js';
import { transformToTS } from './ts-web.js';
import { transformToSwift } from './swift.js';
import { transformToKotlin } from './kotlin.js';
import { transformToSpacing } from './spacing.js';
import { transformToShadows } from './shadow.js';
import { transformToBorders } from './border.js';
import { transformToOpacity } from './opacity.js';
import { lightColors, darkColors } from './fixtures.js';
import { BEST_PRACTICE_WEB_CONVENTIONS } from '$lib/types.js';
import type { DetectedConventions } from '$lib/types.js';

const strip = (s: string) => s.replace(/Generated: .*/g, 'Generated: [TIMESTAMP]');

const conventions: DetectedConventions = {
	scssPrefix: '$',
	scssSeparator: 'hyphen',
	tsPrefix: 'export const ',
	tsNamingCase: 'screaming_snake',
	importStyle: 'use',
	importSuffix: '',
	scssColorStructure: 'modern',
	hasTypeAnnotations: false,
	tsHexCasing: 'lower',
	tsUsesAsConst: true
};

const valuesExport: Record<string, unknown> = {
	Integer: {
		'4': { $type: 'number', $value: 4 },
		'8': { $type: 'number', $value: 8 },
		'16': { $type: 'number', $value: 16 }
	}
};

const shadowExport: Record<string, unknown> = {
	Elevation: {
		small: {
			$type: 'shadow',
			$value: {
				color: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.12, hex: '#000000' },
				offsetX: 0, offsetY: 1, blur: 3, spread: 0
			}
		},
		large: {
			$type: 'shadow',
			$value: {
				color: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.2, hex: '#000000' },
				offsetX: 0, offsetY: 10, blur: 24, spread: -4
			}
		}
	}
};

const borderExport: Record<string, unknown> = {
	Border: {
		thin: {
			$type: 'border',
			$value: {
				width: 1,
				style: 'solid',
				color: {
					colorSpace: 'srgb',
					components: [0.8, 0.8, 0.8],
					alpha: 1,
					hex: '#cccccc'
				}
			}
		}
	}
};

const opacityExport: Record<string, unknown> = {
	Integer: {
		'50': { $type: 'number', $value: 50 },
		'100': { $type: 'number', $value: 100 }
	}
};

// ─── SCSS ────────────────────────────────────────────────────────────────────

describe('SCSS snapshots', () => {
	it('modern structure (best practices)', () => {
		const results = transformToSCSS(lightColors, darkColors);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-modern`);
		}
	});

	it('inline structure (match-existing)', () => {
		const conv = { ...conventions, scssColorStructure: 'inline' as const };
		const results = transformToSCSS(lightColors, darkColors, conv, undefined, new Map(), () => false, false);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-inline`);
		}
	});

	it('media-query structure (match-existing)', () => {
		const conv = { ...conventions, scssColorStructure: 'media-query' as const };
		const results = transformToSCSS(lightColors, darkColors, conv, undefined, new Map(), () => false, false);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-media-query`);
		}
	});
});

// ─── CSS ─────────────────────────────────────────────────────────────────────

describe('CSS snapshots', () => {
	it('modern structure (best practices)', () => {
		const results = transformToCSS(lightColors, darkColors, conventions);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-modern`);
		}
	});

	it('media-query structure (match-existing)', () => {
		const conv = { ...conventions, scssColorStructure: 'media-query' as const };
		const results = transformToCSS(lightColors, darkColors, conv, undefined, new Map(), () => false, false);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-media-query`);
		}
	});
});

// ─── TypeScript ──────────────────────────────────────────────────────────────

describe('TS snapshots', () => {
	it('best practices', () => {
		const results = transformToTS(lightColors, darkColors, BEST_PRACTICE_WEB_CONVENTIONS);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-bp`);
		}
	});

	it('detected conventions', () => {
		const results = transformToTS(lightColors, darkColors, conventions);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(`${r.filename}-detected`);
		}
	});
});

// ─── Swift ───────────────────────────────────────────────────────────────────

describe('Swift snapshots', () => {
	it('default conventions', () => {
		const r = transformToSwift(lightColors, darkColors);
		expect(strip(r.content)).toMatchSnapshot(r.filename);
	});
});

// ─── Kotlin ──────────────────────────────────────────────────────────────────

describe('Kotlin snapshots', () => {
	it('default conventions', () => {
		const results = transformToKotlin(lightColors, darkColors);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(r.filename);
		}
	});
});

// ─── Spacing ─────────────────────────────────────────────────────────────────

describe('Spacing snapshots', () => {
	it('SCSS + TS', () => {
		const results = transformToSpacing(valuesExport, conventions);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(r.filename);
		}
	});

	it('with type annotations', () => {
		const conv = { ...conventions, hasTypeAnnotations: true };
		const results = transformToSpacing(valuesExport, conv);
		const ts = results.find((r) => r.filename === 'Spacing.ts');
		expect(strip(ts!.content)).toMatchSnapshot('Spacing.ts-typed');
	});
});

// ─── Shadow ──────────────────────────────────────────────────────────────────

describe('Shadow snapshots', () => {
	it('all platforms', () => {
		const results = transformToShadows(shadowExport, ['web', 'ios', 'android']);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(r.filename);
		}
	});
});

// ─── Border ──────────────────────────────────────────────────────────────────

describe('Border snapshots', () => {
	it('all platforms', () => {
		const results = transformToBorders(borderExport, ['web', 'ios', 'android']);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(r.filename);
		}
	});
});

// ─── Opacity ─────────────────────────────────────────────────────────────────

describe('Opacity snapshots', () => {
	it('generates opacity tokens', () => {
		const results = transformToOpacity(opacityExport, ['web', 'ios', 'android']);
		for (const r of results) {
			expect(strip(r.content)).toMatchSnapshot(r.filename);
		}
	});
});
