/**
 * TypeScript Web Transformer
 *
 * Generates Primitives.ts and Colors.ts from the same data used by the SCSS
 * transformer.  Output format matches the web team's existing structure exactly,
 * using the convention detector to infer naming case from reference files.
 *
 * Primitives.ts  → `export const GREY_750 = '#1d1d1d';`
 * Colors.ts      → `export const TEXT_PRIMARY = \`var(--text-primary, light-dark(\${PRIMITIVES.GREY_750}, \${PRIMITIVES.GREY_50}))\`;`
 */

import type { FigmaColorExport, TransformResult } from '$lib/types.js';
import type { DetectedConventions } from '$lib/types.js';
import { scssVarToTsName } from '$lib/transformers/naming.js';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	pathToTokenName,
	extractSortKey,
	resolveColorValue,
	capitalize,
	orderCategories,
	renameComment,
	newTokenComment
} from './shared.js';

// Re-use the same internal helpers by importing from the scss transformer's private types
// via a small re-export shim.  We duplicate only what's needed here to stay self-contained.

interface PrimitiveEntry {
	scssVar: string;
	tsName: string;
	value: string;
	family: string;
	sortKey: number;
}

interface SemanticEntry {
	cssVar: string;
	tsName: string;
	lightTs: string;
	darkTs: string;
	isStatic: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToTS(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	conventions: DetectedConventions,
	primitives?: Record<string, unknown>,
	renames: Map<string, string> = new Map(),
	isNew: (name: string) => boolean = () => false
): TransformResult[] {
	const primitiveMap = primitives
		? buildPrimitiveMapFromExport(primitives, conventions)
		: buildPrimitiveMapFromAliasData(lightColors, darkColors, conventions);

	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap, conventions);

	return [generatePrimitivesTs(primitiveMap, conventions, renames, isNew), generateColorsTs(semanticEntries, conventions, isNew)];
}

// ─── Step 1a: Primitive Map from dedicated primitives export ──────────────────

function buildPrimitiveMapFromExport(
	primitivesExport: Record<string, unknown>,
	conventions: DetectedConventions
): Map<string, PrimitiveEntry> {
	const map = new Map<string, PrimitiveEntry>();

	walkColorTokensWithPath(primitivesExport, (path, token) => {
		const figmaName = path.join('/');
		const scssVar = figmaNameToScssVar(figmaName);
		const value = resolveColorValue(token);
		if (!scssVar || !value) return;

		const tsName = scssVarToTsName(scssVar, conventions.tsNamingCase);
		map.set(figmaName, {
			scssVar,
			tsName,
			value,
			family: extractFamily(scssVar),
			sortKey: extractSortKey(scssVar)
		});
	});

	return map;
}

// ─── Step 1b: Primitive Map from aliasData ────────────────────────────────────

function buildPrimitiveMapFromAliasData(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	conventions: DetectedConventions
): Map<string, PrimitiveEntry> {
	const map = new Map<string, PrimitiveEntry>();

	function collect(export_: FigmaColorExport) {
		walkColorTokens(export_, (token) => {
			const figmaName = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
			if (!figmaName || map.has(figmaName)) return;

			const scssVar = figmaNameToScssVar(figmaName);
			const value = resolveColorValue(token);
			if (!scssVar || !value) return;

			const tsName = scssVarToTsName(scssVar, conventions.tsNamingCase);
			map.set(figmaName, {
				scssVar,
				tsName,
				value,
				family: extractFamily(scssVar),
				sortKey: extractSortKey(scssVar)
			});
		});
	}

	collect(lightColors);
	collect(darkColors);
	return map;
}

// ─── Step 2: Build Semantic Entries ──────────────────────────────────────────

function buildSemanticEntries(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitiveMap: Map<string, PrimitiveEntry>,
	conventions: DetectedConventions
): SemanticEntry[] {
	const entries: SemanticEntry[] = [];

		walkColorTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap.get(lightFigmaName);
		if (!lightPrim) return;

		const darkToken = getColorTokenAtPath(darkColors, path);
		const darkFigmaName = darkToken?.$extensions?.['com.figma.aliasData']?.targetVariableName;
		const darkPrim = darkFigmaName ? (primitiveMap.get(darkFigmaName) ?? lightPrim) : lightPrim;

		const isStatic = path.some((p) => p.toLowerCase() === 'static');
		const sep = conventions.scssSeparator === 'underscore' ? '_' : '-';
		const tokenName = pathToTokenName(path, sep);
		const cssVar = `--${tokenName}`;
		const tsName = scssVarToTsName(`$${tokenName}`, conventions.tsNamingCase);

		entries.push({
			cssVar,
			tsName,
			lightTs: `PRIMITIVES.${lightPrim.tsName}`,
			darkTs: `PRIMITIVES.${darkPrim.tsName}`,
			isStatic
		});
	});

	return entries;
}

// ─── Step 3: Generate Primitives.ts ──────────────────────────────────────────

function generatePrimitivesTs(
	primitiveMap: Map<string, PrimitiveEntry>,
	conventions: DetectedConventions,
	renames: Map<string, string> = new Map(),
	isNew: (name: string) => boolean = () => false
): TransformResult {
	const lines: string[] = [];
	lines.push('// Primitives.ts');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of primitiveMap.values()) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}

	const sortedFamilies = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [family, entries] of sortedFamilies) {
		const oldName = renames.get(family);
		const familyIsNew = !oldName && isNew(family);
		if (oldName) {
			for (const cl of renameComment(oldName, family, '//')) {
				lines.push(cl);
			}
		}
		if (familyIsNew) {
			for (const cl of newTokenComment('//')) {
				lines.push(cl);
			}
		}
		lines.push(`// ${capitalize(family)} color family`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.tsName.localeCompare(b.tsName)
		);
		for (const { tsName, value } of sorted) {
			const hex = conventions.tsHexCasing === 'upper' ? value.replace(/#([0-9a-f]+)/gi, (_, h) => '#' + h.toUpperCase()) : value;
			const suffix = conventions.tsUsesAsConst ? ' as const' : '';
			if (conventions.hasTypeAnnotations) {
				lines.push(`export const ${tsName}: string = '${hex}'${suffix};`);
			} else {
				lines.push(`export const ${tsName} = '${hex}'${suffix};`);
			}
		}
		lines.push('');
	}

	return {
		filename: 'Primitives.ts',
		content: lines.join('\n') + '\n',
		format: 'typescript',
		platform: 'web'
	};
}

// ─── Step 4: Generate Colors.ts ──────────────────────────────────────────────

function generateColorsTs(
	entries: SemanticEntry[],
	conventions: DetectedConventions,
	isNew: (name: string) => boolean = () => false
): TransformResult {
	const lines: string[] = [];

	lines.push(`import * as PRIMITIVES from './Primitives';`);
	lines.push('');
	lines.push('// Colors.ts');
	lines.push('// Auto-generated from Figma Variables — DO NOT EDIT');
	lines.push(`// Generated: ${new Date().toISOString()}`);
	lines.push('');

	const sepChar = conventions.scssSeparator === 'underscore' ? '_' : '-';
	const byCategory = new Map<string, SemanticEntry[]>();
	for (const entry of entries) {
		const category = entry.cssVar.replace('--', '').split(sepChar)[0];
		const list = byCategory.get(category) ?? [];
		list.push(entry);
		byCategory.set(category, list);
	}

	const orderedCategories = orderCategories(byCategory.keys());

	for (const category of orderedCategories) {
		const tokens = byCategory.get(category)!;
		lines.push(`// ${capitalize(category)} colors`);
		for (const token of tokens) {
			if (isNew(token.tsName)) {
				for (const cl of newTokenComment('//')) lines.push(cl);
			}
			lines.push(formatSemanticTsEntry(token, conventions));
		}
		lines.push('');
	}

	return {
		filename: 'Colors.ts',
		content: lines.join('\n') + '\n',
		format: 'typescript',
		platform: 'web'
	};
}

function formatSemanticTsEntry(entry: SemanticEntry, conventions: DetectedConventions): string {
	const annotation = conventions.hasTypeAnnotations ? ': string ' : ' ';
	const suffix = conventions.tsUsesAsConst ? ' as const' : '';
	if (entry.isStatic) {
		return `export const ${entry.tsName}${annotation}= \`var(${entry.cssVar}, \${${entry.lightTs}})\`${suffix};`;
	}
	return `export const ${entry.tsName}${annotation}= \`var(${entry.cssVar}, light-dark(\${${entry.lightTs}}, \${${entry.darkTs}}))\`${suffix};`;
}

// ─── Naming Helpers (mirrors scss.ts) ────────────────────────────────────────

function figmaNameToScssVar(figmaName: string): string | null {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return null;
	const rest = figmaName.slice('Colour/'.length);
	const parts = rest.split('/');
	const converted = parts.map((p) =>
		p
			.replace(/_/g, '-')
			.replace(/([a-z])([A-Z])/g, '$1-$2')
			.toLowerCase()
	);
	return '$' + converted.join('-');
}

function extractFamily(scssVar: string): string {
	const name = scssVar.slice(1);
	const parts = name.split('-');
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part) || part === 'other') break;
		familyParts.push(part);
	}
	/* v8 ignore next -- @preserve */
	return familyParts.join('-') || name;
}
