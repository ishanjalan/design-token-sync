import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { transformToSCSS } from '$lib/transformers/scss.js';
import { transformToTS } from '$lib/transformers/ts-web.js';
import { transformToCSS } from '$lib/transformers/css.js';
import { transformToSpacing } from '$lib/transformers/spacing.js';
import { transformToSwift } from '$lib/transformers/swift.js';
import { transformToKotlin, detectKotlinConventions, detectKotlinCategoryGaps, type KotlinOutputScope } from '$lib/transformers/kotlin.js';
import { transformToTypography, countTypographyStyles, detectTypographyConventions, type KotlinTypographyScope, type TransformToTypographyResult } from '$lib/transformers/typography.js';
import { transformToShadows, countShadowTokens } from '$lib/transformers/shadow.js';
import { transformToBorders, countBorderTokens } from '$lib/transformers/border.js';
import { transformToOpacity, countOpacityTokens } from '$lib/transformers/opacity.js';
import { transformToGradients, countGradientTokens } from '$lib/transformers/gradient.js';
import { transformToRadius, countRadiusTokens } from '$lib/transformers/radius.js';
import { transformToMotion, countMotionTokens } from '$lib/transformers/motion.js';
import { detectConventions } from '$lib/transformers/naming.js';
import { buildTokenGraph, detectCycles, formatCycleWarnings, walkAllTokens, collectUnknownTokenTypes } from '$lib/resolve-tokens.js';
import { normalizeTokens, detectTokenFormat } from '$lib/token-adapters.js';
import { detectRenamesInReference, createNewDetector, extractKotlinColorClassInfo } from '$lib/transformers/shared.js';
import { appendRemovedTokenComments } from '$lib/diff-utils.js';
import type { RequestHandler } from './$types';
import type { FigmaColorExport, Platform, GenerateWarning, GenerationMode, TransformResult } from '$lib/types.js';

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
	classificationWarning?: string;
} {
	if (!entries?.length) return { hasPrimitives: false, hasSemantics: false, semanticCategories: [] };
	let hasPrimitives = false,
		hasSemantics = false;
	const categories: string[] = [];
	// Accumulate all content to run extractKotlinColorClassInfo across the full reference set
	const allContent = entries.map((e) => e.content).join('\n');
	for (const { content } of entries) {
		if (
			/\bobject\s+\w+Palette\b/.test(content) ||
			/^val\s+\w+\s*=\s*Color\(/m.test(content) ||
			/\bobject\s+(?:Primitives|.*Primitives)\s*\{/.test(content)
		)
			hasPrimitives = true;
		if (/\bobject\s+(?:Light|Dark)ColorTokens\b/.test(content)) hasSemantics = true;
	}
	// Use dynamic prefix detection to handle R*, App*, Theme*, etc.
	const { prefix, categories: detectedCats } = extractKotlinColorClassInfo(allContent);
	if (detectedCats.length > 0) {
		hasSemantics = true;
		categories.push(...detectedCats);
	}

	// If the uploaded files look like Kotlin color files but no color classes were detected,
	// warn the user about the expected naming pattern.
	const hasKotlinColorContent = /\bColor\s*\(/.test(allContent);
	const classificationWarning =
		hasKotlinColorContent && !hasSemantics && !hasPrimitives
			? `Kotlin reference files were uploaded but no color class pattern was detected. ` +
			  `Expected a naming convention like \`class ${prefix}FillColors\`, \`class ${prefix}TextColors\`, etc. ` +
			  `Check that your reference file uses a consistent \`class <Prefix><Category>Colors\` naming pattern.`
			: undefined;

	return { hasPrimitives, hasSemantics, semanticCategories: [...new Set(categories)], classificationWarning };
}

function classifyKotlinTypographyRefFiles(entries: RefEntry[] | undefined): {
	hasDefinition: boolean;
	hasAccessor: boolean;
	definitionContent?: string;
	definitionFilename?: string;
	accessorClassName?: string;
	accessorContainerRef?: string;
	accessorFilename?: string;
} {
	if (!entries?.length) return { hasDefinition: false, hasAccessor: false };
	let hasDefinition = false, hasAccessor = false;
	let definitionContent: string | undefined;
	let definitionFilename: string | undefined;
	let accessorClassName: string | undefined;
	let accessorContainerRef: string | undefined;
	let accessorFilename: string | undefined;

	for (const { filename, content } of entries) {
		const isEnumAccessor = /\benum\s+class\s+\w+/.test(content) && /MaterialTheme/.test(content);
		if (isEnumAccessor) {
			hasAccessor = true;
			accessorFilename = filename;
			const enumMatch = content.match(/\benum\s+class\s+(\w+)/);
			if (enumMatch) accessorClassName = enumMatch[1];
			const containerMatch = content.match(/MaterialTheme\.(\w+)\./);
			if (containerMatch) accessorContainerRef = containerMatch[1];
			continue;
		}

		const isDefinition =
			(/\bclass\s+\w+/.test(content) && (/@Immutable\b/.test(content) || /internal\s+constructor/.test(content))) ||
			(/\bobject\s+\w+/.test(content) && /\bTextStyle\s*\(/.test(content));
		if (isDefinition) {
			hasDefinition = true;
			definitionContent = content;
			definitionFilename = filename;
		}
	}

	return { hasDefinition, hasAccessor, definitionContent, definitionFilename, accessorClassName, accessorContainerRef, accessorFilename };
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
	key: string,
	warnings: GenerateWarning[]
): Promise<Record<string, unknown> | undefined> {
	const text = await optionalFileText(formData, key);
	if (!text) return undefined;
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch (e) {
		const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON';
		warnings.push({ type: 'lint', message: `Could not parse optional file "${key}": ${msg}. It will be ignored.` });
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
	const warnings: GenerateWarning[] = [];
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
			typography: await optionalFileJson(formData, 'typography', warnings),
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

	const results: TransformResult[] = [];

	function tagMode(items: TransformResult[], mode: GenerationMode): TransformResult[] {
		for (const item of items) item.mode = mode;
		return items;
	}

	// ── Match-existing pass (or sole best-practices pass when no refs) ──────
	const matchedMode: GenerationMode = bestPractices ? 'best-practices' : 'matched';

	const conventions = detectConventions(
		webColors.primitivesScss,
		webColors.colorsScss,
		webColors.primitivesTs,
		webColors.colorsTs,
		bestPractices
	);

	if (!bestPractices && conventions.confidence !== undefined && conventions.confidence < 0.7) {
		warnings.push({
			type: 'lint',
			message: `Convention detection confidence is ${Math.round(conventions.confidence * 100)}% — your reference file may have mixed conventions. Check naming case, separator style, and hex casing for consistency.`
		});
	}

	if (wantColors && platforms.includes('web')) {
		const webRefContent = [webColors.primitivesScss, webColors.colorsScss, webColors.primitivesTs, webColors.colorsTs]
			.filter(Boolean).join('\n');
		const webRenames = bestPractices ? new Map<string, string>() : detectRenamesInReference(webRefContent || undefined);
		const webIsNew = bestPractices ? (() => false) : createNewDetector(webRefContent || undefined);

		if (wantScss) {
			results.push(
				...tagMode(transformToSCSS(
					lightColors as FigmaColorExport,
					darkColors as FigmaColorExport,
					conventions,
					undefined,
					webRenames,
					webIsNew,
					bestPractices
				), matchedMode)
			);
		}
		if (wantTs) {
			results.push(
				...tagMode(transformToTS(lightColors as FigmaColorExport, darkColors as FigmaColorExport, conventions, undefined, webRenames, webIsNew, bestPractices), matchedMode)
			);
		}
		results.push(...tagMode(transformToSpacing(values, conventions), matchedMode));
		if (wantCss) {
			results.push(
				...tagMode(transformToCSS(
					lightColors as FigmaColorExport,
					darkColors as FigmaColorExport,
					conventions,
					values,
					webRenames,
					webIsNew,
					bestPractices
				), matchedMode)
			);
		}
	}

	if (wantColors && platforms.includes('ios')) {
		const swiftResult = transformToSwift(
			lightColors as FigmaColorExport,
			darkColors as FigmaColorExport,
			referenceColorsSwift,
			bestPractices
		);
		swiftResult.mode = matchedMode;
		results.push(swiftResult);
	}

	if (wantColors && platforms.includes('android')) {
		const kotlinScope = classifyKotlinRefFiles(refColorsKotlinEntries);
		if (kotlinScope.classificationWarning) {
			warnings.push({ type: 'missing-category', message: kotlinScope.classificationWarning });
		}
		const scope: KotlinOutputScope | undefined = bestPractices
			? undefined
			: {
					generatePrimitives: kotlinScope.hasPrimitives || (!kotlinScope.hasPrimitives && !kotlinScope.hasSemantics),
					generateSemantics: kotlinScope.hasSemantics || (!kotlinScope.hasPrimitives && !kotlinScope.hasSemantics),
					semanticCategories: kotlinScope.semanticCategories.length > 0 ? kotlinScope.semanticCategories : undefined
				};
		results.push(
			...tagMode(transformToKotlin(
				lightColors as FigmaColorExport,
				darkColors as FigmaColorExport,
				referenceColorsKotlin,
				bestPractices,
				scope
			), matchedMode)
		);

		// P6: Warn when token data has categories not covered by the uploaded reference files,
		// and fall back to best-practices generation for those gap categories.
		if (!bestPractices && referenceColorsKotlin) {
			const kotlinConventions = detectKotlinConventions(referenceColorsKotlin, false);
			if (kotlinConventions.architecture === 'multi-file' && kotlinConventions.semanticCategories.length > 0) {
				const gaps = detectKotlinCategoryGaps(
					lightColors as FigmaColorExport,
					darkColors as FigmaColorExport,
					kotlinConventions.semanticCategories
				);
				for (const cat of gaps) {
					warnings.push({
						type: 'missing-category',
						message: `Token category "${cat}" has no matching reference file — generating with best-practices conventions. Upload a reference file (e.g., R${cat.charAt(0).toUpperCase() + cat.slice(1)}Colors.kt) to match your existing style.`
					});
				}
				if (gaps.length > 0) {
					// Generate gap categories with best-practices conventions so users get output
					const gapScope = { generatePrimitives: false, generateSemantics: true, semanticCategories: gaps };
					results.push(
						...tagMode(transformToKotlin(
							lightColors as FigmaColorExport,
							darkColors as FigmaColorExport,
							undefined,
							true,
							gapScope
						), 'best-practices')
					);
				}
			}
		}
	}

	// ── Token-type transforms (shadow, border, radius, opacity, gradient, motion) ──
	// Honoring the "what's inputted → should be outputted" principle:
	// In match-existing mode, only generate a token type if the uploaded reference
	// files already contain definitions of that type. In best-practices mode (no refs),
	// generate all token types that have data in the token export.
	if (wantColors) {
		const allRefContent = [
			webColors.primitivesScss, webColors.colorsScss,
			webColors.primitivesTs, webColors.colorsTs,
			webTypo.typoScss, webTypo.typoTs,
			referenceColorsSwift, referenceTypographySwift,
			referenceColorsKotlin, referenceTypographyKotlin
		].filter(Boolean).join('\n');

		const refHas = (pattern: RegExp): boolean => bestPractices || pattern.test(allRefContent);

		if (refHas(/\$shadow-|--shadow-|\bShadowToken\b|\bShadowSpec\b/))
			results.push(...tagMode(transformToShadows(values, platforms), matchedMode));
		if (refHas(/\$border-|--border-|\bBorderToken\b|\bobject\s+Borders\b/))
			results.push(...tagMode(transformToBorders(values, platforms), matchedMode));
		if (refHas(/\$radius-|--radius-|\bCornerRadius\b/))
			results.push(...tagMode(transformToRadius(values, platforms), matchedMode));
		if (refHas(/\$opacity-|--opacity-|\benum\s+Opacity\b|\bobject\s+Opacity\b/))
			results.push(...tagMode(transformToOpacity(values, platforms), matchedMode));
		if (refHas(/\$gradient-|\bGradientTokens\b/))
			results.push(...tagMode(transformToGradients(values, platforms), matchedMode));
		if (refHas(/\$duration-|\$easing-|\bMotionTokens\b/))
			results.push(...tagMode(transformToMotion(values, platforms), matchedMode));
	}

	if (wantTypography && typography) {
		const kotlinTypoClassification = classifyKotlinTypographyRefFiles(refTypoKotlinEntries);
		const kotlinTypoRefContent = kotlinTypoClassification.definitionContent ?? referenceTypographyKotlin;

		const typoConventions = detectTypographyConventions(
			webTypo.typoScss,
			webTypo.typoTs,
			bestPractices,
			referenceTypographySwift,
			kotlinTypoRefContent
		);

		const kotlinTypoScope: KotlinTypographyScope | undefined = bestPractices
			? undefined
			: kotlinTypoClassification.hasDefinition || kotlinTypoClassification.hasAccessor
				? {
					generateDefinition: kotlinTypoClassification.hasDefinition || (!kotlinTypoClassification.hasDefinition && !kotlinTypoClassification.hasAccessor),
					generateAccessor: kotlinTypoClassification.hasAccessor,
					definitionFilename: kotlinTypoClassification.definitionFilename,
					accessorClassName: kotlinTypoClassification.accessorClassName,
					accessorContainerRef: kotlinTypoClassification.accessorContainerRef,
					accessorFilename: kotlinTypoClassification.accessorFilename
				}
				: undefined;

		const typoResult: TransformToTypographyResult = transformToTypography(typography, platforms, typoConventions, kotlinTypoScope, true);
		results.push(...tagMode(typoResult.files, matchedMode));
		if (typoResult.weightFallbackNames.length > 0) {
			warnings.push({
				type: 'lint',
				message: `${typoResult.weightFallbackNames.length} typography token(s) had string font-weight values (e.g. "Regular") — mapped to numeric. Use numeric weights in your token export for precise results.`,
				details: typoResult.weightFallbackNames
			});
		}
	}

	// ── Additional Theme Generation ──────────────────────────────────────────
	if (wantColors && additionalThemes?.length) {
		for (const theme of additionalThemes) {
			const themeLabel = theme.label.replace(/\s+/g, '-').toLowerCase();
			const themeResults = [
				...(wantScss ? transformToSCSS(theme.tokens as FigmaColorExport, theme.tokens as FigmaColorExport, conventions) : []),
				...(wantTs ? transformToTS(theme.tokens as FigmaColorExport, theme.tokens as FigmaColorExport, conventions) : []),
				...(wantCss ? transformToCSS(theme.tokens as FigmaColorExport, theme.tokens as FigmaColorExport, conventions) : []),
				// Token-type transforms — same gating as main pass, using theme's values (falls back to base values)
				...transformToShadows(values, platforms),
				...transformToBorders(values, platforms),
				...transformToRadius(values, platforms),
				...transformToOpacity(values, platforms),
				...transformToGradients(values, platforms),
				...transformToMotion(values, platforms)
			];
			for (const r of themeResults) {
				const ext = r.filename.split('.').pop() ?? '';
				const base = r.filename.replace(/\.[^.]+$/, '');
				r.filename = `${base}.${themeLabel}.${ext}`;
				r.mode = matchedMode;
				results.push(r);
			}
		}
	}

	// ── Best-practices pass (only when reference files exist) ────────────────
	if (hasAnyRefFile) {
		const bpConventions = detectConventions(undefined, undefined, undefined, undefined, true);

		if (wantColors && platforms.includes('web')) {
			if (wantScss) results.push(...tagMode(transformToSCSS(lightColors as FigmaColorExport, darkColors as FigmaColorExport, bpConventions, undefined, new Map(), () => false, true), 'best-practices'));
			if (wantTs) results.push(...tagMode(transformToTS(lightColors as FigmaColorExport, darkColors as FigmaColorExport, bpConventions, undefined, new Map(), () => false, true), 'best-practices'));
			results.push(...tagMode(transformToSpacing(values, bpConventions), 'best-practices'));
			if (wantCss) results.push(...tagMode(transformToCSS(lightColors as FigmaColorExport, darkColors as FigmaColorExport, bpConventions, values, new Map(), () => false, true), 'best-practices'));
		}

		if (wantColors && platforms.includes('ios')) {
			const bpSwift = transformToSwift(lightColors as FigmaColorExport, darkColors as FigmaColorExport, undefined, true);
			bpSwift.mode = 'best-practices';
			results.push(bpSwift);
		}

		if (wantColors && platforms.includes('android')) {
			results.push(...tagMode(transformToKotlin(lightColors as FigmaColorExport, darkColors as FigmaColorExport, undefined, true, undefined), 'best-practices'));
		}

		if (wantTypography && typography) {
			const bpTypoConventions = detectTypographyConventions(undefined, undefined, true, undefined, undefined);
			const bpTypoResult: TransformToTypographyResult = transformToTypography(typography, platforms, bpTypoConventions, undefined, true);
			results.push(...tagMode(bpTypoResult.files, 'best-practices'));
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
	if (refTypoKotlinEntries?.length) {
		if (refTypoKotlinEntries.length === 1) {
			referenceMap[refTypoKotlinEntries[0].filename] = refTypoKotlinEntries[0].content;
		} else {
			for (const entry of refTypoKotlinEntries) {
				referenceMap[entry.filename] = entry.content;
			}
		}
	}

	// ── Removed Token Comments (matched files only) ────────────────────────────
	for (const result of results) {
		if (result.mode === 'best-practices') continue;
		const ref = referenceMap[result.filename];
		if (ref) {
			result.content = appendRemovedTokenComments(result.content, ref, result.format);
		}
	}

	// ── Cross-reference: use matched output as referenceContent for BP files ─
	const matchedContentMap: Record<string, string> = {};
	for (const result of results) {
		if (result.mode === 'matched') {
			matchedContentMap[result.filename] = result.content;
		}
	}

	// ── Unknown Token Types ───────────────────────────────────────────────────
	const unknownTypes = collectUnknownTokenTypes(values);
	for (const [type, count] of unknownTypes) {
		warnings.push({
			type: 'lint',
			message: `${count} token${count === 1 ? '' : 's'} with unknown type "${type}" ${count === 1 ? 'was' : 'were'} skipped.`
		});
	}

	// ── Cycle Detection ────────────────────────────────────────────────────────
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
		files: results.map(({ filename, content, format, platform, mode }) => ({
			filename,
			content,
			format,
			platform,
			mode,
			referenceContent: mode === 'best-practices'
				? matchedContentMap[filename]
				: referenceMap[filename]
		})),
		...(warnings.length > 0 ? { warnings } : {})
	});
};
