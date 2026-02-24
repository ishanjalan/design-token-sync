import { describe, it, expect } from 'vitest';
import {
	detectTypographyConventions,
	transformToTypography
} from './typography.js';

// ─── Reference file fixtures (based on user's web team files) ────────────────

const REF_SCSS = `// Font weights
$font-weight-400: 400;
$font-weight-500: 500;
$font-weight-700: 700;

// Font sizes, line heights, and letter spacings
$font-xxl-size: 2.8125rem;
$font-xxl-height: 3.25rem;
$font-xxl-spacing: -1px;

$font-m1-size: 1rem;
$font-m1-height: 1.5rem;
$font-m1-spacing: -0.18px;

// Typography mixins for easy usage
@mixin font-extra-large-title {
  font-size: $font-xxl-size;
  line-height: $font-xxl-height;
  letter-spacing: $font-xxl-spacing;
}

@mixin font-body {
  font-size: $font-m1-size;
  line-height: $font-m1-height;
  letter-spacing: $font-m1-spacing;
}
`;

const REF_TS = `export const FONT_WEIGHT_400 = 400;
export const FONT_WEIGHT_500 = 500;
export const FONT_WEIGHT_700 = 700;

const FONT_XXL = {
  fontSize: '2.8125rem',
  lineHeight: '3.25rem',
  letterSpacing: '-1px',
};
const FONT_M1 = {
  fontSize: '1rem',
  lineHeight: '1.5rem',
  letterSpacing: '-0.18px',
};

export const FONT_EXTRA_LARGE_TITLE = FONT_XXL;
export const FONT_BODY = FONT_M1;
`;

const SAMPLE_TYPOGRAPHY_JSON = {
	typography: {
		'droid/body/body-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'Inter',
				fontSize: 16,
				fontWeight: 400,
				lineHeight: 24,
				letterSpacing: -0.18
			}
		},
		'droid/xlarge title/xlarge title-R': {
			$type: 'typography',
			$value: {
				fontFamily: 'Inter',
				fontSize: 44,
				fontWeight: 700,
				lineHeight: 52,
				letterSpacing: -1
			}
		}
	}
};

// ─── detectTypographyConventions ─────────────────────────────────────────────

describe('detectTypographyConventions', () => {
	it('returns best-practice defaults when no references provided', () => {
		const conv = detectTypographyConventions();
		expect(conv.scss.hasCssCustomProperties).toBe(true);
		expect(conv.scss.hasMixins).toBe(true);
		expect(conv.scss.includesFontFamily).toBe(true);
		expect(conv.ts.namingCase).toBe('camelCase');
		expect(conv.ts.hasInterface).toBe(true);
		expect(conv.ts.interfaceName).toBe('TypographyToken');
		expect(conv.ts.valueFormat).toBe('number');
		expect(conv.ts.twoTier).toBe(false);
	});

	it('returns best-practice defaults when bestPractices=true even with references', () => {
		const conv = detectTypographyConventions(REF_SCSS, REF_TS, true);
		expect(conv.scss.hasCssCustomProperties).toBe(true);
		expect(conv.ts.namingCase).toBe('camelCase');
	});

	describe('SCSS convention detection', () => {
		it('detects variable prefix from reference', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.varPrefix).toBe('$font-');
		});

		it('detects no CSS custom properties', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.hasCssCustomProperties).toBe(false);
		});

		it('detects mixins are present', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.hasMixins).toBe(true);
		});

		it('detects no font-family', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.includesFontFamily).toBe(false);
		});

		it('detects font weight variables', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.includesFontWeight).toBe(true);
		});

		it('detects rem size units', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.sizeUnit).toBe('rem');
		});

		it('detects rem height units', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.heightUnit).toBe('rem');
		});

		it('detects px spacing units', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.spacingUnit).toBe('px');
		});

		it('detects two-tier structure', () => {
			const conv = detectTypographyConventions(REF_SCSS, undefined, false);
			expect(conv.scss.twoTier).toBe(true);
		});
	});

	describe('TS convention detection', () => {
		it('detects SCREAMING_SNAKE naming', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.namingCase).toBe('SCREAMING_SNAKE');
		});

		it('detects FONT_ const prefix', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.constPrefix).toBe('FONT_');
		});

		it('detects no font-family', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.includesFontFamily).toBe(false);
		});

		it('detects no interface', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.hasInterface).toBe(false);
		});

		it('detects string value format', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.valueFormat).toBe('string');
		});

		it('detects two-tier structure', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.twoTier).toBe(true);
		});

		it('detects weight exports', () => {
			const conv = detectTypographyConventions(undefined, REF_TS, false);
			expect(conv.ts.exportWeights).toBe(true);
		});
	});
});

// ─── transformToTypography — best practices ──────────────────────────────────

describe('transformToTypography — best practices', () => {
	it('generates SCSS with CSS custom properties and mixins', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web']);
		const scss = results.find((r) => r.filename === 'Typography.scss');
		expect(scss).toBeDefined();
		expect(scss!.content).toContain(':root {');
		expect(scss!.content).toContain('@mixin');
		expect(scss!.content).toContain('font-family');
	});

	it('generates TS with interface and camelCase', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web']);
		const ts = results.find((r) => r.filename === 'Typography.ts');
		expect(ts).toBeDefined();
		expect(ts!.content).toContain('export interface TypographyToken');
		expect(ts!.content).toContain('fontFamily');
		expect(ts!.content).toContain('fontSizeRem');
	});
});

// ─── transformToTypography — match existing ──────────────────────────────────

describe('transformToTypography — match existing', () => {
	const conv = detectTypographyConventions(REF_SCSS, REF_TS, false);

	it('generates SCSS in two-tier mode with variables + mixins', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const scss = results.find((r) => r.filename === 'Typography.scss');
		expect(scss).toBeDefined();
		const content = scss!.content;

		expect(content).not.toContain(':root {');
		expect(content).toContain('@mixin');
		expect(content).toContain('$font-');
		expect(content).toContain('-size:');
		expect(content).toContain('-height:');
		expect(content).toContain('-spacing:');
		expect(content).not.toContain('font-family');
	});

	it('generates SCSS weight variables when reference has them', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const scss = results.find((r) => r.filename === 'Typography.scss');
		expect(scss!.content).toContain('$font-weight-');
	});

	it('generates TS in two-tier mode with SCREAMING_SNAKE and string rem values', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const ts = results.find((r) => r.filename === 'Typography.ts');
		expect(ts).toBeDefined();
		const content = ts!.content;

		expect(content).not.toContain('export interface');
		expect(content).not.toContain('fontFamily');

		expect(content).toContain('FONT_WEIGHT_');
		expect(content).toMatch(/const FONT_[A-Z_]+ = \{/);
		expect(content).toContain("fontSize: '");
		expect(content).toContain("rem'");
	});

	it('generates TS with exported semantic aliases', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web'], conv);
		const ts = results.find((r) => r.filename === 'Typography.ts');
		expect(ts!.content).toMatch(/export const FONT_[A-Z_]+ = FONT_[A-Z_]+;/);
	});
});

// ─── transformToTypography — no typography entries ───────────────────────────

describe('transformToTypography — edge cases', () => {
	it('returns empty array when no typography entries exist', () => {
		const results = transformToTypography({ other: 'stuff' }, ['web']);
		expect(results).toEqual([]);
	});

	it('handles unwrapped format', () => {
		const unwrapped: Record<string, unknown> = {
			'droid/body/body-R': {
				$type: 'typography',
				$value: {
					fontFamily: 'Inter',
					fontSize: 16,
					fontWeight: 400,
					lineHeight: 24,
					letterSpacing: 0
				}
			}
		};
		const results = transformToTypography(unwrapped, ['web']);
		expect(results.length).toBeGreaterThan(0);
	});

	it('still works with conventions when no conventions are passed', () => {
		const results = transformToTypography(SAMPLE_TYPOGRAPHY_JSON, ['web']);
		expect(results.length).toBe(2);
		expect(results[0].filename).toBe('Typography.scss');
		expect(results[1].filename).toBe('Typography.ts');
	});
});

// ─── detectTypographyConventions — CSS custom props reference ────────────────

describe('detectTypographyConventions — CSS custom props style reference', () => {
	const cssPropsScss = `:root {
  --typo-body-family: 'Inter', sans-serif;
  --typo-body-size: 1rem;
}
@mixin typo-body {
  font-family: var(--typo-body-family);
  font-size: var(--typo-body-size);
}
`;

	it('detects CSS custom properties', () => {
		const conv = detectTypographyConventions(cssPropsScss, undefined, false);
		expect(conv.scss.hasCssCustomProperties).toBe(true);
		expect(conv.scss.includesFontFamily).toBe(true);
	});
});
