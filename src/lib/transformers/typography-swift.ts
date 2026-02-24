import type { ParsedEntry, DetectedTypographyConventions } from './typography.js';
import type { TransformResult } from '$lib/types.js';
import { resolveNameFromMap, groupEntries, fileHeaderLines } from './typography.js';

const SWIFT_WEIGHTS: Record<number, string> = {
	100: '.ultraLight',
	200: '.thin',
	300: '.light',
	400: '.regular',
	500: '.medium',
	600: '.semibold',
	700: '.bold',
	800: '.heavy',
	900: '.black'
};

function swiftWeight(w: number): string {
	return SWIFT_WEIGHTS[w] ?? '.regular';
}

function swiftTextStyle(fontSize: number): string {
	if (fontSize >= 34) return '.largeTitle';
	if (fontSize >= 28) return '.title';
	if (fontSize >= 22) return '.title2';
	if (fontSize >= 20) return '.title3';
	if (fontSize >= 17) return '.body';
	if (fontSize >= 15) return '.subheadline';
	if (fontSize >= 13) return '.footnote';
	if (fontSize >= 12) return '.caption';
	return '.caption2';
}

export function detectSwiftConventions(content: string): DetectedTypographyConventions['swift'] {
	const lines = content.split('\n');

	const enumMatch = lines
		.find((l) => /^\s*(?:public\s+)?enum\s+\w+/.test(l))
		?.match(/enum\s+(\w+)/);
	const hasEnumCases = lines.some((l) => /^\s*case\s+\w+/.test(l));
	const isEnum = !!enumMatch && hasEnumCases;

	const structMatch = lines
		.find((l) => /^\s*(?:public\s+)?struct\s+\w+/.test(l) && !/ViewModifier/.test(l))
		?.match(/struct\s+(\w+)/);

	const architecture: 'enum' | 'struct' = isEnum ? 'enum' : 'struct';
	const typeName = (isEnum ? enumMatch?.[1] : structMatch?.[1]) ?? 'TypographyStyle';

	let dataStructName: string | null = null;
	const dataStructProps: string[] = [];

	if (isEnum) {
		const fontDataReturnMatch = content.match(/var\s+fontData\s*:\s*(\w+)/);
		if (fontDataReturnMatch) {
			dataStructName = fontDataReturnMatch[1];
		} else {
			const allStructs = lines.filter((l) => /^\s*(?:public\s+)?struct\s+\w+/.test(l));
			for (const sl of allStructs) {
				const sm = sl.match(/struct\s+(\w+)/);
				if (sm && sm[1] !== typeName && !/ViewModifier|Constants/.test(sl)) {
					dataStructName = sm[1];
					break;
				}
			}
		}
		if (dataStructName) {
			let inStruct = false;
			let braceDepth = 0;
			for (const line of lines) {
				if (line.includes(`struct ${dataStructName}`)) {
					inStruct = true;
					braceDepth = 0;
				}
				if (inStruct) {
					braceDepth += (line.match(/\{/g) || []).length;
					braceDepth -= (line.match(/\}/g) || []).length;
					const propMatch = line.match(/\b(?:let|var)\s+(\w+)\s*:/);
					if (propMatch) dataStructProps.push(propMatch[1]);
					if (braceDepth <= 0 && inStruct && line.includes('}')) break;
				}
			}
		}
	}

	const hasUIKit = lines.some((l) => /\bUIFont\b|\bimport\s+UIKit\b/.test(l));
	const hasSwiftUI = lines.some(
		(l) => /\bimport\s+SwiftUI\b|\bFont\.system\b|\bFont\.custom\b/.test(l)
	);
	const uiFramework: 'uikit' | 'swiftui' | 'both' =
		hasUIKit && hasSwiftUI ? 'both' : hasUIKit ? 'uikit' : 'swiftui';

	const includesTracking = lines.some(
		(l) => /\btracking\b|\bletterSpacing\b/i.test(l) && !l.trim().startsWith('//')
	);

	let usesDynamicTypeScaling = false;
	let dynamicTypeMethodName: string | null = null;

	const dynamicMethodMatch = content.match(
		/\bstatic\s+func\s+(\w+)\s*\(\s*_\s+\w+\s*:\s*CGFloat/
	);
	if (dynamicMethodMatch) {
		const candidateName = dynamicMethodMatch[1];
		const hasContentSizeRef =
			/UIContentSizeCategory|preferredContentSizeCategory/.test(content);
		const isCalledInReturn = new RegExp(
			`${typeName}\\.${candidateName}\\(|self\\.${candidateName}\\(`
		).test(content);
		if (hasContentSizeRef || isCalledInReturn) {
			usesDynamicTypeScaling = true;
			dynamicTypeMethodName = candidateName;
		}
	}

	const nameMap: Record<string, string> = {};
	for (const line of lines) {
		const m = isEnum
			? line.match(/^\s*case\s+(\w+)/)
			: line.match(/^\s*static\s+let\s+(\w+)/);
		if (m) nameMap[m[1].toLowerCase()] = m[1];
	}

	return {
		architecture,
		typeName,
		dataStructName,
		dataStructProps,
		uiFramework,
		includesTracking,
		usesDynamicTypeScaling,
		dynamicTypeMethodName,
		nameMap
	};
}

export function generateSwift(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['swift']
): TransformResult {
	return conv.architecture === 'enum'
		? generateSwiftEnum(entries, conv)
		: generateSwiftStruct(entries, conv);
}

function buildSwiftDataStructArgs(
	v: { fontWeight: number; fontSize: number; lineHeight: number; letterSpacing: number },
	props: string[],
	wrapFn?: string
): string {
	const wrap = (val: number) => (wrapFn ? `${wrapFn}(${val})` : `${val}`);
	const args: string[] = [];
	for (const prop of props) {
		if (prop === 'fontWeight') {
			args.push(`fontWeight: ${swiftWeight(v.fontWeight)}`);
		} else if (prop === 'size' || prop === 'fontSize') {
			args.push(`${prop}: ${wrap(v.fontSize)}`);
		} else if (prop === 'lineHeight') {
			args.push(`lineHeight: ${wrap(v.lineHeight)}`);
		} else if (prop === 'tracking' || prop === 'letterSpacing') {
			args.push(`${prop}: ${v.letterSpacing}`);
		}
	}
	return args.join(', ');
}

function generateSwiftStruct(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['swift']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.swift');
	lines.push(...fileHeaderLines('//', true));
	lines.push('');
	lines.push('import SwiftUI');
	lines.push('');

	lines.push('// MARK: - Typography Style');
	const propsDesc = conv.includesTracking
		? 'its tracking and line-spacing values'
		: 'its line-spacing value';
	lines.push(`/// Bundles a SwiftUI Font with ${propsDesc}.`);
	lines.push('/// Apply with: Text("…").typography(.bodyR)');
	lines.push(`public struct ${conv.typeName} {`);
	lines.push('  public let font: Font');
	if (conv.includesTracking) {
		lines.push('  /// Letter-spacing in points (Figma "letterSpacing" value).');
		lines.push('  public let tracking: CGFloat');
	}
	lines.push('  /// Extra space added between lines: lineHeight − fontSize.');
	lines.push('  public let lineSpacing: CGFloat');
	lines.push('');
	const initParams = conv.includesTracking
		? 'font: Font, tracking: CGFloat = 0, lineSpacing: CGFloat = 0'
		: 'font: Font, lineSpacing: CGFloat = 0';
	lines.push(`  public init(${initParams}) {`);
	lines.push('    self.font = font');
	if (conv.includesTracking) lines.push('    self.tracking = tracking');
	lines.push('    self.lineSpacing = lineSpacing');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	lines.push('// MARK: - Typography Modifier');
	lines.push('private struct TypographyModifier: ViewModifier {');
	lines.push(`  let style: ${conv.typeName}`);
	lines.push('');
	lines.push('  func body(content: Content) -> some View {');
	lines.push('    content');
	lines.push('      .font(style.font)');
	if (conv.includesTracking) lines.push('      .tracking(style.tracking)');
	lines.push('      .lineSpacing(style.lineSpacing)');
	lines.push('  }');
	lines.push('}');
	lines.push('');
	lines.push('public extension View {');
	lines.push('  /// Apply a Figma text style. Example: Text("Hello").typography(.bodyR)');
	lines.push(`  func typography(_ style: ${conv.typeName}) -> some View {`);
	lines.push('    modifier(TypographyModifier(style: style))');
	lines.push('  }');
	lines.push('}');
	lines.push('');

	lines.push('// MARK: - Typography Tokens');
	lines.push('// Note: SF Pro is the iOS system font — Font.system() is correct and preferred.');
	lines.push(
		'// relativeTo: maps to a Dynamic Type text style so fonts scale with accessibility settings.'
	);
	lines.push(
		'// lineSpacing = Figma lineHeight − fontSize (approximation for SwiftUI lineSpacing).'
	);
	lines.push(`public extension ${conv.typeName} {`);

	const grouped = groupEntries(entries);
	for (const [groupLabel, gEntries] of grouped) {
		lines.push(`  // ${groupLabel}`);
		for (const entry of gEntries) {
			const propName = resolveNameFromMap(entry.shortKey, conv.nameMap);
			const { value: v } = entry;
			const isSfPro = v.fontFamily.toLowerCase().startsWith('sf pro');
			const textStyle = swiftTextStyle(v.fontSize);
			const fontExpr = isSfPro
				? `Font.system(size: ${v.fontSize}, weight: ${swiftWeight(v.fontWeight)}, design: .default)`
				: `Font.custom("${v.fontFamily}", size: ${v.fontSize}, relativeTo: ${textStyle}).weight(${swiftWeight(v.fontWeight)})`;
			const lineSpacing = Math.max(0, v.lineHeight - v.fontSize);
			const hasTracking = conv.includesTracking && v.letterSpacing !== 0;
			if (hasTracking) {
				lines.push(
					`  static let ${propName} = ${conv.typeName}(font: ${fontExpr}, tracking: ${v.letterSpacing}, lineSpacing: ${lineSpacing})`
				);
			} else {
				lines.push(
					`  static let ${propName} = ${conv.typeName}(font: ${fontExpr}, lineSpacing: ${lineSpacing})`
				);
			}
		}
	}

	lines.push('}');
	lines.push('');

	return {
		filename: 'Typography.swift',
		content: lines.join('\n') + '\n',
		format: 'swift',
		platform: 'ios'
	};
}

function generateSwiftEnum(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['swift']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.swift');
	lines.push(...fileHeaderLines('//', true));
	lines.push('');

	if (conv.uiFramework === 'uikit' || conv.uiFramework === 'both') {
		lines.push('import Foundation');
		lines.push('import UIKit');
	}
	if (conv.uiFramework === 'swiftui' || conv.uiFramework === 'both') {
		lines.push('import SwiftUI');
	}
	lines.push('');

	lines.push(`public enum ${conv.typeName}: String {`);
	const grouped = groupEntries(entries);
	for (const [, gEntries] of grouped) {
		lines.push('');
		for (const entry of gEntries) {
			lines.push(`    case ${resolveNameFromMap(entry.shortKey, conv.nameMap)}`);
		}
	}
	lines.push('');
	lines.push('}');
	lines.push('');

	if (conv.usesDynamicTypeScaling) {
		lines.push('struct FontConstants {');
		lines.push('');
		lines.push('    static let addingRatio: CGFloat = 1.5');
		lines.push('    static let subtractingRatio: CGFloat = -1.0');
		lines.push('');
		lines.push('}');
		lines.push('');
	}

	const structName = conv.dataStructName ?? 'FontData';
	const props =
		conv.dataStructProps.length > 0 ? conv.dataStructProps : ['fontWeight', 'size', 'lineHeight'];

	const wrapFn = conv.usesDynamicTypeScaling && conv.dynamicTypeMethodName
		? `${conv.typeName}.${conv.dynamicTypeMethodName}`
		: undefined;

	lines.push(`extension ${conv.typeName} {`);
	lines.push('');
	lines.push(`    var fontData: ${structName} {`);
	lines.push('');
	lines.push('        switch self {');

	for (const [, gEntries] of grouped) {
		lines.push('');
		for (const entry of gEntries) {
			const name = resolveNameFromMap(entry.shortKey, conv.nameMap);
			lines.push(`        case .${name}:`);
			lines.push(
				`            return ${structName}(${buildSwiftDataStructArgs(entry.value, props, wrapFn)})`
			);
		}
	}

	lines.push('');
	lines.push('        }');
	lines.push('');
	lines.push('    }');

	if (conv.usesDynamicTypeScaling && conv.dynamicTypeMethodName) {
		lines.push('');
		lines.push(`    public static func ${conv.dynamicTypeMethodName}(_ standardFontSize: CGFloat, fmax: CGFloat = .infinity, fmin: CGFloat = 11) -> CGFloat {`);
		lines.push('');
		lines.push('        var contentSize: UIContentSizeCategory = .large');
		lines.push('        if UIAccessibility.isLargerTextEnabled {');
		lines.push('            contentSize = UIApplication.shared.preferredContentSizeCategory');
		lines.push('        }');
		lines.push('');
		lines.push('        let minFontSize = standardFontSize < fmin ? standardFontSize : fmin');
		lines.push('        let maxFontSize = standardFontSize > fmax ? standardFontSize : fmax');
		lines.push('        switch contentSize {');
		lines.push('        case .extraSmall:');
		lines.push('            return max(minFontSize, standardFontSize + (FontConstants.subtractingRatio * 3))');
		lines.push('        case .small:');
		lines.push('            return max(minFontSize, standardFontSize + (FontConstants.subtractingRatio * 2))');
		lines.push('        case .medium:');
		lines.push('            return max(minFontSize, standardFontSize + (FontConstants.subtractingRatio * 1))');
		lines.push('        case .large:');
		lines.push('            return standardFontSize');
		lines.push('        case .extraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 1))');
		lines.push('        case .extraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 1.5))');
		lines.push('        case .extraExtraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 2))');
		lines.push('        case .accessibilityMedium:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 3))');
		lines.push('        case .accessibilityLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 3.5))');
		lines.push('        case .accessibilityExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 4))');
		lines.push('        case .accessibilityExtraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 4.5))');
		lines.push('        case .accessibilityExtraExtraExtraLarge:');
		lines.push('            return min(maxFontSize, standardFontSize + (FontConstants.addingRatio * 5))');
		lines.push('        default:');
		lines.push('            return standardFontSize');
		lines.push('        }');
		lines.push('    }');
	}

	lines.push('');
	lines.push('}');
	lines.push('');

	if (conv.uiFramework === 'uikit' || conv.uiFramework === 'both') {
		lines.push(`extension ${conv.typeName} {`);
		lines.push('');
		lines.push('    public var font: UIFont {');
		lines.push(
			'        return UIFont.systemFont(ofSize: fontData.size, weight: fontData.fontWeight)'
		);
		lines.push('    }');
		if (conv.uiFramework === 'both') {
			lines.push('');
			lines.push('    public var suiFont: Font {');
			lines.push('        return Font(font)');
			lines.push('    }');
		}
		lines.push('');
		lines.push('}');
		lines.push('');
	}

	const weightType =
		conv.uiFramework === 'uikit' || conv.uiFramework === 'both'
			? 'UIFont.Weight'
			: 'Font.Weight';

	lines.push(`public struct ${structName} {`);
	lines.push('');
	for (const prop of props) {
		if (prop === 'fontWeight') {
			lines.push(`    let ${prop}: ${weightType}`);
		} else {
			lines.push(`    let ${prop}: CGFloat`);
		}
	}
	lines.push('');
	lines.push('}');
	lines.push('');

	return {
		filename: 'Typography.swift',
		content: lines.join('\n') + '\n',
		format: 'swift',
		platform: 'ios'
	};
}
