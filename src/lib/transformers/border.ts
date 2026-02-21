/**
 * Border Transformer
 *
 * Generates border tokens from Figma border exports ($type: "border").
 * Outputs per-platform: SCSS/CSS border shorthand, Swift BorderStroke, Kotlin BorderStroke.
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';
import { pathToKebab, pathToCamel, extractNumericKey } from './shared.js';

interface BorderEntry {
	name: string;
	width: number;
	style: string;
	colorHex: string;
	sortKey: number;
}

export function transformToBorders(
	tokenExport: Record<string, unknown>,
	platforms: Platform[]
): TransformResult[] {
	const entries = collectBorderTokens(tokenExport);
	if (entries.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		results.push(generateBorderScss(entries));
	}
	if (platforms.includes('ios')) {
		results.push(generateBorderSwift(entries));
	}
	if (platforms.includes('android')) {
		results.push(generateBorderKotlin(entries));
	}

	return results;
}

export function countBorderTokens(tokenExport: Record<string, unknown>): number {
	return collectBorderTokens(tokenExport).length;
}

function collectBorderTokens(
	obj: unknown,
	path: string[] = []
): BorderEntry[] {
	if (!obj || typeof obj !== 'object') return [];
	const o = obj as Record<string, unknown>;

	if (o.$type === 'border' && o.$value && typeof o.$value === 'object') {
		const v = o.$value as Record<string, unknown>;
		const color = v.color as Record<string, unknown> | undefined;
		if (!color) return [];

		const components = color.components as [number, number, number];
		const alpha = (color.alpha as number) ?? 1;

		return [
			{
				name: pathToKebab(path),
				width: (v.width as number) ?? 1,
				style: (v.style as string) ?? 'solid',
				colorHex: figmaToHex(components[0], components[1], components[2], alpha),
				sortKey: path.length > 0 ? extractNumericKey(path[path.length - 1]) : 0
			}
		];
	}

	const results: BorderEntry[] = [];
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) {
			results.push(...collectBorderTokens(val, [...path, key]));
		}
	}
	return results;
}

// ─── SCSS Output ──────────────────────────────────────────────────────────────

function generateBorderScss(entries: BorderEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
	const lines: string[] = [
		'// Borders.scss',
		'// Auto-generated from Figma Variables — DO NOT EDIT',
		`// Generated: ${new Date().toISOString()}`,
		''
	];

	for (const e of sorted) {
		lines.push(`$border-${e.name}: ${e.width}px ${e.style} ${e.colorHex};`);
	}
	lines.push('');

	lines.push(':root {');
	for (const e of sorted) {
		lines.push(`  --border-${e.name}: #{$border-${e.name}};`);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Borders.scss', content: lines.join('\n') + '\n', format: 'scss', platform: 'web' };
}

// ─── Swift Output ─────────────────────────────────────────────────────────────

function generateBorderSwift(entries: BorderEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
	const lines: string[] = [
		'// Borders.swift',
		'// Auto-generated from Figma Variables — DO NOT EDIT',
		`// Generated: ${new Date().toISOString()}`,
		'',
		'import SwiftUI',
		'',
		'public struct BorderToken {',
		'  public let width: CGFloat',
		'  public let color: Color',
		'}',
		'',
		'public extension BorderToken {'
	];

	for (const e of sorted) {
		const camel = pathToCamel(e.name.split('-'));
		const hexUpper = e.colorHex.replace('#', '').toUpperCase();
		lines.push(
			`  static let ${camel} = BorderToken(width: ${e.width}, color: Color(hex: 0x${hexUpper.slice(0, 6)}))`
		);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Borders.swift', content: lines.join('\n') + '\n', format: 'swift', platform: 'ios' };
}

// ─── Kotlin Output ────────────────────────────────────────────────────────────

function generateBorderKotlin(entries: BorderEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
	const lines: string[] = [
		'// Borders.kt',
		'// Auto-generated from Figma Variables — DO NOT EDIT',
		`// Generated: ${new Date().toISOString()}`,
		'',
		'package com.example.design // TODO: update to your package name',
		'',
		'import androidx.compose.foundation.BorderStroke',
		'import androidx.compose.ui.graphics.Color',
		'import androidx.compose.ui.unit.dp',
		'',
		'object Borders {'
	];

	for (const e of sorted) {
		const camel = pathToCamel(e.name.split('-'));
		const hexUpper = e.colorHex.replace('#', '').toUpperCase();
		lines.push(
			`    val ${camel} = BorderStroke(${e.width}.dp, Color(0xFF${hexUpper.slice(0, 6)}))`
		);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Borders.kt', content: lines.join('\n') + '\n', format: 'kotlin', platform: 'android' };
}
