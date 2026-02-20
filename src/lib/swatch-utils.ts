import type { GeneratedFile } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Swatch {
	name: string;
	hex: string;
	family: string;
}

export interface SwatchComparison {
	name: string;
	oldHex?: string;
	newHex?: string;
	status: 'changed' | 'new' | 'removed';
}

// ─── Swatch Parsing ───────────────────────────────────────────────────────────

export function parseSwatches(json: unknown): Swatch[] {
	const seen = new Map<string, Swatch>();

	function walk(obj: unknown) {
		if (!obj || typeof obj !== 'object') return;
		const o = obj as Record<string, unknown>;
		if (o.$type === 'color' && o.$value && typeof o.$value === 'object') {
			const v = o.$value as Record<string, unknown>;
			const aliasData = (o.$extensions as Record<string, unknown> | undefined)?.[
				'com.figma.aliasData'
			] as Record<string, unknown> | undefined;
			const targetName = aliasData?.targetVariableName as string | undefined;

			if (targetName && typeof v.hex === 'string' && !seen.has(targetName)) {
				const parts = targetName.split('/');
				const family = (parts[1] ?? parts[0] ?? '').toLowerCase().replace(/\s+/g, '-');
				seen.set(targetName, { name: targetName, hex: v.hex, family });
			} else if (!aliasData && typeof v.hex === 'string') {
				const rawName = o.$extensions
					? String(
							(o.$extensions as Record<string, unknown>)['com.figma.variableId'] ??
								targetName ??
								'unknown'
						)
					: 'raw';
				if (!seen.has(rawName)) {
					seen.set(rawName, { name: rawName, hex: v.hex, family: 'primitives' });
				}
			}
			return;
		}
		for (const [k, val] of Object.entries(o)) {
			if (!k.startsWith('$')) walk(val);
		}
	}

	walk(json);
	return [...seen.values()].sort((a, b) =>
		a.family !== b.family ? a.family.localeCompare(b.family) : a.name.localeCompare(b.name)
	);
}

// ─── Swatch Comparison ────────────────────────────────────────────────────────

function parseReferenceColors(content: string, format: string): { name: string; hex: string }[] {
	const colors: { name: string; hex: string }[] = [];
	const lines = content.split('\n');
	for (const line of lines) {
		let m: RegExpMatchArray | null = null;
		if (format === 'scss') {
			m = line.match(/\$([\w-]+)\s*:\s*#([0-9a-fA-F]{3,8})/);
		} else if (format === 'typescript') {
			m = line.match(/export\s+const\s+(\w+)\s*=\s*['"]#([0-9a-fA-F]{3,8})['"]/);
		} else if (format === 'swift') {
			m = line.match(/static\s+let\s+(\w+)\s*=\s*Color\(hex:\s*"#?([0-9a-fA-F]{3,8})"\)/);
		} else if (format === 'kotlin') {
			m = line.match(/val\s+(\w+)\s*=\s*Color\(0x([0-9a-fA-F]{8})\)/);
		}
		if (m) colors.push({ name: m[1], hex: `#${m[2]}` });
	}
	return colors;
}

export function computeSwatchComparison(files: GeneratedFile[]): SwatchComparison[] {
	const comparisons: SwatchComparison[] = [];
	for (const file of files) {
		if (!file.referenceContent) continue;
		const oldColors = parseReferenceColors(file.referenceContent, file.format);
		const newColors = parseReferenceColors(file.content, file.format);
		const oldMap = new Map(oldColors.map((c) => [c.name, c.hex]));
		const newMap = new Map(newColors.map((c) => [c.name, c.hex]));
		for (const [name, hex] of newMap) {
			const oldHex = oldMap.get(name);
			if (!oldHex) {
				comparisons.push({ name, newHex: hex, status: 'new' });
			} else if (oldHex.toLowerCase() !== hex.toLowerCase()) {
				comparisons.push({ name, oldHex, newHex: hex, status: 'changed' });
			}
		}
		for (const [name, hex] of oldMap) {
			if (!newMap.has(name)) {
				comparisons.push({ name, oldHex: hex, status: 'removed' });
			}
		}
	}
	return comparisons;
}
