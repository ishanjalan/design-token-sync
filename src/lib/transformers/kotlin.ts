/**
 * Kotlin Transformer
 *
 * Generates Colors.kt from Figma color exports.
 * Output targets Jetpack Compose (Material3) using:
 *   object Primitives { val Grey750 = Color(0xFF1D1D1D) }
 *   object LightColorTokens { val textPrimary = Primitives.Grey750 }
 *   object DarkColorTokens  { val textPrimary = Primitives.Grey50  }
 *
 * Hex values use the Compose Color(Long) format: 0xFFRRGGBB (alpha-first).
 * Alpha colors use: Color(red = 0.11f, green = 0.11f, blue = 0.11f, alpha = 0.69f)
 *
 * If a reference Colors.kt is provided, naming conventions are detected and matched.
 */

import type { FigmaColorExport, TransformResult } from '$lib/types.js';
import type { DetectedKotlinConventions } from '$lib/types.js';
import { BEST_PRACTICE_KOTLIN_CONVENTIONS } from '$lib/types.js';
import { figmaToKotlinHex } from '$lib/color-utils.js';
import {
	walkColorTokens,
	walkColorTokensWithPath,
	getColorTokenAtPath,
	pathToTokenName,
	extractSortKey,
	capitalize,
	detectRenamesInReference,
	renameComment,
	createNewDetector,
	newTokenComment,
	detectKotlinColorBugs,
	bugWarningBlock,
	fileHeaderLines
} from './shared.js';

interface PrimitiveEntry {
	kotlinName: string; // e.g. "Grey750"
	hex: string; // e.g. "1D1D1D" (uppercase, no #)
	r: number; // 0–1 (for alpha colors)
	g: number;
	b: number;
	alpha: number;
	family: string;
	sortKey: number;
}

interface SemanticEntry {
	kotlinName: string;
	lightPrimName: string;
	darkPrimName: string;
	isStatic: boolean;
	category: string;
}

export interface KotlinOutputScope {
	generatePrimitives: boolean;
	generateSemantics: boolean;
	semanticCategories?: string[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function transformToKotlin(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	referenceKotlin?: string,
	bestPractices: boolean = true,
	scope?: KotlinOutputScope
): TransformResult[] {
	const conventions = detectKotlinConventions(referenceKotlin, bestPractices);
	const renames = bestPractices ? new Map<string, string>() : detectRenamesInReference(referenceKotlin);
	const isNew = bestPractices ? (() => false) : createNewDetector(referenceKotlin);
	const bugWarnings = referenceKotlin && !bestPractices ? detectKotlinColorBugs(referenceKotlin) : [];
	const primitiveMap = buildPrimitiveMap(lightColors, darkColors, conventions);
	const semanticEntries = buildSemanticEntries(lightColors, darkColors, primitiveMap, conventions);

	const effectiveScope: KotlinOutputScope = scope ?? { generatePrimitives: true, generateSemantics: true };

	if (conventions.architecture === 'multi-file') {
		return generateMultiFileKotlin(primitiveMap, semanticEntries, conventions, renames, isNew, bugWarnings, bestPractices, effectiveScope);
	}

	const results: TransformResult[] = [];

	if (effectiveScope.generatePrimitives) {
		const primContent = generatePrimitivesFile(primitiveMap, conventions, renames, isNew, bugWarnings, bestPractices);
		results.push({ filename: 'Color.kt', content: primContent, format: 'kotlin', platform: 'android' });
	}

	if (effectiveScope.generateSemantics && semanticEntries.length > 0) {
		const semContent = generateSingleSemanticFile(primitiveMap, semanticEntries, conventions, renames, isNew, bestPractices);
		results.push({ filename: 'Colors.kt', content: semContent, format: 'kotlin', platform: 'android' });
	}

	if (results.length === 0) {
		const primContent = generatePrimitivesFile(primitiveMap, conventions, renames, isNew, bugWarnings, bestPractices);
		results.push({ filename: 'Color.kt', content: primContent, format: 'kotlin', platform: 'android' });
	}

	return results;
}

// ─── Convention Detection ─────────────────────────────────────────────────────

export function detectKotlinConventions(reference?: string, bestPractices: boolean = true): DetectedKotlinConventions {
	if (bestPractices || !reference) {
		return { ...BEST_PRACTICE_KOTLIN_CONVENTIONS };
	}

	const pascalMatches = (reference.match(/\b(?:val|var)\s+[A-Z][a-zA-Z0-9]+\s*(?:=|by\s)/g) ?? []).length;
	const camelMatches = (reference.match(/\b(?:val|var)\s+[a-z][a-zA-Z0-9]+\s*(?:=|by\s)/g) ?? []).length;
	const namingCase = pascalMatches > camelMatches ? 'pascal' : 'camel';

	const objectMatch = reference.match(/\bobject\s+(\w+)\s*\{/);
	const objectName = objectMatch ? objectMatch[1] : 'AppColors';

	const packageMatch = reference.match(/^package\s+([\w.]+)/m);
	const kotlinPackage = packageMatch ? packageMatch[1] : 'com.example.design';

	const hasPaletteObjects = /\bobject\s+\w+Palette\s*\{/.test(reference);
	const primitiveStyle = hasPaletteObjects ? 'palette-objects' as const : 'object' as const;

	const categoryMatches = [...reference.matchAll(/\bclass\s+R(\w+)Colors\b/g)];
	const semanticCategories = categoryMatches.map((m) => m[1].toLowerCase());
	const hasMultipleSemanticFiles = semanticCategories.length > 0;

	const prefixMatch = reference.match(/\bclass\s+(R)\w+Colors\b/);
	const classPrefix = prefixMatch ? prefixMatch[1] : '';

	const usesCompositionLocal = /compositionLocalOf/.test(reference);
	const usesEnum = /\benum\s+class\s+R\w+Color\b/.test(reference);
	const usesMutableState = /mutableStateOf/.test(reference);
	const usesInternalSet = /\binternal\s+set\b/.test(reference);
	const usesCopyMethod = /\bfun\s+copy\(/.test(reference);
	const usesParameterizedFactories = /\bfun\s+\w+(?:Dark|Light)Colors\s*\(\s*\n\s*\w+\s*:\s*Color/.test(reference);

	return {
		namingCase,
		objectName,
		kotlinPackage,
		architecture: hasMultipleSemanticFiles ? 'multi-file' : 'single',
		primitiveStyle,
		semanticCategories,
		classPrefix,
		usesCompositionLocal,
		usesEnum,
		usesMutableState,
		usesInternalSet,
		usesCopyMethod,
		usesParameterizedFactories
	};
}

// ─── Build Primitive Map ──────────────────────────────────────────────────────

function buildPrimitiveMap(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	conventions: DetectedKotlinConventions
): Map<string, PrimitiveEntry> {
	const map = new Map<string, PrimitiveEntry>();

	function collect(export_: FigmaColorExport) {
		walkColorTokens(export_, (token) => {
			const figmaName = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
			/* v8 ignore next -- @preserve */
			if (!figmaName || map.has(figmaName)) return;
			/* v8 ignore next -- @preserve */
			if (!figmaName.startsWith('Colour/')) return;

			const v = token.$value;
			/* v8 ignore next -- @preserve */
			if (!v) return;
			const kotlinName = figmaNameToKotlinName(figmaName, conventions.namingCase);
			/* v8 ignore next -- @preserve */
			if (!kotlinName) return;

			const hexUpper = v.hex.replace('#', '').toUpperCase();
			map.set(figmaName, {
				kotlinName,
				hex: hexUpper,
				r: v.components[0],
				g: v.components[1],
				b: v.components[2],
				alpha: v.alpha,
				family: extractFamily(figmaName),
				sortKey: extractSortKey(figmaName)
			});
		});
	}

	collect(lightColors);
	collect(darkColors);
	return map;
}

// ─── Build Semantic Entries ───────────────────────────────────────────────────

function buildSemanticEntries(
	lightColors: FigmaColorExport,
	darkColors: FigmaColorExport,
	primitiveMap: Map<string, PrimitiveEntry>,
	conventions: DetectedKotlinConventions
): SemanticEntry[] {
	const entries: SemanticEntry[] = [];

	walkColorTokensWithPath(lightColors, (path, lightToken) => {
		const lightFigmaName = lightToken.$extensions?.['com.figma.aliasData']?.targetVariableName;
		if (!lightFigmaName) return;

		const lightPrim = primitiveMap.get(lightFigmaName);
		/* v8 ignore next -- @preserve */
		if (!lightPrim) return;

		const darkToken = getColorTokenAtPath(darkColors, path);
		const darkFigmaName = darkToken?.$extensions?.['com.figma.aliasData']?.targetVariableName;
		const darkPrim = darkFigmaName ? (primitiveMap.get(darkFigmaName) ?? lightPrim) : lightPrim;

		const isStatic = path.some((p) => p.toLowerCase() === 'static');
		const category = path[0]?.toLowerCase() ?? 'other';
		const tokenName = pathToTokenName(path);
		const kotlinName = tokenNameToKotlinName(tokenName, conventions.namingCase);

		entries.push({
			kotlinName,
			lightPrimName: lightPrim.kotlinName,
			darkPrimName: darkPrim.kotlinName,
			isStatic,
			category
		});
	});

	return entries;
}

// ─── Generate Output ──────────────────────────────────────────────────────────

function _generateKotlin(
	primitiveMap: Map<string, PrimitiveEntry>,
	semanticEntries: SemanticEntry[],
	conventions: DetectedKotlinConventions,
	renames: Map<string, string> = new Map(),
	isNew: (name: string) => boolean = () => false,
	bugWarnings: string[] = [],
	bestPractices: boolean = true
): string {
	const lines: string[] = [];

	lines.push('// Colors.kt');
	lines.push(...fileHeaderLines('//', bestPractices));
	lines.push('');

	lines.push(...bugWarningBlock(bugWarnings, '//'));
	lines.push(`package ${conventions.kotlinPackage}`);
	lines.push('');
	lines.push('import androidx.compose.material3.ColorScheme');
	lines.push('import androidx.compose.material3.darkColorScheme');
	lines.push('import androidx.compose.material3.lightColorScheme');
	lines.push('import androidx.compose.ui.graphics.Color');
	lines.push('');

	const primitivesObj = conventions.objectName === 'AppColors' ? 'Primitives' : `${conventions.objectName}Primitives`;
	const lightObj = conventions.objectName === 'AppColors' ? 'LightColorTokens' : `${conventions.objectName}Light`;
	const darkObj = conventions.objectName === 'AppColors' ? 'DarkColorTokens' : `${conventions.objectName}Dark`;

	// ── Primitives ──────────────────────────────────────────────────────────
	lines.push('// Primitive color palette');
	lines.push(`object ${primitivesObj} {`);

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
			for (const cl of renameComment(oldName, capitalize(family), '//')) {
				lines.push(`    ${cl}`);
			}
		}
		if (familyIsNew) {
			for (const cl of newTokenComment('//')) {
				lines.push(`    ${cl}`);
			}
		}
		lines.push(`    // ${capitalize(family)}`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.kotlinName.localeCompare(b.kotlinName)
		);
		for (const entry of sorted) {
			lines.push(formatPrimitiveDecl(entry));
		}
	}
	lines.push('}');
	lines.push('');

	if (semanticEntries.length > 0) {
		// ── Light theme ──────────────────────────────────────────────────────
		lines.push('// Light theme semantic tokens');
		lines.push(`object ${lightObj} {`);
		for (const entry of semanticEntries) {
			if (isNew(entry.kotlinName)) {
				for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
			}
			lines.push(`    val ${entry.kotlinName} = ${primitivesObj}.${entry.lightPrimName}`);
		}
		lines.push('}');
		lines.push('');

		// ── Dark theme ───────────────────────────────────────────────────────
		lines.push('// Dark theme semantic tokens');
		lines.push(`object ${darkObj} {`);
		for (const entry of semanticEntries) {
			if (isNew(entry.kotlinName)) {
				for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
			}
			const darkRef = entry.isStatic ? entry.lightPrimName : entry.darkPrimName;
			lines.push(`    val ${entry.kotlinName} = ${primitivesObj}.${darkRef}`);
		}
		lines.push('}');
		lines.push('');

		// ── Material3 ColorScheme builders ───────────────────────────────────
		// These wire your semantic tokens into Material3's ColorScheme so you can pass
		// them directly to MaterialTheme:
		//
		//   @Composable
		//   fun AppTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
		//       val colorScheme = if (darkTheme) darkColors() else lightColors()
		//       MaterialTheme(colorScheme = colorScheme, content = content)
		//   }
		//
		// See https://m3.material.io/styles/color/roles for a full list of M3 color roles.
		lines.push('// Material3 ColorScheme builders — plug into MaterialTheme');
		lines.push('// TODO: map your semantic tokens to Material3 color roles below.');
		lines.push('@Suppress("UnusedReceiverParameter")');
		lines.push('fun lightColors(): ColorScheme = lightColorScheme(');
		lines.push(`    // primary           = ${lightObj}.fillPrimary,`);
		lines.push(`    // onPrimary         = ${lightObj}.textOnPrimary,`);
		lines.push(`    // background        = ${lightObj}.backgroundDefault,`);
		lines.push(`    // surface           = ${lightObj}.backgroundSurface,`);
		lines.push(`    // onSurface         = ${lightObj}.textPrimary,`);
		lines.push(`    // outline           = ${lightObj}.strokeDefault,`);
		lines.push(')');
		lines.push('');
		lines.push('@Suppress("UnusedReceiverParameter")');
		lines.push('fun darkColors(): ColorScheme = darkColorScheme(');
		lines.push(`    // primary           = ${darkObj}.fillPrimary,`);
		lines.push(`    // onPrimary         = ${darkObj}.textOnPrimary,`);
		lines.push(`    // background        = ${darkObj}.backgroundDefault,`);
		lines.push(`    // surface           = ${darkObj}.backgroundSurface,`);
		lines.push(`    // onSurface         = ${darkObj}.textPrimary,`);
		lines.push(`    // outline           = ${darkObj}.strokeDefault,`);
		lines.push(')');
		lines.push('');
	}

	return lines.join('\n') + '\n';
}

function generatePrimitivesFile(
	primitiveMap: Map<string, PrimitiveEntry>,
	conventions: DetectedKotlinConventions,
	renames: Map<string, string>,
	isNew: (name: string) => boolean,
	bugWarnings: string[],
	bestPractices: boolean
): string {
	const lines: string[] = [];
	lines.push('// Color.kt');
	lines.push(...fileHeaderLines('//', bestPractices));
	lines.push('');
	lines.push(...bugWarningBlock(bugWarnings, '//'));
	lines.push(`package ${conventions.kotlinPackage}`);
	lines.push('');
	lines.push('import androidx.compose.ui.graphics.Color');
	lines.push('');

	const primitivesObj = conventions.objectName === 'AppColors' ? 'Primitives' : `${conventions.objectName}Primitives`;
	lines.push('// Primitive color palette');
	lines.push(`object ${primitivesObj} {`);

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
			for (const cl of renameComment(oldName, capitalize(family), '//')) {
				lines.push(`    ${cl}`);
			}
		}
		if (familyIsNew) {
			for (const cl of newTokenComment('//')) {
				lines.push(`    ${cl}`);
			}
		}
		lines.push(`    // ${capitalize(family)}`);
		const sorted = [...entries].sort(
			(a, b) => a.sortKey - b.sortKey || a.kotlinName.localeCompare(b.kotlinName)
		);
		for (const entry of sorted) {
			lines.push(formatPrimitiveDecl(entry));
		}
	}
	lines.push('}');
	lines.push('');
	return lines.join('\n') + '\n';
}

function generateSingleSemanticFile(
	primitiveMap: Map<string, PrimitiveEntry>,
	semanticEntries: SemanticEntry[],
	conventions: DetectedKotlinConventions,
	_renames: Map<string, string>,
	isNew: (name: string) => boolean,
	bestPractices: boolean
): string {
	const lines: string[] = [];
	lines.push('// Colors.kt');
	lines.push(...fileHeaderLines('//', bestPractices));
	lines.push('');
	lines.push(`package ${conventions.kotlinPackage}`);
	lines.push('');
	lines.push('import androidx.compose.material3.ColorScheme');
	lines.push('import androidx.compose.material3.darkColorScheme');
	lines.push('import androidx.compose.material3.lightColorScheme');
	lines.push('import androidx.compose.ui.graphics.Color');
	lines.push('');

	const primitivesObj = conventions.objectName === 'AppColors' ? 'Primitives' : `${conventions.objectName}Primitives`;
	const lightObj = conventions.objectName === 'AppColors' ? 'LightColorTokens' : `${conventions.objectName}Light`;
	const darkObj = conventions.objectName === 'AppColors' ? 'DarkColorTokens' : `${conventions.objectName}Dark`;

	lines.push('// Light theme semantic tokens');
	lines.push(`object ${lightObj} {`);
	for (const entry of semanticEntries) {
		if (isNew(entry.kotlinName)) {
			for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
		}
		lines.push(`    val ${entry.kotlinName} = ${primitivesObj}.${entry.lightPrimName}`);
	}
	lines.push('}');
	lines.push('');

	lines.push('// Dark theme semantic tokens');
	lines.push(`object ${darkObj} {`);
	for (const entry of semanticEntries) {
		if (isNew(entry.kotlinName)) {
			for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
		}
		const darkRef = entry.isStatic ? entry.lightPrimName : entry.darkPrimName;
		lines.push(`    val ${entry.kotlinName} = ${primitivesObj}.${darkRef}`);
	}
	lines.push('}');
	lines.push('');

	lines.push('// Material3 ColorScheme builders — plug into MaterialTheme');
	lines.push('// TODO: map your semantic tokens to Material3 color roles below.');
	lines.push('@Suppress("UnusedReceiverParameter")');
	lines.push('fun lightColors(): ColorScheme = lightColorScheme(');
	lines.push(`    // primary           = ${lightObj}.fillPrimary,`);
	lines.push(`    // onPrimary         = ${lightObj}.textOnPrimary,`);
	lines.push(`    // background        = ${lightObj}.backgroundDefault,`);
	lines.push(`    // surface           = ${lightObj}.backgroundSurface,`);
	lines.push(`    // onSurface         = ${lightObj}.textPrimary,`);
	lines.push(`    // outline           = ${lightObj}.strokeDefault,`);
	lines.push(')');
	lines.push('');
	lines.push('@Suppress("UnusedReceiverParameter")');
	lines.push('fun darkColors(): ColorScheme = darkColorScheme(');
	lines.push(`    // primary           = ${darkObj}.fillPrimary,`);
	lines.push(`    // onPrimary         = ${darkObj}.textOnPrimary,`);
	lines.push(`    // background        = ${darkObj}.backgroundDefault,`);
	lines.push(`    // surface           = ${darkObj}.backgroundSurface,`);
	lines.push(`    // onSurface         = ${darkObj}.textPrimary,`);
	lines.push(`    // outline           = ${darkObj}.strokeDefault,`);
	lines.push(')');
	lines.push('');

	return lines.join('\n') + '\n';
}

// ─── Multi-File Generation ────────────────────────────────────────────────────

function generateMultiFileKotlin(
	primitiveMap: Map<string, PrimitiveEntry>,
	semanticEntries: SemanticEntry[],
	conventions: DetectedKotlinConventions,
	renames: Map<string, string>,
	isNew: (name: string) => boolean,
	bugWarnings: string[],
	bestPractices: boolean = true,
	scope: KotlinOutputScope = { generatePrimitives: true, generateSemantics: true }
): TransformResult[] {
	const results: TransformResult[] = [];
	const prefix = conventions.classPrefix;
	const pkg = conventions.kotlinPackage;

	if (scope.generatePrimitives) {
		// ── Color.kt (Primitives) ────────────────────────────────────────────
		const primLines: string[] = [];
		primLines.push('// Color.kt');
		primLines.push(...fileHeaderLines('//', bestPractices));
		primLines.push('');
		primLines.push(...bugWarningBlock(bugWarnings, '//'));
		primLines.push(`package ${pkg}`);
		primLines.push('');
		primLines.push('import androidx.compose.ui.graphics.Color');
		primLines.push('');

		if (conventions.primitiveStyle === 'palette-objects') {
			const byFamily = groupByFamily(primitiveMap, renames, isNew);
			for (const [family, entries] of byFamily) {
				const objName = `${capitalize(family)}Palette`;
				const oldName = renames.get(family);
				const familyIsNew = !oldName && isNew(family);
				if (oldName) for (const cl of renameComment(oldName, capitalize(family), '//')) primLines.push(cl);
				if (familyIsNew) for (const cl of newTokenComment('//')) primLines.push(cl);
				primLines.push(`object ${objName} {`);
				const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.kotlinName.localeCompare(b.kotlinName));
				for (const entry of sorted) {
					primLines.push(`    val color${entry.kotlinName} = Color(${figmaToKotlinHex(entry.r, entry.g, entry.b, entry.alpha)})`);
				}
				primLines.push('}');
				primLines.push('');
			}
		} else {
			primLines.push(`object ${conventions.objectName === 'AppColors' ? 'Primitives' : conventions.objectName + 'Primitives'} {`);
			const byFamily = groupByFamily(primitiveMap, renames, isNew);
			for (const [family, entries] of byFamily) {
				const oldName = renames.get(family);
				const familyIsNew = !oldName && isNew(family);
				if (oldName) for (const cl of renameComment(oldName, capitalize(family), '//')) primLines.push(`    ${cl}`);
				if (familyIsNew) for (const cl of newTokenComment('//')) primLines.push(`    ${cl}`);
				primLines.push(`    // ${capitalize(family)}`);
				const sorted = [...entries].sort((a, b) => a.sortKey - b.sortKey || a.kotlinName.localeCompare(b.kotlinName));
				for (const entry of sorted) primLines.push(formatPrimitiveDecl(entry));
			}
			primLines.push('}');
			primLines.push('');
		}

		results.push({ filename: 'Color.kt', content: primLines.join('\n') + '\n', format: 'kotlin', platform: 'android' });
	}

	if (scope.generateSemantics) {
	// ── Group semantic entries by category ──────────────────────────────
	const byCategory = new Map<string, SemanticEntry[]>();
	for (const entry of semanticEntries) {
		const cat = entry.category;
		const list = byCategory.get(cat) ?? [];
		list.push(entry);
		byCategory.set(cat, list);
	}

	const primRef = conventions.primitiveStyle === 'palette-objects' ? null : (conventions.objectName === 'AppColors' ? 'Primitives' : `${conventions.objectName}Primitives`);

	for (const [category, entries] of byCategory) {
		const catPascal = capitalize(category);
		const className = `${prefix}${catPascal}Colors`;
		const enumName = `${prefix}${catPascal}Color`;
		const filename = `${prefix}${catPascal}Colors.kt`;

		const lines: string[] = [];
		lines.push(`// ${filename}`);
		lines.push(...fileHeaderLines('//', bestPractices));
		lines.push('');
		lines.push(`package ${pkg}`);
		lines.push('');

		if (conventions.usesCompositionLocal || conventions.usesMutableState) {
			lines.push('import androidx.compose.material3.MaterialTheme');
			lines.push('import androidx.compose.runtime.Composable');
			lines.push('import androidx.compose.runtime.compositionLocalOf');
			lines.push('import androidx.compose.runtime.getValue');
			lines.push('import androidx.compose.runtime.mutableStateOf');
			lines.push('import androidx.compose.runtime.setValue');
			lines.push('import androidx.compose.runtime.structuralEqualityPolicy');
		}
		lines.push('import androidx.compose.ui.graphics.Color');
		lines.push('');

		if (conventions.usesEnum) {
			lines.push(`enum class ${enumName} {`);
			for (const entry of entries) {
				lines.push(`    ${entry.kotlinName.toUpperCase()},`);
			}
			lines.push('    ;');
			lines.push('    val color: Color');
			lines.push('        @Composable');
			lines.push('        get() = when (this) {');
			for (const entry of entries) {
				lines.push(`            ${entry.kotlinName.toUpperCase()} -> MaterialTheme.Local${catPascal}Colors.${entry.kotlinName}`);
			}
			lines.push('        }');
			lines.push('}');
			lines.push('');
		}

		if (conventions.usesMutableState) {
			lines.push(`class ${className}(`);
			for (const entry of entries) {
				lines.push(`    ${entry.kotlinName}: Color,`);
			}
			lines.push(') {');
			for (const entry of entries) {
				lines.push(`    var ${entry.kotlinName} by mutableStateOf(${entry.kotlinName}, structuralEqualityPolicy())`);
				if (conventions.usesInternalSet) {
					lines.push('        internal set');
				}
			}
			lines.push('');
			if (conventions.usesCopyMethod) {
				lines.push('');
				lines.push(`    fun copy(`);
				for (const entry of entries) {
					lines.push(`        ${entry.kotlinName}: Color = this.${entry.kotlinName},`);
				}
				lines.push(`    ): ${className} = ${className}(`);
				for (const entry of entries) {
					lines.push(`        ${entry.kotlinName} = ${entry.kotlinName},`);
				}
				lines.push('    )');
			} else {
				lines.push(`    fun updateFrom(other: ${className}) {`);
				for (const entry of entries) {
					lines.push(`        ${entry.kotlinName} = other.${entry.kotlinName}`);
				}
				lines.push('    }');
			}
			lines.push('}');
			lines.push('');
		}

		const resolvePrim = (primName: string) => {
			if (primRef) return `${primRef}.${primName}`;
			const primEntry = [...primitiveMap.values()].find((p) => p.kotlinName === primName);
			if (primEntry) return `${capitalize(primEntry.family)}Palette.color${primName}`;
			return primName;
		};

		if (conventions.usesParameterizedFactories) {
			// Parameterized factory + concrete val (matching reference pattern)
			lines.push(`fun ${category}DarkColors(`);
			for (const entry of entries) {
				lines.push(`    ${entry.kotlinName}: Color,`);
			}
			lines.push(`    ): ${className} = ${className}(`);
			for (const entry of entries) {
				lines.push(`    ${entry.kotlinName} = ${entry.kotlinName},`);
			}
			lines.push(')');

			lines.push(`val ${catPascal}DarkColorScheme = ${category}DarkColors(`);
			for (const entry of entries) {
				const darkRef = entry.isStatic ? entry.lightPrimName : entry.darkPrimName;
				if (isNew(entry.kotlinName)) for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
				lines.push(`    ${entry.kotlinName} = ${resolvePrim(darkRef)},`);
			}
			lines.push(')');
			lines.push('');

			lines.push(`fun ${category}LightColors(`);
			for (const entry of entries) {
				lines.push(`    ${entry.kotlinName}: Color,`);
			}
			lines.push(`    ): ${className} = ${className}(`);
			for (const entry of entries) {
				lines.push(`    ${entry.kotlinName} = ${entry.kotlinName},`);
			}
			lines.push(')');

			lines.push(`val ${catPascal}LightColorScheme = ${category}LightColors(`);
			for (const entry of entries) {
				if (isNew(entry.kotlinName)) for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
				lines.push(`    ${entry.kotlinName} = ${resolvePrim(entry.lightPrimName)},`);
			}
			lines.push(')');
			lines.push('');
		} else {
			lines.push(`fun ${category}DarkColors() = ${className}(`);
			for (const entry of entries) {
				const darkRef = entry.isStatic ? entry.lightPrimName : entry.darkPrimName;
				if (isNew(entry.kotlinName)) for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
				lines.push(`    ${entry.kotlinName} = ${resolvePrim(darkRef)},`);
			}
			lines.push(')');
			lines.push('');

			lines.push(`fun ${category}LightColors() = ${className}(`);
			for (const entry of entries) {
				if (isNew(entry.kotlinName)) for (const cl of newTokenComment('//')) lines.push(`    ${cl}`);
				lines.push(`    ${entry.kotlinName} = ${resolvePrim(entry.lightPrimName)},`);
			}
			lines.push(')');
			lines.push('');

			lines.push(`val ${catPascal}DarkColorScheme = ${category}DarkColors()`);
			lines.push(`val ${catPascal}LightColorScheme = ${category}LightColors()`);
			lines.push('');
		}

		if (conventions.usesCompositionLocal) {
			lines.push(`val Local${catPascal}Color = compositionLocalOf { ${catPascal}LightColorScheme }`);
			lines.push('');
			lines.push(`val MaterialTheme.Local${catPascal}Colors`);
			lines.push('    @Composable');
			lines.push(`    get() = Local${catPascal}Color.current`);
			lines.push('');
		}

		results.push({ filename, content: lines.join('\n') + '\n', format: 'kotlin', platform: 'android' });
	}
	}

	return results;
}

function groupByFamily(
	primitiveMap: Map<string, PrimitiveEntry>,
	renames: Map<string, string>,
	_isNew: (name: string) => boolean
): [string, PrimitiveEntry[]][] {
	const byFamily = new Map<string, PrimitiveEntry[]>();
	for (const entry of primitiveMap.values()) {
		const list = byFamily.get(entry.family) ?? [];
		list.push(entry);
		byFamily.set(entry.family, list);
	}
	return [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function formatPrimitiveDecl(entry: PrimitiveEntry): string {
	return `    val ${entry.kotlinName} = Color(${figmaToKotlinHex(entry.r, entry.g, entry.b, entry.alpha)})`;
}

// ─── Naming Helpers ───────────────────────────────────────────────────────────

function figmaNameToKotlinName(figmaName: string, namingCase: 'camel' | 'pascal'): string | null {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return null;
	const rest = figmaName.slice('Colour/'.length);
	const parts = rest.split('/');
	const segments = parts.flatMap((p) =>
		p
			.replace(/_/g, '-')
			.replace(/([a-z])([A-Z])/g, '$1-$2')
			.toLowerCase()
			.split('-')
			.filter(Boolean)
	);

	if (namingCase === 'pascal') return toPascalCase(segments);
	return toCamelCase(segments);
}

function tokenNameToKotlinName(tokenName: string, namingCase: 'camel' | 'pascal'): string {
	const segments = tokenName.split('-').filter(Boolean);
	if (namingCase === 'pascal') return toPascalCase(segments);
	return toCamelCase(segments);
}

function toCamelCase(parts: string[]): string {
	return parts.map((p, i) => (i === 0 ? p : capitalize(p))).join('');
}

function toPascalCase(parts: string[]): string {
	return parts.map(capitalize).join('');
}

function extractFamily(figmaName: string): string {
	/* v8 ignore next -- @preserve */
	if (!figmaName.startsWith('Colour/')) return figmaName;
	const rest = figmaName.slice('Colour/'.length);
	const topSegment = rest.split('/')[0].toLowerCase().replace(/_/g, '-');
	const parts = topSegment.split('-');
	const familyParts: string[] = [];
	for (const part of parts) {
		if (/^\d/.test(part)) break;
		familyParts.push(part);
	}
	/* v8 ignore next -- @preserve */
	return familyParts.join('-') || topSegment;
}

