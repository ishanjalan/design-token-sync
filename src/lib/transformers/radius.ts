/**
 * Radius Transformer
 *
 * Generates border-radius/corner-radius tokens from Figma number exports where
 * the token path contains "radius", "corner", or "round".
 *
 * Outputs per-platform: SCSS variables, Swift enum, Kotlin object.
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { pathToKebab, pathToCamel, pathToPascal, extractNumericKey, fileHeaderLines } from './shared.js';

interface RadiusEntry {
	name: string;
	value: number;
	sortKey: number;
}

const RADIUS_PATH_KEYWORDS = ['radius', 'corner', 'round'];

function pathMatchesRadius(path: string[]): boolean {
	const pathStr = path.join(' ').toLowerCase();
	return RADIUS_PATH_KEYWORDS.some((kw) => pathStr.includes(kw));
}

export function transformToRadius(
	tokenExport: Record<string, unknown>,
	platforms: Platform[]
): TransformResult[] {
	const entries = collectRadiusTokens(tokenExport);
	if (entries.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		results.push(generateRadiusScss(entries));
	}
	if (platforms.includes('ios')) {
		results.push(generateRadiusSwift(entries));
	}
	if (platforms.includes('android')) {
		results.push(generateRadiusKotlin(entries));
	}

	return results;
}

export function countRadiusTokens(tokenExport: Record<string, unknown>): number {
	return collectRadiusTokens(tokenExport).length;
}

function collectRadiusTokens(obj: unknown, path: string[] = []): RadiusEntry[] {
	if (!obj || typeof obj !== 'object') return [];
	const o = obj as Record<string, unknown>;

	if (o.$type === 'number' && typeof o.$value === 'number') {
		if (!pathMatchesRadius(path)) return [];

		const value = o.$value as number;
		return [
			{
				name: pathToKebab(path),
				value,
				sortKey: path.length > 0 ? extractNumericKey(path[path.length - 1]) : value
			}
		];
	}

	const results: RadiusEntry[] = [];
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) {
			results.push(...collectRadiusTokens(val, [...path, key]));
		}
	}
	return results;
}

// ─── SCSS Output ──────────────────────────────────────────────────────────────

function generateRadiusScss(entries: RadiusEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.value - b.value);
	const lines: string[] = [
		'// Radius.scss',
		...fileHeaderLines('//', true),
		'',
		'// Corner radius scale — SCSS variables'
	];

	for (const e of sorted) {
		lines.push(`$radius-${e.name}: ${e.value}px;`);
	}
	lines.push('');
	lines.push(':root {');
	for (const e of sorted) {
		lines.push(`  --radius-${e.name}: #{$radius-${e.name}};`);
	}
	lines.push('}');
	lines.push('');

	return {
		filename: 'Radius.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}

// ─── Swift Output ─────────────────────────────────────────────────────────────

function generateRadiusSwift(entries: RadiusEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.value - b.value);
	const lines: string[] = [
		'// CornerRadius.swift',
		...fileHeaderLines('//', true),
		'',
		'import CoreGraphics',
		'',
		'public enum CornerRadius {'
	];

	for (const e of sorted) {
		const camel = pathToCamel(e.name.split('-'));
		lines.push(`  public static let ${camel}: CGFloat = ${e.value}`);
	}
	lines.push('}');
	lines.push('');

	return {
		filename: 'CornerRadius.swift',
		content: lines.join('\n') + '\n',
		format: 'swift',
		platform: 'ios'
	};
}

// ─── Kotlin Output ────────────────────────────────────────────────────────────

function generateRadiusKotlin(entries: RadiusEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.value - b.value);
	const lines: string[] = [
		'// CornerRadius.kt',
		...fileHeaderLines('//', true),
		'',
		'package com.example.design // TODO: update to your package name',
		'',
		'import androidx.compose.ui.unit.dp',
		'',
		'object CornerRadius {'
	];

	for (const e of sorted) {
		const pascal = pathToPascal(e.name.split('-'));
		lines.push(`    val ${pascal} = ${e.value}.dp`);
	}
	lines.push('}');
	lines.push('');

	return {
		filename: 'CornerRadius.kt',
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}
