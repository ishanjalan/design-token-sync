import type { ParsedEntry, DetectedTypographyConventions } from './typography.js';
import type { TransformResult } from '$lib/types.js';
import { pxToRem, pxToEm, groupEntries, kebabToCamel, fileHeaderLines } from './typography.js';

export function detectTsConventions(content: string): DetectedTypographyConventions['ts'] {
	const lines = content.split('\n');

	const exportConsts = lines.filter((l) => /^export\s+const\s/.test(l.trim()));
	const privateConsts = lines.filter(
		(l) => /^const\s+[A-Z]/.test(l.trim()) && !l.trim().startsWith('export')
	);

	const isScreaming = exportConsts.some((l) => /export\s+const\s+[A-Z_]+\s/.test(l));
	const namingCase: 'SCREAMING_SNAKE' | 'camelCase' = isScreaming ? 'SCREAMING_SNAKE' : 'camelCase';

	const firstExport = exportConsts[0]?.trim() ?? '';
	const prefixMatch = firstExport.match(/export\s+const\s+([A-Z]+_)/);
	const constPrefix = prefixMatch ? prefixMatch[1] : 'FONT_';

	const includesFontFamily = lines.some(
		(l) => l.includes('fontFamily') && !l.trim().startsWith('//')
	);

	const hasInterface = lines.some((l) => /^(export\s+)?interface\s/.test(l.trim()));
	const interfaceMatch = lines
		.find((l) => /^(export\s+)?interface\s/.test(l.trim()))
		?.match(/interface\s+(\w+)/);
	const interfaceName = interfaceMatch?.[1] ?? null;

	const valueFormat: 'string' | 'number' =
		lines.some((l) => /fontSize:\s*'/.test(l)) ? 'string' : 'number';

	const twoTier = privateConsts.length > 0 && exportConsts.some((l) => /=\s+[A-Z_]+\s*;/.test(l));

	const exportWeights = exportConsts.some((l) => /WEIGHT/.test(l));

	return {
		namingCase,
		constPrefix,
		includesFontFamily,
		hasInterface,
		interfaceName,
		valueFormat,
		twoTier,
		exportWeights
	};
}

function kebabToScreaming(key: string, prefix: string): string {
	return prefix + key.toUpperCase().replace(/-/g, '_');
}

function kebabToSemanticScreaming(key: string, prefix: string): string {
	const semantic = key.replace(/-r$/, '').replace(/-/g, '_').toUpperCase();
	return prefix + semantic;
}

export function generateTs(
	entries: ParsedEntry[],
	conv: DetectedTypographyConventions['ts']
): TransformResult {
	const lines: string[] = [];
	lines.push('// Typography.ts');
	lines.push(...fileHeaderLines('//', true));
	lines.push('');

	if (conv.twoTier) {
		if (conv.exportWeights) {
			const weights = new Set(entries.map((e) => e.value.fontWeight));
			for (const w of [...weights].sort((a, b) => a - b)) {
				lines.push(`export const ${conv.constPrefix}WEIGHT_${w} = ${w};`);
			}
			lines.push('');
		}

		for (const entry of entries) {
			const sizeConst = kebabToScreaming(entry.fullKey, conv.constPrefix);
			const v = entry.value;
			lines.push(`const ${sizeConst} = {`);
			if (conv.includesFontFamily) {
				lines.push(`  fontFamily: '${v.fontFamily}',`);
			}
			if (conv.valueFormat === 'string') {
				lines.push(`  fontSize: '${pxToRem(v.fontSize)}',`);
				lines.push(`  lineHeight: '${pxToRem(v.lineHeight)}',`);
				lines.push(`  letterSpacing: '${v.letterSpacing}px',`);
			} else {
				lines.push(`  fontSize: ${v.fontSize},`);
				lines.push(`  lineHeight: ${v.lineHeight},`);
				lines.push(`  letterSpacing: ${v.letterSpacing},`);
			}
			lines.push('};');
		}
		lines.push('');

		lines.push('// Typography objects with descriptive names for easy usage');
		for (const entry of entries) {
			const sizeConst = kebabToScreaming(entry.fullKey, conv.constPrefix);
			const semanticName = kebabToSemanticScreaming(entry.fullKey, conv.constPrefix);
			lines.push(`export const ${semanticName} = ${sizeConst};`);
		}
	} else {
		if (conv.hasInterface && conv.interfaceName) {
			lines.push(`export interface ${conv.interfaceName} {`);
			if (conv.includesFontFamily) {
				lines.push('  fontFamily: string;');
			}
			lines.push('  fontSize: number; // px (raw Figma value)');
			lines.push("  fontSizeRem: string; // e.g. \"1rem\"");
			lines.push('  fontWeight: number;');
			lines.push('  lineHeight: number; // px (raw Figma value)');
			lines.push('  lineHeightUnitless: number; // e.g. 1.5');
			lines.push('  letterSpacing: number; // px (raw Figma value)');
			lines.push("  letterSpacingEm: string; // e.g. \"0.0313em\"");
			lines.push('}');
			lines.push('');
		}

		const grouped = groupEntries(entries);
		const typeAnnotation = conv.hasInterface && conv.interfaceName ? `: ${conv.interfaceName}` : '';

		for (const [groupLabel, groupEntries_] of grouped) {
			lines.push(`// ${groupLabel}`);
			for (const entry of groupEntries_) {
				const constName =
					conv.namingCase === 'SCREAMING_SNAKE'
						? kebabToScreaming(entry.fullKey, conv.constPrefix)
						: kebabToCamel(`${conv.constPrefix}${entry.fullKey}`);
				const v = entry.value;
				const lhUnitless =
					v.fontSize === 0 ? 1 : parseFloat((v.lineHeight / v.fontSize).toFixed(4));
				lines.push(`export const ${constName}${typeAnnotation} = {`);
				if (conv.includesFontFamily) {
					lines.push(`  fontFamily: '${v.fontFamily}',`);
				}
				lines.push(`  fontSize: ${v.fontSize},`);
				lines.push(`  fontSizeRem: '${pxToRem(v.fontSize)}',`);
				lines.push(`  fontWeight: ${v.fontWeight},`);
				lines.push(`  lineHeight: ${v.lineHeight},`);
				lines.push(`  lineHeightUnitless: ${lhUnitless},`);
				lines.push(`  letterSpacing: ${v.letterSpacing},`);
				lines.push(`  letterSpacingEm: '${pxToEm(v.letterSpacing, v.fontSize)}',`);
				lines.push('} as const;');
			}
			lines.push('');
		}
	}

	return {
		filename: 'Typography.ts',
		content: lines.join('\n') + '\n',
		format: 'typescript',
		platform: 'web'
	};
}
