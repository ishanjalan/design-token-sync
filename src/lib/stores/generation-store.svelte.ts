import { browser } from '$app/environment';
import type { GenerateResponse, GeneratedFile, Platform } from '$lib/types.js';
import {
	type DiffLine,
	type ViewMode,
	type TokenModification,
	type RenameEntry,
	type FamilyRename,
	type TokenCoverageResult,
	type PlatformMismatch,
	type ImpactEntry,
	enrichWordDiffs,
	diffStats,
	extractModifiedTokens,
	extractDeprecations
} from '$lib/diff-utils.js';
import {
	computeTokenCoverage,
	validateCrossPlatform,
	computeImpact,
	detectFamilyRenames,
	detectRenames
} from '$lib/token-analysis.js';
import type { SwatchComparison } from '$lib/swatch-utils.js';
import { computeSwatchComparison } from '$lib/swatch-utils.js';
import { saveResult, loadResult } from '$lib/storage.js';
import { fileStore } from './file-store.svelte.js';

class GenerationStoreClass {
	result = $state<GenerateResponse | null>(null);
	errorMsg = $state<string | null>(null);
	errorHint = $state<string | null>(null);
	progressStatus = $state<string | null>(null);
	activeTab = $state<string>('');
	lastGeneratedAt = $state<Date | null>(null);
	viewModes = $state<Record<string, ViewMode>>({});
	highlights = $state<Record<string, string>>({});
	diffs = $state<Record<string, DiffLine[]>>({});
	deprecations = $state<Record<string, string[]>>({});
	modifications = $state<Record<string, TokenModification[]>>({});
	renames = $state<Record<string, RenameEntry[]>>({});
	familyRenames = $state<Record<string, FamilyRename[]>>({});
	tokenCoverage = $state<Record<string, TokenCoverageResult>>({});
	platformMismatches = $state<PlatformMismatch[]>([]);
	impactedTokens = $state<ImpactEntry[]>([]);
	swatchComparisons = $state<SwatchComparison[]>([]);

	get visibleFiles(): GeneratedFile[] {
		return (
			this.result?.files?.filter((f) =>
				fileStore.selectedPlatforms.includes(f.platform as Platform)
			) ?? []
		);
	}

	get activeFile(): GeneratedFile | undefined {
		return this.visibleFiles.find((f) => f.filename === this.activeTab);
	}

	get diffTotals() {
		let added = 0,
			removed = 0,
			modified = 0;
		for (const f of this.visibleFiles) {
			const lines = this.diffs[f.filename];
			if (!lines) continue;
			const s = diffStats(lines, this.modifications[f.filename]);
			added += s.added;
			removed += s.removed;
			modified += s.modified;
		}
		return { added, removed, modified };
	}

	init() {
		const storedResult = loadResult();
		if (storedResult) {
			this.result = storedResult.data as GenerateResponse;
			this.lastGeneratedAt = new Date(storedResult.savedAt);
			if (this.result?.files?.length) this.activeTab = this.result.files[0].filename;
		}
	}

	resetForGeneration() {
		this.errorMsg = null;
		this.errorHint = null;
		this.progressStatus = null;
		this.result = null;
		this.highlights = {};
		this.diffs = {};
		this.viewModes = {};
	}

	applyResult(parsed: GenerateResponse) {
		this.result = parsed;
		this.lastGeneratedAt = new Date();
		this.activeTab = parsed.files[0].filename;
		saveResult(parsed);
	}

	resetAll() {
		this.result = null;
		this.lastGeneratedAt = null;
		this.highlights = {};
		this.diffs = {};
		this.viewModes = {};
		this.errorMsg = null;
		this.errorHint = null;
		this.progressStatus = null;
		this.modifications = {};
		this.renames = {};
		this.familyRenames = {};
		this.tokenCoverage = {};
		this.platformMismatches = [];
		this.impactedTokens = [];
		this.swatchComparisons = [];
	}

	injectColorSwatches(html: string): string {
		const parts = html.split(/(<[^>]*>)/);
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].startsWith('<')) continue;
			parts[i] = parts[i].replace(
				/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g,
				(match, hex) => {
					const full =
						hex.length === 3
							? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
							: `#${hex.slice(0, 6)}`;
					return `<span class="code-color-dot" style="background:${full}" aria-hidden="true"></span>${match}`;
				}
			);
			parts[i] = parts[i].replace(
				/0x([0-9a-fA-F]{6,8})(?![0-9a-fA-F])/gi,
				(match, hex) => {
					const rgb = hex.length === 8 ? hex.slice(2) : hex;
					return `<span class="code-color-dot" style="background:#${rgb.slice(0, 6)}" aria-hidden="true"></span>${match}`;
				}
			);
		}
		return parts.join('');
	}

	async highlightAll(files: GeneratedFile[], themeId: string, themeBg: string) {
		if (!browser) return;
		const { codeToHtml } = await import('shiki');
		const langMap: Record<string, string> = {
			css: 'css',
			scss: 'scss',
			typescript: 'typescript',
			swift: 'swift',
			kotlin: 'kotlin'
		};
		const next: Record<string, string> = {};
		for (const file of files) {
			const lang = langMap[file.format] ?? 'text';
			try {
				const raw = await codeToHtml(file.content, {
					lang,
					theme: themeId,
					colorReplacements: { [themeBg]: 'transparent' }
				});
				next[file.filename] = this.injectColorSwatches(raw);
			} catch (err) {
				console.error('[shiki] highlight failed for', file.filename, err);
			}
		}
		this.highlights = next;
	}

	async computeAllDiffs(files: GeneratedFile[]) {
		const { diffLines: diffLinesFn, diffWords } = await import('diff');
		for (const file of files) {
			if (!file.referenceContent) continue;
			const changes = diffLinesFn(file.referenceContent, file.content);
			const lines: DiffLine[] = [];
			let oldLine = 1,
				newLine = 1;
			for (const change of changes) {
				const type = change.added ? 'add' : change.removed ? 'remove' : 'equal';
				const texts = change.value.replace(/\n$/, '').split('\n');
				for (const text of texts) {
					const dl: DiffLine = { type, text };
					if (type === 'equal') {
						dl.oldLineNum = oldLine++;
						dl.newLineNum = newLine++;
					} else if (type === 'remove') {
						dl.oldLineNum = oldLine++;
					} else {
						dl.newLineNum = newLine++;
					}
					lines.push(dl);
				}
			}
			enrichWordDiffs(lines, diffWords);
			this.diffs[file.filename] = lines;
		}
		this.deprecations = extractDeprecations(this.diffs);
		this.modifications = extractModifiedTokens(this.diffs);
		this.renames = detectRenames(this.diffs);
		this.familyRenames = detectFamilyRenames(this.renames);
		this.tokenCoverage = computeTokenCoverage(files);
		this.platformMismatches = files.length >= 2 ? validateCrossPlatform(files) : [];
		if (fileStore.dependencyMap.length > 0)
			this.impactedTokens = computeImpact(
				fileStore.dependencyMap,
				this.modifications,
				this.renames,
				this.deprecations
			);
		this.swatchComparisons = computeSwatchComparison(files);
	}
}

export const genStore = new GenerationStoreClass();
