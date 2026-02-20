import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { transformToSCSS } from '$lib/transformers/scss.js';
import { transformToTS } from '$lib/transformers/ts-web.js';
import { transformToCSS } from '$lib/transformers/css.js';
import { transformToSpacing } from '$lib/transformers/spacing.js';
import { transformToSwift } from '$lib/transformers/swift.js';
import { transformToKotlin } from '$lib/transformers/kotlin.js';
import { transformToTypography, countTypographyStyles } from '$lib/transformers/typography.js';
import { transformToShadows, countShadowTokens } from '$lib/transformers/shadow.js';
import { transformToBorders, countBorderTokens } from '$lib/transformers/border.js';
import { transformToOpacity, countOpacityTokens } from '$lib/transformers/opacity.js';
import { detectConventions } from '$lib/transformers/naming.js';
import { buildTokenGraph, detectCycles, formatCycleWarnings } from '$lib/resolve-tokens.js';
import type { RequestHandler } from './$types';
import type { FigmaColorExport, Platform, GenerateWarning } from '$lib/types.js';

const RequestSchema = z.object({
	lightColors: z.record(z.string(), z.unknown()),
	darkColors: z.record(z.string(), z.unknown()),
	values: z.record(z.string(), z.unknown()),
	platforms: z.array(z.enum(['web', 'android', 'ios'])),
	typography: z.record(z.string(), z.unknown()).optional(),
	// Optional reference files for convention detection / diff
	referencePrimitivesScss: z.string().optional(),
	referenceColorsScss: z.string().optional(),
	referencePrimitivesTs: z.string().optional(),
	referenceColorsTs: z.string().optional(),
	referenceColorsSwift: z.string().optional(),
	referenceColorsKotlin: z.string().optional()
});

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function checkFileSize(file: File, label: string): void {
	if (file.size > MAX_FILE_BYTES) {
		throw error(
			413,
			`File "${label}" exceeds the 10 MB size limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`
		);
	}
}

async function optionalFileText(formData: FormData, key: string): Promise<string | undefined> {
	const entry = formData.get(key);
	if (!(entry instanceof File) || entry.size === 0) return undefined;
	checkFileSize(entry, key);
	return entry.text();
}

async function optionalFileJson(
	formData: FormData,
	key: string
): Promise<Record<string, unknown> | undefined> {
	const text = await optionalFileText(formData, key);
	if (!text) return undefined;
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

function countColorTokens(export_: Record<string, unknown>, aliasOnly: boolean): number {
	let count = 0;
	function walk(obj: unknown) {
		if (!obj || typeof obj !== 'object') return;
		const o = obj as Record<string, unknown>;
		if (o.$type === 'color') {
			const hasAlias = !!(o.$extensions as Record<string, unknown> | undefined)?.[
				'com.figma.aliasData'
			];
			if (!aliasOnly || hasAlias) count++;
			return;
		}
		for (const [k, v] of Object.entries(o)) {
			if (!k.startsWith('$')) walk(v);
		}
	}
	walk(export_);
	return count;
}

function countSpacingTokens(values: Record<string, unknown>): number {
	let count = 0;
	function walk(obj: unknown) {
		if (!obj || typeof obj !== 'object') return;
		const o = obj as Record<string, unknown>;
		if (o.$type === 'number') {
			count++;
			return;
		}
		for (const [k, v] of Object.entries(o)) {
			if (!k.startsWith('$')) walk(v);
		}
	}
	walk(values);
	return count;
}

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		const formData = await request.formData();

		const required = ['lightColors', 'darkColors', 'values'];
		const missing = required.filter((k) => !(formData.get(k) instanceof File));
		if (missing.length > 0) {
			throw error(400, `Missing required files: ${missing.join(', ')}`);
		}

		const lightColorsFile = formData.get('lightColors') as File;
		const darkColorsFile = formData.get('darkColors') as File;
		const valuesFile = formData.get('values') as File;

		checkFileSize(lightColorsFile, 'lightColors');
		checkFileSize(darkColorsFile, 'darkColors');
		checkFileSize(valuesFile, 'values');

		const platformsRaw = formData.get('platforms');
		const platforms: Platform[] = platformsRaw
			? (JSON.parse(platformsRaw as string) as Platform[])
			: ['web'];

		body = {
			lightColors: JSON.parse(await lightColorsFile.text()),
			darkColors: JSON.parse(await darkColorsFile.text()),
			values: JSON.parse(await valuesFile.text()),
			platforms,
			typography: await optionalFileJson(formData, 'typography'),
			referencePrimitivesScss: await optionalFileText(formData, 'referencePrimitivesScss'),
			referenceColorsScss: await optionalFileText(formData, 'referenceColorsScss'),
			referencePrimitivesTs: await optionalFileText(formData, 'referencePrimitivesTs'),
			referenceColorsTs: await optionalFileText(formData, 'referenceColorsTs'),
			referenceColorsSwift: await optionalFileText(formData, 'referenceColorsSwift'),
			referenceColorsKotlin: await optionalFileText(formData, 'referenceColorsKotlin')
		};
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(400, 'Could not parse request body');
	}

	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success) {
		throw error(422, `Invalid request: ${parsed.error.message}`);
	}

	const {
		lightColors,
		darkColors,
		values,
		platforms,
		typography,
		referencePrimitivesScss,
		referenceColorsScss,
		referencePrimitivesTs,
		referenceColorsTs,
		referenceColorsSwift,
		referenceColorsKotlin
	} = parsed.data;

	const results = [];
	const conventions = detectConventions(
		referencePrimitivesScss,
		referenceColorsScss,
		referencePrimitivesTs,
		referenceColorsTs
	);

	if (platforms.includes('web')) {
		results.push(
			...transformToSCSS(lightColors as FigmaColorExport, darkColors as FigmaColorExport)
		);
		results.push(
			...transformToTS(lightColors as FigmaColorExport, darkColors as FigmaColorExport, conventions)
		);
		results.push(...transformToSpacing(values, conventions));
		results.push(
			...transformToCSS(
				lightColors as FigmaColorExport,
				darkColors as FigmaColorExport,
				conventions,
				values
			)
		);
	}

	if (platforms.includes('ios')) {
		results.push(
			transformToSwift(
				lightColors as FigmaColorExport,
				darkColors as FigmaColorExport,
				referenceColorsSwift
			)
		);
	}

	if (platforms.includes('android')) {
		results.push(
			transformToKotlin(
				lightColors as FigmaColorExport,
				darkColors as FigmaColorExport,
				referenceColorsKotlin
			)
		);
	}

	if (typography) {
		results.push(...transformToTypography(typography, platforms));
	}

	// Shadow, border, opacity transformers (auto-detect from values export)
	results.push(...transformToShadows(values, platforms));
	results.push(...transformToBorders(values, platforms));
	results.push(...transformToOpacity(values, platforms));

	const referenceMap: Record<string, string> = {};
	if (referencePrimitivesScss) referenceMap['Primitives.scss'] = referencePrimitivesScss;
	if (referenceColorsScss) referenceMap['Colors.scss'] = referenceColorsScss;
	if (referencePrimitivesTs) referenceMap['Primitives.ts'] = referencePrimitivesTs;
	if (referenceColorsTs) referenceMap['Colors.ts'] = referenceColorsTs;
	if (referenceColorsSwift) referenceMap['Colors.swift'] = referenceColorsSwift;
	if (referenceColorsKotlin) referenceMap['Colors.kt'] = referenceColorsKotlin;

	// ── Cycle Detection ────────────────────────────────────────────────────────
	const warnings: GenerateWarning[] = [];
	const graph = buildTokenGraph(
		lightColors as Record<string, unknown>,
		darkColors as Record<string, unknown>
	);
	const cycleResult = detectCycles(graph);
	if (cycleResult.hasCycles) {
		for (const cw of formatCycleWarnings(cycleResult)) {
			warnings.push({ type: 'cycle', message: cw.message, details: cw.chain });
		}
	}

	// ── Stats ──────────────────────────────────────────────────────────────────
	const primitiveColors = countColorTokens(lightColors as Record<string, unknown>, true);
	const semanticColors =
		countColorTokens(lightColors as Record<string, unknown>, false) - primitiveColors;
	const spacingSteps = countSpacingTokens(values);
	const typographyStyles = typography ? countTypographyStyles(typography) : 0;
	const shadowTokens = countShadowTokens(values);
	const borderTokens = countBorderTokens(values);
	const opacityTokens = countOpacityTokens(values);

	return json({
		success: true,
		platforms,
		stats: {
			primitiveColors,
			semanticColors,
			spacingSteps,
			typographyStyles,
			shadowTokens,
			borderTokens,
			opacityTokens
		},
		files: results.map(({ filename, content, format, platform }) => ({
			filename,
			content,
			format,
			platform,
			referenceContent: referenceMap[filename]
		})),
		...(warnings.length > 0 ? { warnings } : {})
	});
};
