/**
 * Opacity Transformer
 *
 * Generates opacity tokens from Figma number exports where the token path
 * contains "opacity" (case-insensitive).
 *
 * Outputs per-platform: SCSS/CSS opacity values, Swift .opacity(), Kotlin alpha.
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { pathToKebab, pathToCamel, fileHeaderLines } from './shared.js';

interface OpacityEntry {
	name: string;
	value: number; // 0–1 or 0–100 (normalized to 0–1)
	sortKey: number;
}

export function transformToOpacity(
	valuesExport: Record<string, unknown>,
	platforms: Platform[]
): TransformResult[] {
	const entries = collectOpacityTokens(valuesExport);
	if (entries.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		results.push(generateOpacityScss(entries));
	}
	if (platforms.includes('ios')) {
		results.push(generateOpacitySwift(entries));
	}
	if (platforms.includes('android')) {
		results.push(generateOpacityKotlin(entries));
	}

	return results;
}

export function countOpacityTokens(valuesExport: Record<string, unknown>): number {
	return collectOpacityTokens(valuesExport).length;
}

function collectOpacityTokens(
	obj: unknown,
	path: string[] = []
): OpacityEntry[] {
	if (!obj || typeof obj !== 'object') return [];
	const o = obj as Record<string, unknown>;

	if (o.$type === 'number' && typeof o.$value === 'number') {
		const isOpacity = path.some((p) => p.toLowerCase().includes('opacity'));
		if (!isOpacity) return [];

		let value = o.$value as number;
		if (value > 1) value = value / 100; // normalize 0–100 to 0–1

		return [
			{
				name: pathToKebab(path),
				value: Math.round(value * 1000) / 1000,
				sortKey: value * 1000
			}
		];
	}

	const results: OpacityEntry[] = [];
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) {
			results.push(...collectOpacityTokens(val, [...path, key]));
		}
	}
	return results;
}

// ─── SCSS Output ──────────────────────────────────────────────────────────────

function generateOpacityScss(entries: OpacityEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey);
	const lines: string[] = [
		'// Opacity.scss',
		...fileHeaderLines('//', true),
		''
	];

	for (const e of sorted) {
		lines.push(`$${e.name}: ${e.value};`);
	}
	lines.push('');

	lines.push(':root {');
	for (const e of sorted) {
		lines.push(`  --${e.name}: #{$${e.name}};`);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Opacity.scss', content: lines.join('\n') + '\n', format: 'scss', platform: 'web' };
}

// ─── Swift Output ─────────────────────────────────────────────────────────────

function generateOpacitySwift(entries: OpacityEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey);
	const lines: string[] = [
		'// Opacity.swift',
		...fileHeaderLines('//', true),
		'',
		'import Foundation',
		'',
		'public enum Opacity {'
	];

	for (const e of sorted) {
		const camel = pathToCamel(e.name.split('-'));
		lines.push(`  public static let ${camel}: Double = ${e.value}`);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Opacity.swift', content: lines.join('\n') + '\n', format: 'swift', platform: 'ios' };
}

// ─── Kotlin Output ────────────────────────────────────────────────────────────

function generateOpacityKotlin(entries: OpacityEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey);
	const lines: string[] = [
		'// Opacity.kt',
		...fileHeaderLines('//', true),
		'',
		'package com.example.design // TODO: update to your package name',
		'',
		'object Opacity {'
	];

	for (const e of sorted) {
		const camel = pathToCamel(e.name.split('-'));
		lines.push(`    val ${camel} = ${e.value}f`);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Opacity.kt', content: lines.join('\n') + '\n', format: 'kotlin', platform: 'android' };
}
