import type { DropZoneKey } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileInsight {
	count: number;
	label: string;
}

// ─── Figma JSON Validation ────────────────────────────────────────────────────

export function validateFigmaJson(key: DropZoneKey, content: string): string | null {
	const jsonKeys: DropZoneKey[] = ['lightColors', 'darkColors', 'values', 'typography'];
	if (!jsonKeys.includes(key)) return null;
	try {
		const json = JSON.parse(content) as Record<string, unknown>;
		function hasType(obj: unknown, type: string): boolean {
			if (!obj || typeof obj !== 'object') return false;
			const o = obj as Record<string, unknown>;
			if (o.$type === type) return true;
			return Object.entries(o).some(([k, v]) => !k.startsWith('$') && hasType(v, type));
		}
		if (key === 'lightColors' || key === 'darkColors') {
			if (
				!hasType(json, 'color') &&
				!hasType(json, 'shadow') &&
				!hasType(json, 'border')
			)
				return 'No $type: "color", "shadow", or "border" tokens found — is this a Figma export?';
		} else if (key === 'values') {
			if (!hasType(json, 'number'))
				return 'No $type: "number" tokens found — is this a Figma value export?';
		} else if (key === 'typography') {
			if (!json['typography'] && !hasType(json, 'typography')) {
				return 'No typography key or $type: "typography" found — is this a Figma text styles export?';
			}
		}
		return null;
	} catch {
		return 'Invalid JSON — could not parse file';
	}
}

// ─── File Insight Computation ─────────────────────────────────────────────────

export function computeInsight(key: DropZoneKey, content: string): FileInsight | undefined {
	const jsonKeys: DropZoneKey[] = ['lightColors', 'darkColors', 'values', 'typography'];
	if (!jsonKeys.includes(key)) {
		const lines = content.split('\n').length;
		return { count: lines, label: 'lines' };
	}
	try {
		const json = JSON.parse(content) as Record<string, unknown>;
		if (key === 'lightColors' || key === 'darkColors') {
			let count = 0;
			function countColors(obj: unknown) {
				if (!obj || typeof obj !== 'object') return;
				const o = obj as Record<string, unknown>;
				if (o.$type === 'color') {
					count++;
					return;
				}
				for (const [k, v] of Object.entries(o)) {
					if (!k.startsWith('$')) countColors(v);
				}
			}
			countColors(json);
			return { count, label: 'color tokens' };
		}
		if (key === 'values') {
			let count = 0;
			function countNumbers(obj: unknown) {
				if (!obj || typeof obj !== 'object') return;
				const o = obj as Record<string, unknown>;
				if (o.$type === 'number') {
					count++;
					return;
				}
				for (const [k, v] of Object.entries(o)) {
					if (!k.startsWith('$')) countNumbers(v);
				}
			}
			countNumbers(json);
			return { count, label: 'spacing tokens' };
		}
		if (key === 'typography') {
			const typo = json['typography'];
			if (typo && typeof typo === 'object') {
				const count = Object.values(typo as Record<string, unknown>).filter(
					(v) => v && typeof v === 'object' && (v as Record<string, unknown>).$type === 'typography'
				).length;
				return { count, label: 'text styles' };
			}
		}
	} catch {
		return undefined;
	}
	return undefined;
}
