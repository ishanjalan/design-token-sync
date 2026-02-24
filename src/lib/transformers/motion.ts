/**
 * Motion Transformer
 *
 * Generates motion/animation tokens from Figma exports: duration (number) and
 * easing (string) tokens where the path contains "duration", "delay", "easing",
 * "transition", "animation", or "motion".
 *
 * Outputs per-platform: SCSS variables, Swift enum, Kotlin object.
 */

import type { TransformResult, Platform } from '$lib/types.js';
import { pathToKebab, pathToCamel, pathToPascal, extractNumericKey, fileHeaderLines } from './shared.js';

const MOTION_PATH_KEYWORDS = ['duration', 'delay', 'easing', 'transition', 'animation', 'motion'];

function pathMatchesMotion(path: string[]): boolean {
	const pathStr = path.join(' ').toLowerCase();
	return MOTION_PATH_KEYWORDS.some((kw) => pathStr.includes(kw));
}

interface DurationEntry {
	name: string;
	shortName: string;
	valueMs: number;
	sortKey: number;
}

interface EasingEntry {
	name: string;
	shortName: string;
	value: string;
	cubicBezier: [number, number, number, number] | null;
	sortKey: number;
}

function shortNameForMotion(path: string[], name: string): string {
	const last = path[path.length - 1] ?? name.split('-').pop() ?? name;
	return pathToPascal([last]);
}

function parseCubicBezier(s: string): [number, number, number, number] | null {
	const m = s.match(/cubic-bezier\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i);
	if (!m) return null;
	const [, x1, y1, x2, y2] = m;
	return [parseFloat(x1), parseFloat(y1), parseFloat(x2), parseFloat(y2)];
}

export function transformToMotion(
	tokenExport: Record<string, unknown>,
	platforms: Platform[]
): TransformResult[] {
	const { durations, easings } = collectMotionTokens(tokenExport);
	if (durations.length === 0 && easings.length === 0) return [];

	const results: TransformResult[] = [];

	if (platforms.includes('web')) {
		results.push(generateMotionScss(durations, easings));
	}
	if (platforms.includes('ios')) {
		results.push(generateMotionSwift(durations, easings));
	}
	if (platforms.includes('android')) {
		results.push(generateMotionKotlin(durations, easings));
	}

	return results;
}

export function countMotionTokens(tokenExport: Record<string, unknown>): number {
	const { durations, easings } = collectMotionTokens(tokenExport);
	return durations.length + easings.length;
}

function collectMotionTokens(
	obj: unknown,
	path: string[] = []
): { durations: DurationEntry[]; easings: EasingEntry[] } {
	const durations: DurationEntry[] = [];
	const easings: EasingEntry[] = [];

	if (!obj || typeof obj !== 'object') return { durations, easings };
	const o = obj as Record<string, unknown>;

	if (o.$type === 'number' && typeof o.$value === 'number') {
		if (!pathMatchesMotion(path)) return { durations, easings };

		const value = o.$value as number;
		const valueMs = value >= 0 && value < 10 ? value * 1000 : value;
		const name = pathToKebab(path);
		durations.push({
			name,
			shortName: shortNameForMotion(path, name),
			valueMs: Math.round(valueMs),
			sortKey: path.length > 0 ? extractNumericKey(path[path.length - 1]) : valueMs
		});
		return { durations, easings };
	}

	if (o.$type === 'string' && typeof o.$value === 'string') {
		if (!pathMatchesMotion(path)) return { durations, easings };

		const value = o.$value as string;
		const name = pathToKebab(path);
		easings.push({
			name,
			shortName: shortNameForMotion(path, name),
			value,
			cubicBezier: parseCubicBezier(value),
			sortKey: path.length > 0 ? extractNumericKey(path[path.length - 1]) : 0
		});
		return { durations, easings };
	}

	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) {
			const child = collectMotionTokens(val, [...path, key]);
			durations.push(...child.durations);
			easings.push(...child.easings);
		}
	}
	return { durations, easings };
}

// ─── SCSS Output ──────────────────────────────────────────────────────────────

function generateMotionScss(durations: DurationEntry[], easings: EasingEntry[]): TransformResult {
	const sortedDurations = [...durations].sort((a, b) => a.sortKey - b.sortKey || a.valueMs - b.valueMs);
	const sortedEasings = [...easings].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

	const lines: string[] = [
		'// Motion.scss',
		...fileHeaderLines('//', true),
		'',
		'// Duration (ms)'
	];

	for (const e of sortedDurations) {
		lines.push(`$duration-${e.name}: ${e.valueMs}ms;`);
	}
	if (sortedDurations.length > 0) lines.push('');

	if (sortedEasings.length > 0) {
		lines.push('// Easing');
		for (const e of sortedEasings) {
			lines.push(`$easing-${e.name}: ${e.value};`);
		}
		lines.push('');
	}

	lines.push(':root {');
	for (const e of sortedDurations) {
		lines.push(`  --duration-${e.name}: #{$duration-${e.name}};`);
	}
	for (const e of sortedEasings) {
		lines.push(`  --easing-${e.name}: #{$easing-${e.name}};`);
	}
	lines.push('}');
	lines.push('');

	return {
		filename: 'Motion.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}

// ─── Swift Output ─────────────────────────────────────────────────────────────

function generateMotionSwift(durations: DurationEntry[], easings: EasingEntry[]): TransformResult {
	const sortedDurations = [...durations].sort((a, b) => a.sortKey - b.sortKey || a.valueMs - b.valueMs);
	const sortedEasings = [...easings].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

	const lines: string[] = [
		'// MotionTokens.swift',
		...fileHeaderLines('//', true),
		'',
		'import SwiftUI',
		'',
		'public enum MotionTokens {'
	];

	for (const e of sortedDurations) {
		const pascal = e.shortName;
		lines.push(`  public static let duration${pascal}: TimeInterval = ${(e.valueMs / 1000).toFixed(2)}`);
	}

	for (const e of sortedEasings) {
		const pascal = e.shortName;
		if (e.cubicBezier) {
			const [x1, y1, x2, y2] = e.cubicBezier;
			lines.push(`  public static let easing${pascal}: Animation = .timingCurve(${x1}, ${y1}, ${x2}, ${y2})`);
		} else {
			lines.push(`  public static let easing${pascal}: String = "${e.value}"`);
		}
	}

	lines.push('}');
	lines.push('');

	return {
		filename: 'MotionTokens.swift',
		content: lines.join('\n') + '\n',
		format: 'swift',
		platform: 'ios'
	};
}

// ─── Kotlin Output ────────────────────────────────────────────────────────────

function generateMotionKotlin(durations: DurationEntry[], easings: EasingEntry[]): TransformResult {
	const sortedDurations = [...durations].sort((a, b) => a.sortKey - b.sortKey || a.valueMs - b.valueMs);
	const sortedEasings = [...easings].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

	const lines: string[] = [
		'// MotionTokens.kt',
		...fileHeaderLines('//', true),
		'',
		'package com.example.design // TODO: update to your package name',
		'',
		'import androidx.compose.animation.core.CubicBezierEasing',
		'',
		'object MotionTokens {'
	];

	for (const e of sortedDurations) {
		const pascal = e.shortName;
		lines.push(`    val Duration${pascal} = ${e.valueMs}`);
	}

	for (const e of sortedEasings) {
		const pascal = e.shortName;
		if (e.cubicBezier) {
			const [x1, y1, x2, y2] = e.cubicBezier;
			lines.push(`    val Easing${pascal} = CubicBezierEasing(${x1}f, ${y1}f, ${x2}f, ${y2}f)`);
		} else {
			lines.push(`    val Easing${pascal} = "${e.value}"`);
		}
	}

	lines.push('}');
	lines.push('');

	return {
		filename: 'MotionTokens.kt',
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}
