import type { ParsedEntry, DetectedTypographyConventions } from './typography.js';
import type { TransformResult } from '$lib/types.js';
import { resolveNameFromMap, groupEntries, kebabToCamel, fileHeaderLines } from './typography.js';
import { capitalize, bugWarningBlock } from './shared.js';

export interface KotlinTypographyScope {
	generateDefinition: boolean;
	generateAccessor: boolean;
	definitionFilename?: string;
	accessorClassName?: string;
	accessorContainerRef?: string;
	accessorFilename?: string;
}

const KOTLIN_WEIGHTS: Record<number, string> = {
	100: 'FontWeight.Thin',
	200: 'FontWeight.ExtraLight',
	300: 'FontWeight.Light',
	400: 'FontWeight.Normal',
	500: 'FontWeight.Medium',
	600: 'FontWeight.SemiBold',
	700: 'FontWeight.Bold',
	800: 'FontWeight.ExtraBold',
	900: 'FontWeight.Black'
};

function kotlinWeight(w: number): string {
	return KOTLIN_WEIGHTS[w] ?? 'FontWeight.Normal';
}

export function detectKotlinConventions(content: string): DetectedTypographyConventions['kotlin'] {
	const lines = content.split('\n');

	const packageMatch = lines
		.find((l) => /^\s*package\s+/.test(l))
		?.match(/package\s+([\w.]+)/);
	const packageName = packageMatch?.[1] ?? 'com.example.design';

	const isImmutable = lines.some((l) => /^\s*@Immutable\b/.test(l));

	const classMatch = lines
		.find((l) => /^\s*class\s+\w+.*constructor/.test(l) || /^\s*class\s+\w+\s*\(/.test(l))
		?.match(/class\s+(\w+)/);
	const objectMatch = lines
		.find((l) => /^\s*(?:internal\s+)?object\s+\w+/.test(l))
		?.match(/object\s+(\w+)/);
	const hasCompanion = lines.some((l) => /companion\s+object/.test(l));
	const topLevelVals = lines.filter(
		(l) => /^\s*val\s+\w+/.test(l.trim()) && !/^\s*(?:internal\s+)?object/.test(l.trim())
	);

	let architecture: 'object' | 'companion' | 'top-level' | 'class' = 'object';
	let containerName = 'TypographyTokens';
	let className: string | null = null;

	if (classMatch && (isImmutable || /internal\s+constructor/.test(content))) {
		architecture = 'class';
		className = classMatch[1];
		containerName = classMatch[1];
	} else if (objectMatch) {
		architecture = 'object';
		containerName = objectMatch[1];
	} else if (hasCompanion) {
		architecture = 'companion';
	} else if (topLevelVals.length > 0) {
		architecture = 'top-level';
	}

	const usesTextStyle = lines.some((l) => /\bTextStyle\s*\(/.test(l));
	const includesLineHeightStyle = lines.some((l) => /\bLineHeightStyle\s*\(/.test(l));

	const snakeVals = lines.filter((l) => /^\s*val\s+[a-z]+_[a-z]/.test(l)).length;
	const camelVals = lines.filter((l) => /^\s*val\s+[a-z]+[A-Z]/.test(l)).length;
	const namingStyle: 'camelCase' | 'snake_case' = snakeVals > camelVals ? 'snake_case' : 'camelCase';

	const dataClassMatch = lines
		.find((l) => /^\s*data\s+class\s+/.test(l))
		?.match(/data\s+class\s+(\w+)/);
	const customDataClass = dataClassMatch?.[1] ?? null;

	const dataClassProps: string[] = [];
	if (customDataClass) {
		const dcLine = lines.find((l) => l.includes(`data class ${customDataClass}`));
		const propsStr = dcLine?.match(/\((.*)\)/)?.[1] ?? '';
		for (const seg of propsStr.split(',')) {
			const propMatch = seg.match(/val\s+(\w+)/);
			if (propMatch) dataClassProps.push(propMatch[1]);
		}
	}

	const includesM3Builder = lines.some(
		(l) => /\bTypography\s*\(/.test(l) || /MaterialTheme/.test(l)
	);

	const nameMap: Record<string, string> = {};
	for (const line of lines) {
		const valMatch = line.match(/^\s*val\s+(\w+)\s*[=:]/);
		if (valMatch) nameMap[valMatch[1].toLowerCase()] = valMatch[1];
	}

	const bugWarnings: string[] = [];
	if (/footnote.*this\.subhead/i.test(content)) {
		bugWarnings.push('footnote copy() defaults reference "this.subhead_*" instead of "this.footnote_*" — copy-paste bug.');
	}
	if (/RLocalTypography|LocalTypography/i.test(content) && !/slprice/i.test(content)) {
		bugWarnings.push('RLocalTypography is missing "slprice" entries. Generated output includes all tokens.');
	}

	return {
		architecture,
		containerName,
		className,
		packageName,
		usesTextStyle,
		customDataClass,
		dataClassProps,
		includesM3Builder,
		includesLineHeightStyle,
		namingStyle,
		isImmutable,
		nameMap,
		bugWarnings
	};
}

export function generateKotlin(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['kotlin'],
	scope?: KotlinTypographyScope
): TransformResult[] {
	const effectiveScope: KotlinTypographyScope = scope ?? { generateDefinition: true, generateAccessor: false };
	const results: TransformResult[] = [];

	if (effectiveScope.generateDefinition) {
		const defResult = conv.architecture === 'class'
			? generateKotlinClass(entries, conv, effectiveScope.definitionFilename)
			: generateKotlinDefinition(entries, conv, effectiveScope.definitionFilename);
		results.push(defResult);
	}

	if (effectiveScope.generateAccessor) {
		results.push(generateKotlinAccessor(entries, conv, effectiveScope));
	}

	if (results.length === 0) {
		results.push(generateKotlinDefinition(entries, conv));
	}

	return results;
}

function generateKotlinDefinition(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['kotlin'],
	filename?: string
): TransformResult {
	const lines: string[] = [];
	const hasReference = Object.keys(conv.nameMap).length > 0;
	const defFilename = filename ?? 'Typography.kt';

	lines.push(`// ${defFilename}`);
	lines.push(...fileHeaderLines('//', true));
	lines.push('');

	lines.push(...bugWarningBlock(conv.bugWarnings, '//'));

	const isDefaultPackage = conv.packageName === 'com.example.design';
	lines.push(
		`package ${conv.packageName}${!hasReference && isDefaultPackage ? ' // TODO: update to your package name' : ''}`
	);
	lines.push('');

	if (conv.includesM3Builder) lines.push('import androidx.compose.material3.Typography');
	if (conv.usesTextStyle || !conv.customDataClass) {
		lines.push('import androidx.compose.ui.text.TextStyle');
		lines.push('import androidx.compose.ui.text.font.FontFamily');
	}
	lines.push('import androidx.compose.ui.text.font.FontWeight');
	if (conv.usesTextStyle || !conv.customDataClass) lines.push('import androidx.compose.ui.unit.sp');
	lines.push('');

	if (!hasReference) {
		lines.push('// TODO: Replace FontFamily.Default with your registered font family.');
		lines.push(
			'// Example: val InterVariable = FontFamily(Font(R.font.inter_variable, FontWeight.Normal),'
		);
		lines.push(
			'//                                          Font(R.font.inter_variable_medium, FontWeight.Medium),'
		);
		lines.push(
			'//                                          Font(R.font.inter_variable_bold, FontWeight.Bold))'
		);
		lines.push('');
	}

	if (conv.customDataClass) {
		const propsStr = conv.dataClassProps
			.map((p) => (p === 'fontWeight' ? `val ${p}: FontWeight` : `val ${p}: Float`))
			.join(', ');
		lines.push(`data class ${conv.customDataClass}(${propsStr})`);
		lines.push('');
	}

	const isObject = conv.architecture === 'object';
	const isCompanion = conv.architecture === 'companion';

	if (isObject) {
		lines.push(`object ${conv.containerName} {`);
	} else if (isCompanion) {
		lines.push(`class ${conv.containerName} {`);
		lines.push('    companion object {');
	}

	const indent = isCompanion ? '        ' : isObject ? '    ' : '';

	const grouped = groupEntries(entries);
	for (const [groupLabel, gEntries] of grouped) {
		lines.push(`${indent}// ${groupLabel}`);
		for (const entry of gEntries) {
			const propName = resolveNameFromMap(entry.shortKey, conv.nameMap, conv.namingStyle);
			const { value: v } = entry;

			if (conv.customDataClass) {
				const args = buildKotlinDataClassArgs(v, conv.dataClassProps);
				lines.push(`${indent}val ${propName} = ${conv.customDataClass}(${args})`);
			} else {
				const lsFormatted = v.letterSpacing === 0 ? '0.sp' : `(${v.letterSpacing}).sp`;
				const fontFamilyComment = hasReference ? '' : ' // TODO: replace with bundled font';
				lines.push(`${indent}val ${propName} = TextStyle(`);
				lines.push(`${indent}    fontFamily = FontFamily.Default,${fontFamilyComment}`);
				lines.push(`${indent}    fontSize = ${v.fontSize}.sp,`);
				lines.push(`${indent}    fontWeight = ${kotlinWeight(v.fontWeight)},`);
				lines.push(`${indent}    lineHeight = ${v.lineHeight}.sp,`);
				lines.push(`${indent}    letterSpacing = ${lsFormatted},`);
				lines.push(`${indent})`);
			}
		}
		lines.push('');
	}

	if (isCompanion) {
		lines.push('    }');
		lines.push('}');
	} else if (isObject) {
		lines.push('}');
	}
	lines.push('');

	if (conv.includesM3Builder) {
		lines.push(
			'// Material3 Typography builder — pass to MaterialTheme(typography = appTypography())'
		);
		lines.push('// TODO: map your token objects to M3 text style roles below.');
		lines.push('fun appTypography() = Typography(');
		lines.push(`    // displayLarge   = ${conv.containerName}.xlargeTitleR,`);
		lines.push(`    // headlineLarge  = ${conv.containerName}.largeTitleR,`);
		lines.push(`    // titleLarge     = ${conv.containerName}.title1R,`);
		lines.push(`    // bodyLarge      = ${conv.containerName}.bodyR,`);
		lines.push(`    // bodyMedium     = ${conv.containerName}.subheadR,`);
		lines.push(`    // bodySmall      = ${conv.containerName}.footnoteR,`);
		lines.push(`    // labelSmall     = ${conv.containerName}.captionR,`);
		lines.push(')');
		lines.push('');
	}

	return {
		filename: defFilename,
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}

function generateKotlinClass(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['kotlin'],
	filename?: string
): TransformResult {
	const lines: string[] = [];
	const clsName = conv.className ?? conv.containerName;
	const defFilename = filename ?? 'Typography.kt';

	lines.push(`// ${defFilename}`);
	lines.push(...fileHeaderLines('//', true));
	lines.push('');

	lines.push(...bugWarningBlock(conv.bugWarnings, '//'));

	lines.push(`package ${conv.packageName}`);
	lines.push('');

	if (conv.isImmutable) lines.push('import androidx.compose.runtime.Immutable');
	lines.push('import androidx.compose.ui.text.TextStyle');
	lines.push('import androidx.compose.ui.text.font.FontFamily');
	lines.push('import androidx.compose.ui.text.font.FontWeight');
	if (conv.includesLineHeightStyle) {
		lines.push('import androidx.compose.ui.text.style.LineHeightStyle');
	}
	lines.push('import androidx.compose.ui.unit.sp');
	lines.push('');

	const propNames = entries.map((e) => resolveNameFromMap(e.shortKey, conv.nameMap, conv.namingStyle));

	if (conv.isImmutable) lines.push('@Immutable');
	lines.push(`class ${clsName} internal constructor(`);
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`    val ${propNames[i]}: TextStyle${comma}`);
	}
	lines.push(') {');
	lines.push('');

	lines.push('    constructor(');
	lines.push('        defaultFontFamily: FontFamily = FontFamily.Default,');
	lines.push('');
	for (let i = 0; i < entries.length; i++) {
		const { value: v } = entries[i];
		const lsFormatted = v.letterSpacing === 0 ? '0.sp' : `(${v.letterSpacing}).sp`;
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]}: TextStyle = TextStyle(`);
		lines.push(`            fontWeight = ${kotlinWeight(v.fontWeight)},`);
		lines.push(`            fontSize = ${v.fontSize}.sp,`);
		lines.push(`            lineHeight = ${v.lineHeight}.sp,`);
		lines.push(`            letterSpacing = ${lsFormatted},`);
		if (conv.includesLineHeightStyle) {
			lines.push('            lineHeightStyle = LineHeightStyle(');
			lines.push('                alignment = LineHeightStyle.Alignment.Center,');
			lines.push('                trim = LineHeightStyle.Trim.None');
			lines.push('            )');
		}
		lines.push(`        )${comma}`);
	}
	lines.push(`    ) : this(`);
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]} = ${propNames[i]}.withDefaultFontFamily(defaultFontFamily)${comma}`);
	}
	lines.push('    )');
	lines.push('');

	lines.push('    fun copy(');
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]}: TextStyle = this.${propNames[i]}${comma}`);
	}
	lines.push(`    ): ${clsName} = ${clsName}(`);
	for (let i = 0; i < entries.length; i++) {
		const comma = i < entries.length - 1 ? ',' : '';
		lines.push(`        ${propNames[i]} = ${propNames[i]}${comma}`);
	}
	lines.push('    )');
	lines.push('');

	lines.push('    override fun equals(other: Any?): Boolean {');
	lines.push('        if (this === other) return true');
	lines.push(`        if (other !is ${clsName}) return false`);
	for (const name of propNames) {
		lines.push(`        if (${name} != other.${name}) return false`);
	}
	lines.push('        return true');
	lines.push('    }');
	lines.push('');

	lines.push('    override fun hashCode(): Int {');
	lines.push(`        var result = ${propNames[0]}.hashCode()`);
	for (let i = 1; i < propNames.length; i++) {
		lines.push(`        result = 31 * result + ${propNames[i]}.hashCode()`);
	}
	lines.push('        return result');
	lines.push('    }');
	lines.push('');

	lines.push('    override fun toString(): String = ""');
	lines.push('}');
	lines.push('');

	lines.push('private fun TextStyle.withDefaultFontFamily(default: FontFamily): TextStyle {');
	lines.push('    return if (fontFamily != null) this else copy(fontFamily = default)');
	lines.push('}');
	lines.push('');

	return {
		filename: defFilename,
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}

function generateKotlinAccessor(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['kotlin'],
	scope: KotlinTypographyScope
): TransformResult {
	const lines: string[] = [];
	const enumName = scope.accessorClassName ?? 'LocalTypography';
	const containerRef = scope.accessorContainerRef ?? 'LocalTypography';
	const accFilename = scope.accessorFilename ?? `${enumName}.kt`;

	lines.push(`// ${accFilename}`);
	lines.push(...fileHeaderLines('//', true));
	lines.push('');
	lines.push(`package ${conv.packageName}`);
	lines.push('');
	lines.push('import androidx.compose.material3.MaterialTheme');
	lines.push('import androidx.compose.runtime.Composable');
	lines.push('import androidx.compose.ui.text.TextStyle');
	if (conv.packageName !== 'com.example.design') {
		lines.push(`import ${conv.packageName.replace(/\.\w+$/, '')}.${containerRef}`);
	}
	lines.push('');

	const propNames = entries.map((e) => resolveNameFromMap(e.shortKey, conv.nameMap, conv.namingStyle));

	lines.push(`enum class ${enumName} {`);
	const grouped = groupEntries(entries);
	let firstGroup = true;
	for (const [groupLabel, gEntries] of grouped) {
		if (!firstGroup) lines.push('');
		firstGroup = false;
		for (const entry of gEntries) {
			const name = resolveNameFromMap(entry.shortKey, conv.nameMap, conv.namingStyle);
			lines.push(`    ${name},`);
		}
	}

	lines.push('    ;');
	lines.push('    val textStyle: TextStyle');
	lines.push('        @Composable');
	lines.push('        get() = when (this) {');
	for (const name of propNames) {
		lines.push(`            ${name} -> {`);
		lines.push(`                MaterialTheme.${containerRef}.${name}`);
		lines.push('            }');
	}
	lines.push('        }');
	lines.push('}');
	lines.push('');

	return {
		filename: accFilename,
		content: lines.join('\n') + '\n',
		format: 'kotlin',
		platform: 'android'
	};
}

function buildKotlinDataClassArgs(v: { fontWeight: number; fontSize: number; lineHeight: number; letterSpacing: number }, props: string[]): string {
	const args: string[] = [];
	for (const prop of props) {
		if (prop === 'fontWeight') args.push(`fontWeight = ${kotlinWeight(v.fontWeight)}`);
		else if (prop === 'fontSize') args.push(`fontSize = ${v.fontSize}f`);
		else if (prop === 'lineHeight') args.push(`lineHeight = ${v.lineHeight}f`);
		else if (prop === 'letterSpacing') args.push(`letterSpacing = ${v.letterSpacing}f`);
	}
	return args.join(', ');
}
