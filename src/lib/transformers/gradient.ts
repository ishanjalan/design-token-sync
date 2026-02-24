/**
 * Gradient token transformer.
 *
 * Collects gradient tokens ($type === 'gradient') from Figma token exports
 * and generates platform-specific gradient definitions.
 */

import type { Platform, TransformResult } from '$lib/types.js';
import { figmaToHex } from '$lib/color-utils.js';
import { fileHeaderLines } from './shared.js';

interface GradientStop {
	color: { r: number; g: number; b: number; a: number };
	position: number;
}

interface GradientToken {
	name: string;
	type: 'linear' | 'radial' | 'angular';
	angle?: number;
	stops: GradientStop[];
}

// ─── Collector ───────────────────────────────────────────────────────────────

function collectGradientTokens(
	obj: Record<string, unknown>,
	path: string[] = []
): GradientToken[] {
	const results: GradientToken[] = [];

	for (const [key, val] of Object.entries(obj)) {
		if (key.startsWith('$') || !val || typeof val !== 'object') continue;
		const node = val as Record<string, unknown>;

		if (node.$type === 'gradient' && Array.isArray(node.$value)) {
			const stops: GradientStop[] = [];
			for (const s of node.$value as Record<string, unknown>[]) {
				if (s.color && typeof s.position === 'number') {
					stops.push({
						color: s.color as GradientStop['color'],
						position: s.position as number
					});
				}
			}
			if (stops.length >= 2) {
				results.push({
					name: [...path, key].join('/'),
					type: (node.$extensions as Record<string, unknown>)?.gradientType as GradientToken['type'] ?? 'linear',
					angle: typeof (node.$extensions as Record<string, unknown>)?.angle === 'number'
						? (node.$extensions as Record<string, unknown>).angle as number
						: 180,
					stops
				});
			}
		} else {
			results.push(...collectGradientTokens(node, [...path, key]));
		}
	}

	return results;
}

export function countGradientTokens(obj: Record<string, unknown>): number {
	return collectGradientTokens(obj).length;
}

// ─── Name Helpers ────────────────────────────────────────────────────────────

function toKebab(name: string): string {
	return name
		.replace(/\//g, '-')
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.toLowerCase();
}

function toCamel(name: string): string {
	return toKebab(name)
		.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascal(name: string): string {
	const camel = toCamel(name);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// ─── Generators ──────────────────────────────────────────────────────────────

function stopToCSS(stop: GradientStop): string {
	const hex = figmaToHex(stop.color.r, stop.color.g, stop.color.b, stop.color.a);
	const pct = (stop.position * 100).toFixed(0);
	return `${hex} ${pct}%`;
}

function generateGradientScss(tokens: GradientToken[]): string {
	const lines: string[] = [];
	lines.push(...fileHeaderLines('//', true));
	lines.push('');
	for (const t of tokens) {
		const name = toKebab(t.name);
		const angle = t.angle ?? 180;
		const stops = t.stops.map(stopToCSS).join(', ');
		lines.push(`$gradient-${name}: linear-gradient(${angle}deg, ${stops});`);
	}
	return lines.join('\n') + '\n';
}

function generateGradientSwift(tokens: GradientToken[]): string {
	const lines: string[] = [];
	lines.push(...fileHeaderLines('//', true));
	lines.push('');
	lines.push('import SwiftUI');
	lines.push('');
	lines.push('public enum GradientTokens {');
	for (const t of tokens) {
		const name = toCamel(t.name);
		const angle = t.angle ?? 180;
		const startPoint = angle === 0 ? '.bottom' : angle === 90 ? '.leading' : angle === 180 ? '.top' : '.trailing';
		const endPoint = angle === 0 ? '.top' : angle === 90 ? '.trailing' : angle === 180 ? '.bottom' : '.leading';
		const stops = t.stops.map(s => {
			const hex = figmaToHex(s.color.r, s.color.g, s.color.b, s.color.a);
			return `.init(color: Color(hex: "${hex}"), location: ${s.position.toFixed(2)})`;
		}).join(',\n            ');
		lines.push(`    static let ${name} = LinearGradient(`);
		lines.push(`        stops: [`);
		lines.push(`            ${stops}`);
		lines.push(`        ],`);
		lines.push(`        startPoint: ${startPoint},`);
		lines.push(`        endPoint: ${endPoint}`);
		lines.push(`    )`);
		lines.push('');
	}
	lines.push('}');
	return lines.join('\n') + '\n';
}

function generateGradientKotlin(tokens: GradientToken[]): string {
	const lines: string[] = [];
	lines.push(...fileHeaderLines('//', true));
	lines.push('');
	lines.push('import androidx.compose.ui.graphics.Brush');
	lines.push('import androidx.compose.ui.graphics.Color');
	lines.push('');
	lines.push('object GradientTokens {');
	for (const t of tokens) {
		const name = toPascal(t.name);
		const stops = t.stops.map(s => {
			const hex = figmaToHex(s.color.r, s.color.g, s.color.b, s.color.a).replace('#', '');
			return `${s.position.toFixed(2)}f to Color(0xFF${hex.toUpperCase()})`;
		}).join(',\n        ');
		lines.push(`    val ${name} = Brush.linearGradient(`);
		lines.push(`        colorStops = arrayOf(`);
		lines.push(`            ${stops}`);
		lines.push(`        )`);
		lines.push(`    )`);
		lines.push('');
	}
	lines.push('}');
	return lines.join('\n') + '\n';
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function transformToGradients(
	tokenExport: Record<string, unknown>,
	platforms: Platform[]
): TransformResult[] {
	const tokens = collectGradientTokens(tokenExport);
	if (tokens.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		results.push({
			filename: '_Gradients.scss',
			content: generateGradientScss(tokens),
			format: 'scss',
			platform: 'web'
		});
	}

	if (platforms.includes('ios')) {
		results.push({
			filename: 'GradientTokens.swift',
			content: generateGradientSwift(tokens),
			format: 'swift',
			platform: 'ios'
		});
	}

	if (platforms.includes('android')) {
		results.push({
			filename: 'GradientTokens.kt',
			content: generateGradientKotlin(tokens),
			format: 'kotlin',
			platform: 'android'
		});
	}

	return results;
}
