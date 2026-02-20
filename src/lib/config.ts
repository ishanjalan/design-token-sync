/**
 * Style Dictionary-compatible configuration loader.
 *
 * Supports SD v5's config shape plus Tokensmith extensions for Figma API
 * integration, linting rules, and documentation generation.
 *
 * Config files: tokensmith.config.json, .js, .mjs, .ts
 */

import { z } from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

const TokenFilterSchema = z.object({
	type: z.string().optional(),
	name: z.string().optional()
});

const PlatformFileSchema = z.object({
	destination: z.string(),
	format: z.string(),
	filter: TokenFilterSchema.optional()
});

const PlatformConfigSchema = z.object({
	transformGroup: z
		.enum(['css', 'scss', 'ts', 'swift', 'kotlin'])
		.optional(),
	buildPath: z.string().optional(),
	files: z.array(PlatformFileSchema).optional(),
	transforms: z.array(z.string()).optional(),
	conventions: z.record(z.string(), z.unknown()).optional()
});

const NamingLintConfigSchema = z.object({
	case: z.enum(['kebab', 'camel', 'snake', 'screaming', 'pascal']).optional(),
	pattern: z.string().optional(),
	prefix: z.string().optional(),
	maxDepth: z.number().optional()
});

const ContrastLintConfigSchema = z.object({
	algorithm: z.literal('apca'),
	minLc: z.number().optional(),
	pairings: z.record(z.string(), z.string()).optional()
});

const LintConfigSchema = z.object({
	naming: NamingLintConfigSchema.optional(),
	contrast: ContrastLintConfigSchema.optional()
});

const DocsConfigSchema = z.object({
	outputPath: z.string(),
	format: z.enum(['html', 'json']).default('json')
});

const FigmaConfigSchema = z.object({
	fileKey: z.string(),
	pat: z.string().optional()
});

export const TokensmithConfigSchema = z.object({
	source: z.array(z.string()).optional(),
	platforms: z.record(z.string(), PlatformConfigSchema),
	figma: FigmaConfigSchema.optional(),
	lint: LintConfigSchema.optional(),
	docs: DocsConfigSchema.optional()
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type TokensmithConfig = z.infer<typeof TokensmithConfigSchema>;
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
export type LintConfig = z.infer<typeof LintConfigSchema>;
export type DocsConfig = z.infer<typeof DocsConfigSchema>;
export type FigmaConfig = z.infer<typeof FigmaConfigSchema>;

// ─── Transform Registry ──────────────────────────────────────────────────────

export interface CustomTransform {
	name: string;
	type: 'name' | 'value' | 'attribute';
	filter?: (token: { name: string; type: string }) => boolean;
	transform: (token: { name: string; value: unknown; type: string }) => unknown;
}

const customTransforms = new Map<string, CustomTransform>();

export function registerTransform(transform: CustomTransform): void {
	customTransforms.set(transform.name, transform);
}

export function getTransform(name: string): CustomTransform | undefined {
	return customTransforms.get(name);
}

export function clearTransforms(): void {
	customTransforms.clear();
}

// ─── Transform Groups ─────────────────────────────────────────────────────────

const BUILT_IN_GROUPS: Record<string, string[]> = {
	css: ['name/kebab', 'value/css'],
	scss: ['name/kebab', 'value/scss'],
	ts: ['name/screaming-snake', 'value/ts'],
	swift: ['name/camel', 'value/swift'],
	kotlin: ['name/camel', 'value/kotlin']
};

export function getTransformGroup(name: string): string[] {
	return BUILT_IN_GROUPS[name] ?? [];
}

// ─── Config Loader ────────────────────────────────────────────────────────────

export async function loadConfig(
	configPath?: string
): Promise<TokensmithConfig> {
	const fs = await import('node:fs');
	const path = await import('node:path');

	const candidates = configPath
		? [configPath]
		: [
				'tokensmith.config.json',
				'tokensmith.config.js',
				'tokensmith.config.mjs',
				'tokensmith.config.ts'
			];

	for (const candidate of candidates) {
		const resolved = path.resolve(candidate);
		if (!fs.existsSync(resolved)) continue;

		let raw: unknown;
		if (candidate.endsWith('.json')) {
			const text = fs.readFileSync(resolved, 'utf-8');
			raw = JSON.parse(text);
		} else {
			const mod = await import(resolved);
			raw = mod.default ?? mod;
		}

		return resolveConfig(raw);
	}

	throw new Error(
		`No config file found. Searched: ${candidates.join(', ')}`
	);
}

export function resolveConfig(raw: unknown): TokensmithConfig {
	const parsed = TokensmithConfigSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error(`Invalid config: ${parsed.error.message}`);
	}
	return parsed.data;
}

// ─── Source Resolution ────────────────────────────────────────────────────────

export async function resolveSourceFiles(
	patterns: string[]
): Promise<string[]> {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const glob = await import('node:fs/promises');

	const files: string[] = [];
	for (const pattern of patterns) {
		if (pattern.includes('*')) {
			const dir = path.dirname(pattern);
			const base = path.basename(pattern).replace('*', '');
			try {
				const entries = await glob.readdir(dir);
				for (const entry of entries) {
					if (entry.endsWith(base) || base === '') {
						files.push(path.join(dir, entry));
					}
				}
			} catch {
				// directory doesn't exist
			}
		} else if (fs.existsSync(pattern)) {
			files.push(pattern);
		}
	}
	return files;
}

/**
 * Scaffold a starter config for `tokensmith init`.
 */
export function scaffoldConfig(): string {
	return JSON.stringify(
		{
			source: ['tokens/**/*.json'],
			platforms: {
				css: {
					transformGroup: 'css',
					buildPath: 'build/css/',
					files: [{ destination: 'tokens.css', format: 'css/variables' }]
				},
				scss: {
					transformGroup: 'scss',
					buildPath: 'build/scss/',
					files: [{ destination: 'tokens.scss', format: 'scss/variables' }]
				}
			},
			lint: {
				naming: { case: 'kebab' }
			}
		},
		null,
		2
	);
}
