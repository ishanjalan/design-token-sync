/**
 * Unused token detection.
 *
 * Compares generated token names against reference file content to identify:
 * - Tokens in reference files but absent from Figma export ("potentially unused")
 * - Primitive tokens with zero semantic dependents ("orphaned primitives")
 */

import type { GeneratedFile } from './types.js';
import { TOKEN_PATTERNS, extractTokenNameValue } from './diff-utils.js';
import type { DependencyEntry } from './token-analysis.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnusedTokenResult {
	filename: string;
	unusedInFigma: string[];
	orphanedPrimitives: string[];
	totalGenerated: number;
	totalReference: number;
}

// ─── Extraction ───────────────────────────────────────────────────────────────

function extractTokenNames(content: string): Set<string> {
	const names = new Set<string>();
	for (const line of content.split('\n')) {
		for (const pat of TOKEN_PATTERNS) {
			const m = line.match(pat);
			if (m) {
				names.add(m[1].toLowerCase());
				break;
			}
		}
	}
	return names;
}

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectUnusedTokens(
	files: GeneratedFile[],
	depMap?: DependencyEntry[]
): UnusedTokenResult[] {
	const results: UnusedTokenResult[] = [];

	for (const file of files) {
		if (!file.referenceContent) continue;

		const genNames = extractTokenNames(file.content);
		const refNames = extractTokenNames(file.referenceContent);

		const unusedInFigma = [...refNames].filter((n) => !genNames.has(n));

		let orphanedPrimitives: string[] = [];
		if (depMap) {
			const semanticTargets = new Set(
				depMap.map((d) => d.primitive.split('/').pop()?.toLowerCase() ?? '')
			);
			orphanedPrimitives = [...genNames].filter((name) => {
				const nv = findTokenValue(file.content, name);
				if (!nv) return false;
				const isPrimitive = !nv.includes('var(') && !nv.includes('Primitives.');
				return isPrimitive && !semanticTargets.has(name);
			});
		}

		results.push({
			filename: file.filename,
			unusedInFigma,
			orphanedPrimitives,
			totalGenerated: genNames.size,
			totalReference: refNames.size
		});
	}

	return results;
}

function findTokenValue(content: string, tokenName: string): string | null {
	for (const line of content.split('\n')) {
		const nv = extractTokenNameValue(line);
		if (nv && nv.name.toLowerCase() === tokenName) {
			return nv.value;
		}
	}
	return null;
}

export function unusedSummary(results: UnusedTokenResult[]): {
	totalUnused: number;
	totalOrphaned: number;
} {
	return {
		totalUnused: results.reduce((sum, r) => sum + r.unusedInFigma.length, 0),
		totalOrphaned: results.reduce((sum, r) => sum + r.orphanedPrimitives.length, 0)
	};
}
