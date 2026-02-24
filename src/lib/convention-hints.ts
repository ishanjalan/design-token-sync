import type { DropZoneKey } from './types.js';
import { detectConventions } from './transformers/naming.js';
import { detectSwiftConventions } from './transformers/swift.js';
import { detectKotlinConventions } from './transformers/kotlin.js';
import { detectTypographyConventions } from './transformers/typography.js';

/**
 * Run the appropriate convention detection for a reference slot and return
 * a compact array of human-readable tags such as
 * ["enum-based", "Color hex", "dynamic Light/Dark"].
 */
export function computeConventionHints(key: DropZoneKey, content: string): string[] {
	if (!content.trim()) return [];

	switch (key) {
		case 'referenceColorsWeb':
			return webColorHints(content);
		case 'referenceTypographyWeb':
			return webTypoHints(content);
		case 'referenceColorsSwift':
			return swiftColorHints(content);
		case 'referenceColorsKotlin':
			return kotlinColorHints(content);
		case 'referenceTypographySwift':
			return swiftTypoHints(content);
		case 'referenceTypographyKotlin':
			return kotlinTypoHints(content);
		default:
			return [];
	}
}

function webColorHints(content: string): string[] {
	const hints: string[] = [];
	const isScss = /^\$[\w-]+\s*:/m.test(content);
	const isTs = /export\s+(const|let|var)\s+/m.test(content);
	const scssArg = isScss ? content : undefined;
	const tsArg = isTs ? content : undefined;
	const conv = detectConventions(scssArg, scssArg, tsArg, tsArg, false);

	if (isScss) {
		hints.push('SCSS');
		hints.push(conv.scssSeparator === 'hyphen' ? 'kebab-case' : 'underscore');
		if (conv.scssColorStructure === 'modern') hints.push('modern structure');
	}
	if (isTs) {
		hints.push('TypeScript');
		hints.push(conv.tsNamingCase.replace('_', ' '));
		if (conv.hasTypeAnnotations) hints.push('typed');
	}
	if (!isScss && !isTs) {
		const isCss = /--[\w-]+\s*:/m.test(content);
		if (isCss) hints.push('CSS variables');
	}
	return hints;
}

function webTypoHints(content: string): string[] {
	const hints: string[] = [];
	const isScss = /^\$[\w-]+\s*:/m.test(content);
	const isTs = /export\s+(const|let|var)\s+/m.test(content);
	const scssContent = isScss ? content : undefined;
	const tsContent = isTs ? content : undefined;
	const conv = detectTypographyConventions(scssContent, tsContent, false);

	if (isScss) {
		hints.push('SCSS');
		if (conv.scss.hasMixins) hints.push('mixins');
		if (conv.scss.hasCssCustomProperties) hints.push('CSS vars');
		hints.push(conv.scss.sizeUnit);
		if (conv.scss.twoTier) hints.push('two-tier');
	}
	if (isTs) {
		hints.push('TypeScript');
		hints.push(conv.ts.namingCase === 'SCREAMING_SNAKE' ? 'SCREAMING_SNAKE' : 'camelCase');
		if (conv.ts.hasInterface) hints.push(`interface ${conv.ts.interfaceName ?? ''}`);
		if (conv.ts.twoTier) hints.push('two-tier');
	}
	return hints;
}

function swiftColorHints(content: string): string[] {
	const conv = detectSwiftConventions(content, false);
	const hints: string[] = [];
	hints.push(conv.containerStyle === 'enum' ? 'enum-based' : 'extension-based');
	hints.push(conv.primitiveFormat === 'colorHex' ? 'Color hex' : 'string hex');
	hints.push(conv.semanticFormat === 'dynamic' ? 'dynamic Light/Dark' : 'flat Light/Dark');
	hints.push(conv.namingCase === 'camel' ? 'camelCase' : 'snake_case');
	if (conv.hasUIColorTier) hints.push('UIColor tier');
	if (conv.primitiveEnumName) hints.push(conv.primitiveEnumName);
	return hints;
}

function kotlinColorHints(content: string): string[] {
	const conv = detectKotlinConventions(content, false);
	const hints: string[] = [];
	hints.push(conv.namingCase === 'pascal' ? 'PascalCase' : 'camelCase');
	if (conv.objectName) hints.push(`object ${conv.objectName}`);
	if (conv.kotlinPackage && conv.kotlinPackage !== 'com.example.design') {
		hints.push(conv.kotlinPackage.split('.').slice(-1)[0]);
	}
	return hints;
}

function swiftTypoHints(content: string): string[] {
	const conv = detectTypographyConventions(undefined, undefined, false, content);
	const s = conv.swift;
	const hints: string[] = [];
	hints.push(s.architecture === 'enum' ? 'enum' : 'struct');
	if (s.typeName) hints.push(s.typeName);
	hints.push(s.uiFramework === 'swiftui' ? 'SwiftUI' : s.uiFramework === 'uikit' ? 'UIKit' : 'UIKit+SwiftUI');
	if (s.usesDynamicTypeScaling) hints.push('dynamic type');
	if (s.dataStructName) hints.push(s.dataStructName);
	return hints;
}

function kotlinTypoHints(content: string): string[] {
	const conv = detectTypographyConventions(undefined, undefined, false, undefined, content);
	const k = conv.kotlin;
	const hints: string[] = [];
	if (k.architecture === 'class' && k.isImmutable) {
		hints.push('@Immutable class');
	} else {
		hints.push(k.architecture);
	}
	if (k.containerName) hints.push(k.containerName);
	hints.push(k.namingStyle);
	if (k.usesTextStyle) hints.push('TextStyle');
	if (k.includesLineHeightStyle) hints.push('LineHeightStyle');
	if (k.customDataClass) hints.push(k.customDataClass);
	return hints;
}
