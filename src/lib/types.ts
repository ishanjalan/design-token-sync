import { z } from 'zod';

// ─── Figma DTCG Shapes ────────────────────────────────────────────────────────

export const FigmaColorValueSchema = z.object({
	colorSpace: z.literal('srgb'),
	components: z.tuple([z.number(), z.number(), z.number()]),
	alpha: z.number(),
	hex: z.string()
});

export const FigmaColorTokenSchema = z.object({
	$type: z.literal('color'),
	$value: FigmaColorValueSchema,
	$extensions: z
		.object({
			'com.figma.variableId': z.string().optional(),
			'com.figma.scopes': z.array(z.string()).optional(),
			'com.figma.aliasData': z
				.object({
					targetVariableId: z.string(),
					targetVariableName: z.string(),
					targetVariableSetId: z.string(),
					targetVariableSetName: z.string()
				})
				.optional(),
			'com.figma.isOverride': z.boolean().optional()
		})
		.optional()
});

export const FigmaNumberTokenSchema = z.object({
	$type: z.literal('number'),
	$value: z.number(),
	$extensions: z.record(z.string(), z.unknown()).optional()
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type FigmaColorValue = z.infer<typeof FigmaColorValueSchema>;
export type FigmaColorToken = z.infer<typeof FigmaColorTokenSchema>;
export type FigmaNumberToken = z.infer<typeof FigmaNumberTokenSchema>;

export type FigmaColorExport = Record<string, unknown>;

// ─── Composite DTCG Types ─────────────────────────────────────────────────────

export const FigmaShadowValueSchema = z.object({
	color: z.object({
		colorSpace: z.literal('srgb'),
		components: z.tuple([z.number(), z.number(), z.number()]),
		alpha: z.number(),
		hex: z.string()
	}),
	offsetX: z.number(),
	offsetY: z.number(),
	blur: z.number(),
	spread: z.number()
});

export const FigmaShadowTokenSchema = z.object({
	$type: z.literal('shadow'),
	$value: FigmaShadowValueSchema,
	$extensions: z.record(z.string(), z.unknown()).optional()
});

export const FigmaBorderValueSchema = z.object({
	color: z.object({
		colorSpace: z.literal('srgb'),
		components: z.tuple([z.number(), z.number(), z.number()]),
		alpha: z.number(),
		hex: z.string()
	}),
	width: z.number(),
	style: z.enum(['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'])
});

export const FigmaBorderTokenSchema = z.object({
	$type: z.literal('border'),
	$value: FigmaBorderValueSchema,
	$extensions: z.record(z.string(), z.unknown()).optional()
});

export type FigmaShadowValue = z.infer<typeof FigmaShadowValueSchema>;
export type FigmaShadowToken = z.infer<typeof FigmaShadowTokenSchema>;
export type FigmaBorderValue = z.infer<typeof FigmaBorderValueSchema>;
export type FigmaBorderToken = z.infer<typeof FigmaBorderTokenSchema>;

// ─── Platform ─────────────────────────────────────────────────────────────────

export type Platform = 'web' | 'android' | 'ios';

// ─── Transform Result ─────────────────────────────────────────────────────────

export type OutputFormat = 'scss' | 'typescript' | 'swift' | 'kotlin' | 'css';

export interface TransformResult {
	filename: string;
	content: string;
	format: OutputFormat;
	platform: Platform;
}

// ─── Convention Detection ─────────────────────────────────────────────────────

export type NamingCase = 'kebab' | 'snake' | 'screaming_snake' | 'camel' | 'pascal';
export type SeparatorStyle = 'hyphen' | 'underscore' | 'none';

export interface DetectedConventions {
	scssPrefix: string; // e.g. "$"
	scssSeparator: SeparatorStyle;
	tsPrefix: string; // e.g. "export const "
	tsNamingCase: NamingCase;
	importStyle: 'use' | 'import'; // @use vs @import
	hasTypeAnnotations: boolean;
}

export const BEST_PRACTICE_WEB_CONVENTIONS: DetectedConventions = {
	scssPrefix: '$',
	scssSeparator: 'hyphen',
	tsPrefix: 'export const ',
	tsNamingCase: 'screaming_snake',
	importStyle: 'use',
	hasTypeAnnotations: true
};

export interface DetectedSwiftConventions {
	namingCase: 'camel' | 'snake'; // camelCase (default) or snake_case
	useComputedVar: boolean; // computed var (true) vs static let (false)
}

export const BEST_PRACTICE_SWIFT_CONVENTIONS: DetectedSwiftConventions = {
	namingCase: 'camel',
	useComputedVar: false
};

export interface DetectedKotlinConventions {
	namingCase: 'camel' | 'pascal'; // camelCase vs PascalCase for property names
	objectName: string; // e.g. "AppColors", "Colors" — detected from reference
}

export const BEST_PRACTICE_KOTLIN_CONVENTIONS: DetectedKotlinConventions = {
	namingCase: 'camel',
	objectName: 'AppColors'
};

// ─── Generation Stats ─────────────────────────────────────────────────────────

export interface GenerationStats {
	primitiveColors: number;
	semanticColors: number;
	spacingSteps: number;
	typographyStyles: number;
	shadowTokens: number;
	borderTokens: number;
	opacityTokens: number;
}

// ─── Generated File ───────────────────────────────────────────────────────────

export interface GeneratedFile {
	filename: string;
	content: string;
	format: OutputFormat;
	platform: Platform;
	referenceContent?: string;
}

// ─── Generate Response ────────────────────────────────────────────────────────

export interface GenerateWarning {
	type: 'cycle' | 'lint' | 'unused';
	message: string;
	details?: unknown;
}

export interface GenerateResponse {
	success: boolean;
	platforms: Platform[];
	stats: GenerationStats;
	files: GeneratedFile[];
	warnings?: GenerateWarning[];
}

// ─── History Entry ────────────────────────────────────────────────────────────

export interface HistoryEntry {
	id: string;
	generatedAt: string;
	platforms: Platform[];
	stats: GenerationStats;
	files: GeneratedFile[];
}

// ─── GitHub Config ────────────────────────────────────────────────────────────

export interface GithubRepoConfig {
	owner: string;
	repo: string;
	branch: string;
	dir: string;
}

export type GithubConfigs = Partial<Record<Platform, GithubRepoConfig>>;

// ─── Drop Zone / File Slot ────────────────────────────────────────────────────

export type DropZoneKey =
	| 'lightColors'
	| 'darkColors'
	| 'values'
	| 'typography'
	| 'referencePrimitivesScss'
	| 'referenceColorsScss'
	| 'referencePrimitivesTs'
	| 'referenceColorsTs'
	| 'referenceColorsSwift'
	| 'referenceColorsKotlin';

export interface FileSlot {
	label: string;
	accept: string;
	hint: string;
	ext: string;
	platforms: Platform[];
	required: boolean;
	file: File | null;
	dragging: boolean;
	restored: boolean;
	warning: string | null;
}

// ─── PR Result ────────────────────────────────────────────────────────────────

export interface PrResult {
	platform: string;
	url: string;
	status: 'success' | 'failed';
	error?: string;
}

// ─── Generate Request ─────────────────────────────────────────────────────────

export const GenerateRequestSchema = z.object({
	lightColors: z.record(z.string(), z.unknown()),
	darkColors: z.record(z.string(), z.unknown()),
	values: z.record(z.string(), z.unknown()),
	platforms: z.array(z.enum(['web', 'android', 'ios'])),
	typography: z.record(z.string(), z.unknown()).optional(),
	bestPractices: z.boolean().optional().default(true),
	// Web reference files (optional — used for convention detection)
	referencePrimitivesScss: z.string().optional(),
	referenceColorsScss: z.string().optional(),
	referencePrimitivesTs: z.string().optional(),
	referenceColorsTs: z.string().optional(),
	// iOS reference file (optional)
	referenceColorsSwift: z.string().optional(),
	// Android reference file (optional)
	referenceColorsKotlin: z.string().optional()
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
