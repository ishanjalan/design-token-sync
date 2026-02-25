import type { ParsedEntry, DetectedTypographyConventions } from './typography.js';
import type { TransformResult } from '$lib/types.js';
import { pxToRem, unitlessLineHeight, pxToEm, groupEntries, kebabToCamel, fileHeaderLines } from './typography.js';

export function detectScssConventions(content: string): DetectedTypographyConventions['scss'] {
	const lines = content.split('\n');

	const varLines = lines.filter((l) => /^\$[\w-]+:\s/.test(l.trim()));
	const firstVar = varLines[0]?.trim() ?? '';
	const varMatch = firstVar.match(/^\$([\w-]+?)-(?:size|height|spacing|weight)/);
	const varPrefix = varMatch ? `$${varMatch[1]}-` : '$font-';

	const hasCssCustomProperties = lines.some((l) => l.includes(':root') || l.includes('--'));
	const hasMixins = lines.some((l) => /^@mixin\s/.test(l.trim()));
	const allMixinNames = lines
		.filter((l) => /^@mixin\s/.test(l.trim()))
		.map((l) => l.trim().match(/@mixin\s+([\w-]+)/)?.[1] ?? '')
		.filter(Boolean);
	const mixinPrefix = commonMixinPrefix(allMixinNames);

	const includesFontFamily = lines.some(
		(l) => l.includes('font-family') && !l.trim().startsWith('//')
	);
	const includesFontWeight = varLines.some((l) => /weight/.test(l));

	const sizeUnit: 'rem' | 'px' = varLines.some((l) => /size.*rem/.test(l)) ? 'rem' : 'px';
	const heightUnit: 'rem' | 'unitless' = varLines.some((l) => /height.*rem/.test(l))
		? 'rem'
		: 'unitless';
	const spacingUnit: 'px' | 'em' = varLines.some((l) => /spacing.*em/.test(l) && !/rem/.test(l))
		? 'em'
		: 'px';

	const twoTier = varLines.length > 0 && hasMixins;

	return {
		varPrefix,
		hasCssCustomProperties,
		hasMixins,
		mixinPrefix,
		includesFontFamily,
		includesFontWeight,
		sizeUnit,
		heightUnit,
		spacingUnit,
		twoTier
	};
}

/** Returns the longest segment-aligned prefix shared by all mixin names. */
function commonMixinPrefix(names: string[]): string {
	if (names.length === 0) return 'font-';
	const segments = names[0].split('-');
	let prefix = '';
	for (const seg of segments) {
		const candidate = `${prefix}${seg}-`;
		if (names.every((n) => n.startsWith(candidate))) {
			prefix = candidate;
		} else {
			break;
		}
	}
	return prefix || 'font-';
}

function kebabToScssSize(key: string): string {
	const parts = key.split('-');
	if (parts.length <= 2) return parts.join('-');
	return parts.slice(0, 2).join('-');
}

function kebabToMixinName(key: string, prefix: string): string {
	return `${prefix}${key}`;
}

export function generateScss(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['scss']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.scss');
	lines.push(...fileHeaderLines('//', true));
	lines.push('');

	const fmtSize = (px: number) => (conv.sizeUnit === 'rem' ? pxToRem(px) : `${px}px`);
	const fmtHeight = (lh: number, fs: number) =>
		conv.heightUnit === 'rem' ? pxToRem(lh) : unitlessLineHeight(lh, fs);
	const fmtSpacing = (ls: number, fs: number) =>
		conv.spacingUnit === 'em' ? pxToEm(ls, fs) : `${ls}px`;

	if (conv.twoTier) {
		const varPfx = conv.varPrefix.replace(/^\$/, '');
		const weights = new Set(entries.map((e) => e.value.fontWeight));

		if (conv.includesFontWeight && weights.size > 0) {
			lines.push('// Font weights');
			for (const w of [...weights].sort((a, b) => a - b)) {
				lines.push(`$${varPfx}weight-${w}: ${w};`);
			}
			lines.push('');
		}

		lines.push('// Font sizes, line heights, and letter spacings');
		const emittedSizeKeys = new Set<string>();
		for (const entry of entries) {
			const sizeKey = kebabToScssSize(entry.fullKey);
			if (emittedSizeKeys.has(sizeKey)) continue;
			emittedSizeKeys.add(sizeKey);
			const { value: v } = entry;
			lines.push(
				`$${varPfx}${sizeKey}-size: ${fmtSize(v.fontSize)};${v.fontSize ? ` // ${fmtSize(v.fontSize)}` + (conv.sizeUnit === 'rem' ? ` * 16 = ${v.fontSize}px` : '') : ''}`
			);
			lines.push(`$${varPfx}${sizeKey}-height: ${fmtHeight(v.lineHeight, v.fontSize)};`);
			lines.push(`$${varPfx}${sizeKey}-spacing: ${fmtSpacing(v.letterSpacing, v.fontSize)};`);
			lines.push('');
		}

		if (conv.hasMixins) {
			lines.push('// Typography mixins for easy usage');
			for (const entry of entries) {
				const sizeKey = kebabToScssSize(entry.fullKey);
				const mixinName = kebabToMixinName(entry.fullKey, conv.mixinPrefix);
				lines.push(`@mixin ${mixinName} {`);
				if (conv.includesFontFamily) {
					lines.push(`  font-family: '${entry.value.fontFamily}', sans-serif;`);
				}
				lines.push(`  font-size: $${varPfx}${sizeKey}-size;`);
				lines.push(`  line-height: $${varPfx}${sizeKey}-height;`);
				lines.push(`  letter-spacing: $${varPfx}${sizeKey}-spacing;`);
				lines.push('}');
				lines.push('');
			}
		}
	} else {
		lines.push(`// Usage: @include ${conv.mixinPrefix}{name}; e.g. @include ${conv.mixinPrefix}body-r;`);
		lines.push('');

		if (conv.hasCssCustomProperties) {
			lines.push('// CSS custom properties — for runtime / JS access');
			lines.push(':root {');
			for (const entry of entries) {
				const { fullKey: k, value: v } = entry;
				if (conv.includesFontFamily) {
					lines.push(`  --${conv.mixinPrefix}${k}-family: '${v.fontFamily}', sans-serif;`);
				}
				lines.push(`  --${conv.mixinPrefix}${k}-size: ${fmtSize(v.fontSize)};`);
				lines.push(`  --${conv.mixinPrefix}${k}-weight: ${v.fontWeight};`);
				lines.push(`  --${conv.mixinPrefix}${k}-line-height: ${fmtHeight(v.lineHeight, v.fontSize)};`);
				lines.push(`  --${conv.mixinPrefix}${k}-letter-spacing: ${fmtSpacing(v.letterSpacing, v.fontSize)};`);
			}
			lines.push('}');
			lines.push('');
		}

		if (conv.hasMixins) {
			const grouped = groupEntries(entries);
			for (const [groupLabel, groupEntries_] of grouped) {
				lines.push(`// ${groupLabel}`);
				for (const entry of groupEntries_) {
					const { fullKey: k, value: v } = entry;
					lines.push(`@mixin ${conv.mixinPrefix}${k} {`);
					if (conv.includesFontFamily) {
						lines.push(`  font-family: '${v.fontFamily}', sans-serif;`);
					}
					lines.push(`  font-size: ${fmtSize(v.fontSize)};`);
					lines.push(`  font-weight: ${v.fontWeight};`);
					lines.push(`  line-height: ${fmtHeight(v.lineHeight, v.fontSize)};`);
					lines.push(`  letter-spacing: ${fmtSpacing(v.letterSpacing, v.fontSize)};`);
					lines.push('}');
				}
				lines.push('');
			}
		}
	}

	return {
		filename: 'Typography.scss',
		content: lines.join('\n') + '\n',
		format: 'scss',
		platform: 'web'
	};
}
