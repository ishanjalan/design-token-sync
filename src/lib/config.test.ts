import { describe, it, expect } from 'vitest';
import {
	resolveConfig,
	scaffoldConfig,
	registerTransform,
	getTransform,
	getTransformGroup,
	clearTransforms,
	TokensmithConfigSchema
} from './config.js';

describe('resolveConfig', () => {
	it('parses a minimal valid config', () => {
		const config = resolveConfig({
			platforms: {
				css: { transformGroup: 'css', buildPath: 'build/' }
			}
		});
		expect(config.platforms.css.transformGroup).toBe('css');
	});

	it('parses a full config with all extensions', () => {
		const config = resolveConfig({
			source: ['tokens/**/*.json'],
			platforms: {
				scss: { transformGroup: 'scss', buildPath: 'build/scss/' },
				swift: { transformGroup: 'swift' }
			},
			figma: { fileKey: 'abc123' },
			lint: {
				naming: { case: 'kebab', maxDepth: 5 },
				contrast: { algorithm: 'apca', minLc: 60 }
			},
			docs: { outputPath: 'docs/', format: 'html' }
		});
		expect(config.source).toEqual(['tokens/**/*.json']);
		expect(config.figma?.fileKey).toBe('abc123');
		expect(config.lint?.naming?.case).toBe('kebab');
		expect(config.lint?.contrast?.algorithm).toBe('apca');
		expect(config.docs?.format).toBe('html');
	});

	it('throws on invalid config', () => {
		expect(() => resolveConfig({ platforms: 'invalid' })).toThrow('Invalid config');
	});

	it('throws on missing platforms', () => {
		expect(() => resolveConfig({})).toThrow('Invalid config');
	});
});

describe('TokensmithConfigSchema', () => {
	it('accepts config with files array', () => {
		const result = TokensmithConfigSchema.safeParse({
			platforms: {
				css: {
					transformGroup: 'css',
					files: [
						{ destination: 'tokens.css', format: 'css/variables' },
						{ destination: 'colors.css', format: 'css/variables', filter: { type: 'color' } }
					]
				}
			}
		});
		expect(result.success).toBe(true);
	});
});

describe('scaffoldConfig', () => {
	it('produces valid JSON', () => {
		const json = scaffoldConfig();
		const parsed = JSON.parse(json);
		expect(parsed.source).toBeDefined();
		expect(parsed.platforms).toBeDefined();
	});

	it('scaffold is valid per schema', () => {
		const json = scaffoldConfig();
		const parsed = JSON.parse(json);
		const result = TokensmithConfigSchema.safeParse(parsed);
		expect(result.success).toBe(true);
	});
});

describe('custom transforms', () => {
	it('registers and retrieves a transform', () => {
		clearTransforms();
		registerTransform({
			name: 'test/upper',
			type: 'value',
			transform: (t) => String(t.value).toUpperCase()
		});
		const t = getTransform('test/upper');
		expect(t).toBeDefined();
		expect(t!.transform({ name: 'a', value: 'hello', type: 'string' })).toBe('HELLO');
		clearTransforms();
	});
});

describe('getTransformGroup', () => {
	it('returns built-in group transforms', () => {
		expect(getTransformGroup('css')).toEqual(['name/kebab', 'value/css']);
		expect(getTransformGroup('swift')).toEqual(['name/camel', 'value/swift']);
	});

	it('returns empty for unknown group', () => {
		expect(getTransformGroup('nonexistent')).toEqual([]);
	});
});
