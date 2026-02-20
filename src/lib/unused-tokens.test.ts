import { describe, it, expect } from 'vitest';
import { detectUnusedTokens, unusedSummary } from './unused-tokens.js';
import type { GeneratedFile } from './types.js';

describe('detectUnusedTokens', () => {
	it('detects tokens in reference but not in generated', () => {
		const files: GeneratedFile[] = [
			{
				filename: 'Colors.scss',
				content: '$text-primary: var(--text-primary);\n$fill-primary: var(--fill-primary);\n',
				format: 'scss',
				platform: 'web',
				referenceContent:
					'$text-primary: var(--text-primary);\n$fill-primary: var(--fill-primary);\n$old-token: var(--old-token);\n'
			}
		];
		const results = detectUnusedTokens(files);
		expect(results).toHaveLength(1);
		expect(results[0].unusedInFigma).toContain('old-token');
	});

	it('returns empty when no reference files', () => {
		const files: GeneratedFile[] = [
			{
				filename: 'Colors.scss',
				content: '$text-primary: #000;\n',
				format: 'scss',
				platform: 'web'
			}
		];
		const results = detectUnusedTokens(files);
		expect(results).toHaveLength(0);
	});

	it('returns empty when all tokens match', () => {
		const content = '$grey-750: #1d1d1d;\n$grey-50: #f5f5f5;\n';
		const files: GeneratedFile[] = [
			{
				filename: 'Primitives.scss',
				content,
				format: 'scss',
				platform: 'web',
				referenceContent: content
			}
		];
		const results = detectUnusedTokens(files);
		expect(results[0].unusedInFigma).toHaveLength(0);
	});
});

describe('unusedSummary', () => {
	it('sums totals', () => {
		const results = [
			{ filename: 'a', unusedInFigma: ['x', 'y'], orphanedPrimitives: ['z'], totalGenerated: 10, totalReference: 12 },
			{ filename: 'b', unusedInFigma: ['w'], orphanedPrimitives: [], totalGenerated: 5, totalReference: 6 }
		];
		const s = unusedSummary(results);
		expect(s.totalUnused).toBe(3);
		expect(s.totalOrphaned).toBe(1);
	});
});
