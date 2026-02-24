import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { transformToSCSS } from '$lib/transformers/scss.js';
import { transformToTS } from '$lib/transformers/ts-web.js';
import { transformToCSS } from '$lib/transformers/css.js';
import { transformToSpacing } from '$lib/transformers/spacing.js';
import { transformToSwift } from '$lib/transformers/swift.js';
import { transformToKotlin, type KotlinOutputScope } from '$lib/transformers/kotlin.js';
import { transformToTypography, countTypographyStyles, detectTypographyConventions } from '$lib/transformers/typography.js';
import { transformToShadows, countShadowTokens } from '$lib/transformers/shadow.js';
import { transformToBorders, countBorderTokens } from '$lib/transformers/border.js';
import { transformToOpacity, countOpacityTokens } from '$lib/transformers/opacity.js';
import { transformToGradients, countGradientTokens } from '$lib/transformers/gradient.js';
import { transformToRadius, countRadiusTokens } from '$lib/transformers/radius.js';
import { transformToMotion, countMotionTokens } from '$lib/transformers/motion.js';
import { detectConventions } from '$lib/transformers/naming.js';
import { buildTokenGraph, detectCycles, formatCycleWarnings, walkAllTokens } from '$lib/resolve-tokens.js';
import { normalizeTokens, detectTokenFormat } from '$lib/token-adapters.js';
import { detectRenamesInReference, createNewDetector } from '$lib/transformers/shared.js';
import { appendRemovedTokenComments } from '$lib/diff-utils.js';
import type { RequestHandler } from './$types';
import type { FigmaColorExport, Platform, GenerateWarning } from '$lib/types.js';

const RefFileEntry = z.object({ filename: z.string(), content: z.string() });

const RequestSchema = z.object({
	lightColors: z.record(z.string(), z.unknown()),
	darkColors: z.record(z.string(), z.unknown()),
	values: z.record(z.string(), z.unknown()),
	platforms: z.array(z.enum(['web', 'android', 'ios'])),
	outputs: z.array(z.enum(['colors', 'typography'])).optional().default(['colors', 'typography']),
	typography: z.record(z.string(), z.unknown()).optional(),
	referenceColorsWeb: z.array(RefFileEntry).optional(),
	referenceTypographyWeb: z.array(RefFileEntry).optional(),
	referenceColorsSwift: z.array(RefFileEntry).optional(),
	referenceColorsKotlin: z.array(RefFileEntry).optional(),
	referenceTypographySwift: z.array(RefFileEntry).optional(),
	referenceTypographyKotlin: z.array(RefFileEntry).optional(),
	additionalThemes: z.array(z.object({
		label: z.string(),
		tokens: z.record(z.string(), z.unknown())
	})).optional()
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

async function multiFileEntries(
	formData: FormData,
	key: string
): Promise<{ filename: string; content: string }[] | undefined> {
	const entries = formData.getAll(key);
	const result: { filename: string; content: string }[] = [];
	for (const entry of entries) {
		if (!(entry instanceof File) || entry.size === 0) continue;
		checkFileSize(entry, key);
		result.push({ filename: entry.name, content: await entry.text() });
	}
	return result.length > 0 ? result : undefined;
}

async function parseAdditionalThemes(
	formData: FormData
): Promise<{ label: string; tokens: Record<string, unknown> }[] | undefined> {
	const entries = formData.getAll('additionalThemes');
	const result: { label: string; tokens: Record<string, unknown> }[] = [];
	for (const entry of entries) {
		if (!(entry instanceof File) || entry.size === 0) continue;
		checkFileSize(entry, 'additionalThemes');
		const label = entry.name.replace(/\.json$/i, '').replace(/[._-]?tokens$/i, '');
		const tokens = parseJsonFile(await entry.text(), entry.name);
		result.push({ label, tokens });
	}
	return result.length > 0 ? result : undefined;
}

type RefEntry = { filename: string; content: string };

function classifyWebColorFiles(entries: RefEntry[] | undefined): {
	primitivesScss?: string;
	colorsScss?: string;
	primitivesTs?: string;
	colorsTs?: string;
} {
	if (!entries?.length) return {};
	const result: Record<string, string | undefined> = {};
	for (const { filename, content } of entries) {
		const ext = filename.split('.').pop()?.toLowerCase();
		const isScss = ext === 'scss' || ext === 'css';
		const isTs = ext === 'ts';
		const isPrimitive = /\$[\w-]+-\d+:|--[\w-]+-\d+:|_[A-Z]+_\d+\s*=/.test(content)
			|| /export\s+const\s+[A-Z]+_\d+/.test(content)
			|| filename.toLowerCase().includes('primitive');
		if (isScss) {
			if (isPrimitive) result.primitivesScss = content;
			else result.colorsScss = content;
		} else if (isTs) {
			if (isPrimitive) result.primitivesTs = content;
			else result.colorsTs = content;
		}
	}
	return result;
}

function classifyKotlinRefFiles(entries: RefEntry[] | undefined): {
	hasPrimitives: boolean;
	hasSemantics: boolean;
	semanticCategories: string[];
} {
	if (!entries?.length) return { hasPrimitives: false, hasSemantics: false, semanticCategories: [] };
	let hasPrimitives = false,
		hasSemantics = false;
	const categories: string[] = [];
	for (const { content } of entries) {
		if (
			/\bobject\s+\w+Palette\b/.test(content) ||
			/^val\s+\w+\s*=\s*Color\(/m.test(content) ||
			/\bobject\s+(?:Primitives|.*Primitives)\s*\{/.test(content)
		)
			hasPrimitives = true;
		const catMatches = [...content.matchAll(/\bclass\s+R(\w+)Colors\b/g)];
		if (catMatches.length) {
			hasSemantics = true;
			categories.push(...catMatches.map((m) => m[1].toLowerCase()));
		}
		if (/\bobject\s+(?:Light|Dark)ColorTokens\b/.test(content)) hasSemantics = true;
	}
	return { hasPrimitives, hasSemantics, semanticCategories: [...new Set(categories)] };
}

function classifyWebTypographyFiles(entries: RefEntry[] | undefined): {
	typoScss?: string;
	typoTs?: string;
} {
	if (!entries?.length) return {};
	const result: Record<string, string | undefined> = {};
	for (const { filename, content } of entries) {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (ext === 'scss' || ext === 'css') result.typoScss = content;
		else if (ext === 'ts') result.typoTs = content;
	}
	return result;
}

function parseJsonFile(text: string, label: string): Record<string, unknown> {
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(text) as Record<string, unknown>;
	} catch (e) {
		const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON';
		throw error(400, `Failed to parse ${label}: ${msg}`);
	}
	const format = detectTokenFormat(parsed);
	if (format !== 'figma-dtcg' && format !== 'unknown') {
		return normalizeTokens(parsed);
	}
	return parsed;
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
	walkAllTokens(export_, (_path, token, type) => {
		if (type !== 'color') return;
		if (aliasOnly) {
			const ext = token.$extensions as Record<string, unknown> | undefined;
			if (!ext?.['com.figma.aliasData']) return;
		}
		count++;
	});
	return count;
}

function countSpacingTokens(values: Record<string, unknown>): number {
	let count = 0;
	walkAllTokens(values, (_path, _token, type) => {
		if (type === 'number') count++;
	});
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

		const outputsRaw = formData.get('outputs');
		const outputs: string[] = outputsRaw
			? (JSON.parse(outputsRaw as string) as string[])
			: ['colors', 'typography'];

		const lightColors = parseJsonFile(await lightColorsFile.text(), 'lightColors');
		const darkColors = parseJsonFile(await darkColorsFile.text(), 'darkColors');
		const values = parseJsonFile(await valuesFile.text(), 'values');

		body = {
			lightColors,
			darkColors,
			values,
			platforms,
			outputs,
			typography: await optionalFileJson(formData, 'typography'),
			referenceColorsWeb: await multiFileEntries(formData, 'referenceColorsWeb'),
			referenceTypographyWeb: await multiFileEntries(formData, 'referenceTypographyWeb'),
			referenceColorsSwift: await multiFileEntries(formData, 'referenceColorsSwift'),
			referenceColorsKotlin: await multiFileEntries(formData, 'referenceColorsKotlin'),
			referenceTypographySwift: await multiFileEntries(formData, 'referenceTypographySwift'),
			referenceTypographyKotlin: await multiFileEntries(formData, 'referenceTypographyKotlin'),
			additionalThemes: await parseAdditionalThemes(formData)
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
		outputs,
		typography,
		referenceColorsWeb,
		referenceTypographyWeb,
		referenceColorsSwift: refColorsSwiftEntries,
		referenceColorsKotlin: refColorsKotlinEntries,
		referenceTypographySwift: refTypoSwiftEntries,
		referenceTypographyKotlin: refTypoKotlinEntries,
		additionalThemes
	} = parsed.data;

	// Classify web multi-file references
	const webColors = classifyWebColorFiles(referenceColorsWeb);
	const webTypo = classifyWebTypographyFiles(referenceTypographyWeb);

	// Extract single-content strings for native platforms (concatenate multi-file)
	const referenceColorsSwift = refColorsSwiftEntries?.map((e) => e.content).join('\n');
	const referenceColorsKotlin = refColorsKotlinEntries?.map((e) => e.content).join('\n');
	const referenceTypographySwift = refTypoSwiftEntries?.map((e) => e.content).join('\n');
	const referenceTypographyKotlin = refTypoKotlinEntries?.map((e) => e.content).join('\n');

	const hasAnyRefFile = !!(
		referenceColorsWeb?.length || referenceTypographyWeb?.length ||
		referenceColorsSwift || referenceColorsKotlin ||
		referenceTypographySwift || referenceTypographyKotlin
	);
	const bestPractices = !hasAnyRefFile;

	const hasScssRef = !!(webColors.primitivesScss || webColors.colorsScss || webTypo.typoScss);
	const hasTsRef = !!(webColors.primitivesTs || webColors.colorsTs || webTypo.typoTs);
	const wantScss = bestPractices || hasScssRef;
	const wantTs = bestPractices || hasTsRef;
	const wantCss = bestPractices;

	const wantColors = outputs.includes('colors');
	const wantTypography = outputs.includes('typography');

	const results = [];
	const conventions = detectConventions(
		webColors.primitivesScss,
		webColors.colorsScss,
		webColors.primitivesTs,
		webColors.colorsTs,
		bestPractices
	);

	if (wantColors && platforms.includes('web')) {
		const webRefContent = [webColors.primitivesScss, webColors.colorsScss, webColors.primitivesTs, webColors.colorsTs]
			.filter(Boolean).join('\n');
		const webRenames = bestPractices ? new Map<string, string>() : detectRenamesInReference(webRefContent || undefined);
		const webIsNew = bestPractices ? (() => false) : createNewDetector(webRefContent || undefined);

		if (wantScss) {
			results.push(
				...transformToSCSS(
					lightColors as FigmaColorExport,
					darkColors as FigmaColorExport,
					conventions,
					undefined,
					webRenames,
					webIsNew,
					bestPractices
				)
			);
		}
		if (wantTs) {
			results.push(
				...transformToTS(lightColors as FigmaColorExport, darkColors as FigmaColorExport, conventions, undefined, webRenames, webIsNew, bestPractices)
			);
		}
		results.push(...transformToSpacing(values, conventions));
		if (wantCss) {
			results.push(
				...transformToCSS(
					lightColors as FigmaColorExport,
					darkColors as FigmaColorExport,
					conventions,
					values,
					webRenames,
					webIsNew,
					bestPractices
				)
			);
		}
	}

	if (wantColors && platforms.includes('ios')) {
		results.push(
			transformToSwift(
				lightColors as FigmaColorExport,
				darkColors as FigmaColorExport,
				referenceColorsSwift,
				bestPractices
			)
		);
	}

	if (wantColors && platforms.includes('android')) {
		const kotlinScope = classifyKotlinRefFiles(refColorsKotlinEntries);
		const scope: KotlinOutputScope | undefined = bestPractices
			? undefined
			: {
					generatePrimitives: kotlinScope.hasPrimitives || (!kotlinScope.hasPrimitives && !kotlinScope.hasSemantics),
					generateSemantics: kotlinScope.hasSemantics || (!kotlinScope.hasPrimitives && !kotlinScope.hasSemantics),
					semanticCategories: kotlinScope.semanticCategories.length > 0 ? kotlinScope.semanticCategories : undefined
				};
		results.push(
			...transformToKotlin(
				lightColors as FigmaColorExport,
				darkColors as FigmaColorExport,
				referenceColorsKotlin,
				bestPractices,
				scope
			)
		);
	}

	if (wantTypography && typography) {
		const typoConventions = detectTypographyConventions(
			webTypo.typoScss,
			webTypo.typoTs,
			bestPractices,
			referenceTypographySwift,
			referenceTypographyKotlin
		);
		results.push(...transformToTypography(typography, platforms, typoConventions));
	}

	if (wantColors) {
		results.push(...transformToShadows(values, platforms));
		results.push(...transformToBorders(values, platforms));
		results.push(...transformToOpacity(values, platforms));
		results.push(...transformToGradients(values, platforms));
		results.push(...transformToRadius(values, platforms));
		results.push(...transformToMotion(values, platforms));
	}

	// ── Additional Theme Generation ──────────────────────────────────────────
	if (wantColors && additionalThemes?.length) {
		for (const theme of additionalThemes) {
			const themeLabel = theme.label.replace(/\s+/g, '-').toLowerCase();
			const themeResults = [
				...(wantScss ? transformToSCSS(theme.tokens as FigmaColorExport, theme.tokens as FigmaColorExport, conventions) : []),
				...(wantTs ? transformToTS(theme.tokens as FigmaColorExport, theme.tokens as FigmaColorExport, conventions) : []),
				...(wantCss ? transformToCSS(theme.tokens as FigmaColorExport, theme.tokens as FigmaColorExport, conventions) : [])
			];
			for (const r of themeResults) {
				const ext = r.filename.split('.').pop() ?? '';
				const base = r.filename.replace(/\.[^.]+$/, '');
				r.filename = `${base}.${themeLabel}.${ext}`;
				results.push(r);
			}
		}
	}

	const referenceMap: Record<string, string> = {};
	if (webColors.primitivesScss) referenceMap['Primitives.scss'] = webColors.primitivesScss;
	if (webColors.colorsScss) referenceMap['Colors.scss'] = webColors.colorsScss;
	if (webColors.primitivesTs) referenceMap['Primitives.ts'] = webColors.primitivesTs;
	if (webColors.colorsTs) referenceMap['Colors.ts'] = webColors.colorsTs;
	if (referenceColorsSwift) referenceMap['Colors.swift'] = referenceColorsSwift;
	if (refColorsKotlinEntries?.length) {
		if (refColorsKotlinEntries.length === 1) {
			referenceMap['Colors.kt'] = refColorsKotlinEntries[0].content;
		} else {
			for (const entry of refColorsKotlinEntries) {
				referenceMap[entry.filename] = entry.content;
			}
		}
	}
	if (webTypo.typoScss) referenceMap['Typography.scss'] = webTypo.typoScss;
	if (webTypo.typoTs) referenceMap['Typography.ts'] = webTypo.typoTs;
	if (referenceTypographySwift) referenceMap['Typography.swift'] = referenceTypographySwift;
	if (referenceTypographyKotlin) referenceMap['Typography.kt'] = referenceTypographyKotlin;

	// ── Removed Token Comments ─────────────────────────────────────────────────
	for (const result of results) {
		const ref = referenceMap[result.filename];
		if (ref) {
			result.content = appendRemovedTokenComments(result.content, ref, result.format);
		}
	}

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
	const gradientTokens = countGradientTokens(values);
	const radiusTokens = countRadiusTokens(values);
	const motionTokens = countMotionTokens(values);

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
			opacityTokens,
			gradientTokens,
			radiusTokens,
			motionTokens
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
