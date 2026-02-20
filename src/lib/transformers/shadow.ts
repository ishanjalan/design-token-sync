/**
 * Shadow Transformer
 *
 * Generates elevation/shadow tokens from Figma shadow exports ($type: "shadow").
 * Outputs per-platform: SCSS/CSS box-shadow, Swift NSShadow, Kotlin Modifier.shadow.
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';

interface ShadowEntry {
	name: string;
	offsetX: number;
	offsetY: number;
	blur: number;
	spread: number;
	colorHex: string;
	alpha: number;
	sortKey: number;
}

export function transformToShadows(
	tokenExport: Record<string, unknown>,
	platforms: Platform[]
): TransformResult[] {
	const entries = collectShadowTokens(tokenExport);
	if (entries.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		results.push(generateShadowScss(entries));
	}
	if (platforms.includes('ios')) {
		results.push(generateShadowSwift(entries));
	}
	if (platforms.includes('android')) {
		results.push(generateShadowKotlin(entries));
	}

	return results;
}

export function countShadowTokens(tokenExport: Record<string, unknown>): number {
	return collectShadowTokens(tokenExport).length;
}

function collectShadowTokens(
	obj: unknown,
	path: string[] = []
): ShadowEntry[] {
	if (!obj || typeof obj !== 'object') return [];
	const o = obj as Record<string, unknown>;

	if (o.$type === 'shadow' && o.$value && typeof o.$value === 'object') {
		const v = o.$value as Record<string, unknown>;
		const color = v.color as Record<string, unknown> | undefined;
		if (!color) return [];

		const components = color.components as [number, number, number];
		const alpha = (color.alpha as number) ?? 1;

		return [
			{
				name: pathToKebab(path),
				offsetX: (v.offsetX as number) ?? 0,
				offsetY: (v.offsetY as number) ?? 0,
				blur: (v.blur as number) ?? 0,
				spread: (v.spread as number) ?? 0,
				colorHex: figmaToHex(components[0], components[1], components[2], alpha),
				alpha,
				sortKey: path.length > 0 ? extractNumericKey(path[path.length - 1]) : 0
			}
		];
	}

	const results: ShadowEntry[] = [];
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) {
			results.push(...collectShadowTokens(val, [...path, key]));
		}
	}
	return results;
}

function pathToKebab(path: string[]): string {
	return path
		.map((p) =>
			p
				.replace(/_/g, '-')
				.replace(/([a-z])([A-Z])/g, '$1-$2')
				.toLowerCase()
		)
		.join('-');
}

function pathToCamel(path: string[]): string {
	const kebab = pathToKebab(path);
	return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function pathToPascal(path: string[]): string {
	const camel = pathToCamel(path);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function extractNumericKey(s: string): number {
	const m = s.match(/\d+/);
	return m ? parseInt(m[0]) : 0;
}

// ─── SCSS Output ──────────────────────────────────────────────────────────────

function generateShadowScss(entries: ShadowEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
	const lines: string[] = [
		'// Shadows.scss',
		'// Auto-generated from Figma Variables — DO NOT EDIT',
		`// Generated: ${new Date().toISOString()}`,
		''
	];

	for (const e of sorted) {
		lines.push(
			`$shadow-${e.name}: ${e.offsetX}px ${e.offsetY}px ${e.blur}px ${e.spread}px ${e.colorHex};`
		);
	}
	lines.push('');

	lines.push(':root {');
	for (const e of sorted) {
		lines.push(`  --shadow-${e.name}: #{$shadow-${e.name}};`);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Shadows.scss', content: lines.join('\n') + '\n', format: 'scss', platform: 'web' };
}

// ─── Swift Output ─────────────────────────────────────────────────────────────

function generateShadowSwift(entries: ShadowEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
	const lines: string[] = [
		'// Shadows.swift',
		'// Auto-generated from Figma Variables — DO NOT EDIT',
		`// Generated: ${new Date().toISOString()}`,
		'',
		'import SwiftUI',
		'',
		'public struct ShadowToken {',
		'  public let color: Color',
		'  public let radius: CGFloat',
		'  public let x: CGFloat',
		'  public let y: CGFloat',
		'}',
		'',
		'public extension ShadowToken {'
	];

	for (const e of sorted) {
		const camel = pathToCamel(e.name.split('-'));
		lines.push(
			`  static let ${camel} = ShadowToken(color: Color(hex: 0x${e.colorHex.replace('#', '').toUpperCase()}), radius: ${e.blur}, x: ${e.offsetX}, y: ${e.offsetY})`
		);
	}
	lines.push('}');
	lines.push('');

	return { filename: 'Shadows.swift', content: lines.join('\n') + '\n', format: 'swift', platform: 'ios' };
}

// ─── Kotlin Output ────────────────────────────────────────────────────────────

function generateShadowKotlin(entries: ShadowEntry[]): TransformResult {
	const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
	const lines: string[] = [
		'// Shadows.kt',
		'// Auto-generated from Figma Variables — DO NOT EDIT',
		`// Generated: ${new Date().toISOString()}`,
		'',
		'package com.example.design // TODO: update to your package name',
		'',
		'import androidx.compose.ui.Modifier',
		'import androidx.compose.ui.draw.shadow',
		'import androidx.compose.ui.graphics.Color',
		'import androidx.compose.ui.unit.dp',
		'import androidx.compose.foundation.shape.RoundedCornerShape',
		'',
		'object Shadows {'
	];

	for (const e of sorted) {
		const pascal = pathToPascal(e.name.split('-'));
		const hexUpper = e.colorHex.replace('#', '').toUpperCase();
		const alphaHex = Math.round(e.alpha * 255)
			.toString(16)
			.padStart(2, '0')
			.toUpperCase();
		lines.push(
			`    val ${pascal} = ShadowSpec(elevation = ${e.blur}.dp, color = Color(0x${alphaHex}${hexUpper.slice(0, 6)}))`
		);
	}
	lines.push('}');
	lines.push('');
	lines.push('data class ShadowSpec(');
	lines.push('    val elevation: androidx.compose.ui.unit.Dp,');
	lines.push('    val color: Color,');
	lines.push(')');
	lines.push('');

	return { filename: 'Shadows.kt', content: lines.join('\n') + '\n', format: 'kotlin', platform: 'android' };
}
