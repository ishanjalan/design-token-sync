#!/usr/bin/env node
/**
 * Tokensmith CLI
 *
 * Commands:
 *   build [--platform <name>]  Build all platforms (or one) from config
 *   lint                       Run naming + contrast validation
 *   docs                       Generate token documentation
 *   init                       Scaffold a tokensmith.config.json
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, scaffoldConfig } from './lib/config.js';
import { lintTokenNames, getRuleSet, lintSummary } from './lib/naming-lint.js';
import { extractSemanticColors, detectPairings, validatePalette } from './lib/contrast.js';
import { generateTokenDocs } from './lib/docs-generator.js';
import { transformToSCSS } from './lib/transformers/scss.js';
import { transformToTS } from './lib/transformers/ts-web.js';
import { transformToCSS } from './lib/transformers/css.js';
import { transformToSpacing } from './lib/transformers/spacing.js';
import { transformToSwift } from './lib/transformers/swift.js';
import { transformToKotlin } from './lib/transformers/kotlin.js';
import { transformToTypography } from './lib/transformers/typography.js';
import { transformToShadows } from './lib/transformers/shadow.js';
import { transformToBorders } from './lib/transformers/border.js';
import { transformToOpacity } from './lib/transformers/opacity.js';
import { detectConventions } from './lib/transformers/naming.js';
import { buildTokenGraph, detectCycles, formatCycleWarnings } from './lib/resolve-tokens.js';
import { fetchVariables, transformFigmaResponse } from './lib/figma-api.js';
import type { FigmaColorExport, Platform, TransformResult } from './lib/types.js';

// ─── Arg Parsing ──────────────────────────────────────────────────────────────

const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	options: {
		platform: { type: 'string', short: 'p' },
		config: { type: 'string', short: 'c' },
		help: { type: 'boolean', short: 'h' }
	},
	allowPositionals: true,
	strict: false
});

const command = positionals[0] ?? 'help';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
	process.stdout.write(msg + '\n');
}

function logError(msg: string): void {
	process.stderr.write(`Error: ${msg}\n`);
}

function writeOutput(filePath: string, content: string): void {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(filePath, content, 'utf-8');
}

function loadJsonFile(filePath: string): Record<string, unknown> {
	const resolved = path.resolve(filePath);
	const text = fs.readFileSync(resolved, 'utf-8');
	return JSON.parse(text) as Record<string, unknown>;
}

function resolveSourceTokens(patterns: string[]): Record<string, unknown>[] {
	const results: Record<string, unknown>[] = [];
	for (const pattern of patterns) {
		const dir = path.dirname(pattern);
		const ext = path.extname(pattern);
		if (!fs.existsSync(dir)) continue;
		const entries = fs.readdirSync(dir);
		for (const entry of entries) {
			if (entry.endsWith(ext) || pattern === entry) {
				try {
					results.push(loadJsonFile(path.join(dir, entry)));
				} catch {
					// skip unparseable files
				}
			}
		}
	}
	return results;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function loadTokenSources(config: Awaited<ReturnType<typeof loadConfig>>): Promise<{
	lightColors: FigmaColorExport;
	darkColors: FigmaColorExport;
	valuesExport: Record<string, unknown>;
	typographyExport: Record<string, unknown> | undefined;
}> {
	// If Figma API config is present, fetch from API
	if (config.figma?.fileKey) {
		const pat = config.figma.pat ?? process.env.FIGMA_PAT;
		if (!pat) {
			logError('Figma PAT required. Set figma.pat in config or FIGMA_PAT env variable.');
			process.exit(1);
		}
		log('Fetching tokens from Figma API...');
		const response = await fetchVariables(config.figma.fileKey, pat);
		const normalized = transformFigmaResponse(response);
		log(`  ✓ Fetched from Figma file ${config.figma.fileKey}`);
		return {
			lightColors: normalized.lightColors as FigmaColorExport,
			darkColors: normalized.darkColors as FigmaColorExport,
			valuesExport: normalized.values,
			typographyExport: Object.keys(normalized.typography).length > 0 ? normalized.typography : undefined
		};
	}

	// Fall back to source file globs
	const sources = config.source ? resolveSourceTokens(config.source) : [];
	if (sources.length === 0) {
		logError('No token source files found. Check "source" patterns or add figma.fileKey.');
		process.exit(1);
	}

	let lightColors: FigmaColorExport = {};
	let darkColors: FigmaColorExport = {};
	let valuesExport: Record<string, unknown> = {};
	let typographyExport: Record<string, unknown> | undefined;

	for (const src of sources) {
		const name = Object.keys(src)[0]?.toLowerCase() ?? '';
		if (name.includes('light') || name.includes('color')) {
			lightColors = { ...lightColors, ...src };
		} else if (name.includes('dark')) {
			darkColors = { ...darkColors, ...src };
		} else if (name.includes('typo') || name.includes('font')) {
			typographyExport = { ...(typographyExport ?? {}), ...src };
		} else {
			valuesExport = { ...valuesExport, ...src };
		}
	}

	return { lightColors, darkColors, valuesExport, typographyExport };
}

async function cmdBuild(): Promise<void> {
	const config = await loadConfig(values.config as string | undefined);
	const { lightColors, darkColors, valuesExport, typographyExport } =
		await loadTokenSources(config);

	const platformFilter = values.platform as string | undefined;
	const platformNames = Object.keys(config.platforms);
	const targetPlatforms = platformFilter
		? platformNames.filter((p) => p === platformFilter)
		: platformNames;

	if (targetPlatforms.length === 0) {
		logError(`Platform "${platformFilter}" not found in config.`);
		process.exit(1);
	}

	// Cycle detection
	const graph = buildTokenGraph(
		lightColors as Record<string, unknown>,
		darkColors as Record<string, unknown>
	);
	const cycleResult = detectCycles(graph);
	if (cycleResult.hasCycles) {
		log('⚠ Circular references detected:');
		for (const cw of formatCycleWarnings(cycleResult)) {
			log(`  ${cw.message}`);
		}
	}

	const conventions = detectConventions(undefined, undefined, undefined, undefined);
	const results: TransformResult[] = [];
	const sdPlatforms: Platform[] = [];

	for (const pName of targetPlatforms) {
		const pConfig = config.platforms[pName];
		const group = pConfig.transformGroup ?? pName;

		if (group === 'css') {
			sdPlatforms.push('web');
			results.push(...transformToCSS(lightColors, darkColors, conventions, valuesExport));
		}
		if (group === 'scss') {
			sdPlatforms.push('web');
			results.push(...transformToSCSS(lightColors, darkColors));
			results.push(...transformToSpacing(valuesExport, conventions));
		}
		if (group === 'ts') {
			sdPlatforms.push('web');
			results.push(...transformToTS(lightColors, darkColors, conventions));
		}
		if (group === 'swift') {
			sdPlatforms.push('ios');
			results.push(transformToSwift(lightColors, darkColors));
		}
		if (group === 'kotlin') {
			sdPlatforms.push('android');
			results.push(transformToKotlin(lightColors, darkColors));
		}
	}

	// Composite tokens
	const uniquePlatforms = [...new Set(sdPlatforms)] as Platform[];
	results.push(...transformToShadows(valuesExport, uniquePlatforms));
	results.push(...transformToBorders(valuesExport, uniquePlatforms));
	results.push(...transformToOpacity(valuesExport, uniquePlatforms));

	if (typographyExport) {
		results.push(...transformToTypography(typographyExport, uniquePlatforms));
	}

	// Write files
	let written = 0;
	for (const result of results) {
		const pName = targetPlatforms.find((p) => {
			const group = config.platforms[p].transformGroup ?? p;
			if (group === 'css' || group === 'scss' || group === 'ts') return result.platform === 'web';
			if (group === 'swift') return result.platform === 'ios';
			if (group === 'kotlin') return result.platform === 'android';
			return false;
		});
		const buildPath = pName ? (config.platforms[pName].buildPath ?? 'build/') : 'build/';
		const outPath = path.join(buildPath, result.filename);
		writeOutput(outPath, result.content);
		log(`  ✓ ${outPath}`);
		written++;
	}

	log(`\n${written} file(s) generated.`);
}

async function cmdLint(): Promise<void> {
	const config = await loadConfig(values.config as string | undefined);
	const sources = config.source ? resolveSourceTokens(config.source) : [];
	let hasErrors = false;

	if (sources.length === 0) {
		logError('No token source files found.');
		process.exit(1);
	}

	// Naming lint
	if (config.lint?.naming) {
		log('Naming Convention Lint');
		log('─'.repeat(40));
		for (const src of sources) {
			const caseRule = config.lint.naming.case ?? 'kebab';
			const rules = getRuleSet(caseRule === 'kebab' ? 'web' : 'ios');
			const results = lintTokenNames(src, rules);
			const summary = lintSummary(results);

			if (results.length > 0) {
				for (const r of results) {
					const icon = r.severity === 'error' ? '✗' : '⚠';
					log(`  ${icon} ${r.message}`);
				}
			}

			if (summary.errors > 0) hasErrors = true;
			log(`  ${summary.errors} error(s), ${summary.warnings} warning(s)\n`);
		}
	}

	// Contrast lint
	if (config.lint?.contrast) {
		log('APCA Contrast Validation');
		log('─'.repeat(40));
		for (const src of sources) {
			const colorMap = extractSemanticColors(src);
			const pairs = detectPairings(colorMap, config.lint.contrast.pairings);
			const result = validatePalette(pairs);

			for (const r of result.results) {
				const icon = r.level === 'fail' ? '✗' : r.level === 'pass' ? '✓' : '⚠';
				log(`  ${icon} ${r.fgName} / ${r.bgName}: Lc ${r.absLc} (${r.level})`);
			}
			log(`  ${result.pass} pass, ${result.large} large-only, ${result.fail} fail\n`);

			if (result.fail > 0) hasErrors = true;
		}
	}

	if (hasErrors) {
		log('Lint failed with errors.');
		process.exit(1);
	} else {
		log('All checks passed.');
	}
}

async function cmdDocs(): Promise<void> {
	const config = await loadConfig(values.config as string | undefined);
	const sources = config.source ? resolveSourceTokens(config.source) : [];

	if (sources.length === 0) {
		logError('No token source files found.');
		process.exit(1);
	}

	const format = config.docs?.format ?? 'json';
	const outputPath = config.docs?.outputPath ?? 'docs/';
	const merged: Record<string, unknown> = {};
	for (const src of sources) Object.assign(merged, src);

	const { jsonOutput, htmlOutput } = generateTokenDocs(merged);

	if (format === 'json' || format === 'html') {
		if (jsonOutput) {
			const outFile = path.join(outputPath, 'tokens.json');
			writeOutput(outFile, jsonOutput);
			log(`  ✓ ${outFile}`);
		}
	}
	if (format === 'html') {
		if (htmlOutput) {
			const outFile = path.join(outputPath, 'index.html');
			writeOutput(outFile, htmlOutput);
			log(`  ✓ ${outFile}`);
		}
	}

	log('Documentation generated.');
}

function cmdInit(): void {
	const outFile = 'tokensmith.config.json';
	if (fs.existsSync(outFile)) {
		logError(`${outFile} already exists.`);
		process.exit(1);
	}
	writeOutput(outFile, scaffoldConfig() + '\n');
	log(`Created ${outFile}`);
}

function cmdHelp(): void {
	log(`
Tokensmith CLI — Design token pipeline

Usage:
  tokensmith build [--platform <name>]  Build tokens from config
  tokensmith lint                       Run naming + contrast validation
  tokensmith docs                       Generate token documentation
  tokensmith init                       Scaffold tokensmith.config.json

Options:
  --config, -c <path>   Path to config file
  --platform, -p <name> Build only one platform
  --help, -h            Show this help
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	if (values.help) {
		cmdHelp();
		return;
	}

	switch (command) {
		case 'build':
			await cmdBuild();
			break;
		case 'lint':
			await cmdLint();
			break;
		case 'docs':
			await cmdDocs();
			break;
		case 'init':
			cmdInit();
			break;
		default:
			cmdHelp();
	}
}

main().catch((err: Error) => {
	logError(err.message);
	process.exit(1);
});
