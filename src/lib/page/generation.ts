import type { DropZoneKey, GenerateResponse, Platform } from '$lib/types.js';
import type { ChangelogContext } from '$lib/diff-utils.js';

interface GenerationStores {
	fileStore: {
		canGenerate: boolean;
		loading: boolean;
		needsRegeneration: boolean;
		selectedPlatforms: Platform[];
		selectedOutputs: string[];
		slots: Record<string, { file: File | null; files: File[] }>;
	};
	genStore: {
		result: GenerateResponse | null;
		progressStatus: string | null;
		errorMsg: string | null;
		resetForGeneration: () => void;
		applyResult: (parsed: GenerateResponse) => void;
		activeTab: string;
		diffs: Record<string, unknown>;
		deprecations: Record<string, unknown>;
		modifications: Record<string, unknown>;
		renames: Record<string, unknown>;
		familyRenames: Record<string, unknown>;
		tokenCoverage: Record<string, unknown>;
		platformMismatches: unknown[];
		impactedTokens: unknown[];
	};
	tokenStore: {
		tokensAutoLoaded: boolean;
		tokensUpdatedBanner: unknown;
	};
	uiStore: {
		searchQuery: string;
		activePanel: string | null;
	};
}

interface PlatformLabel {
	id: Platform;
	label: string;
}

export function buildChangelogCtx(
	genStore: GenerationStores['genStore'],
	platforms: PlatformLabel[]
): ChangelogContext {
	return {
		files: genStore.result?.files ?? [],
		platforms: genStore.result?.platforms ?? [],
		platformLabels: platforms,
		diffs: genStore.diffs,
		deprecations: genStore.deprecations,
		modifications: genStore.modifications,
		renames: genStore.renames,
		familyRenames: genStore.familyRenames,
		tokenCoverage: genStore.tokenCoverage,
		platformMismatches: genStore.platformMismatches,
		impactedTokens: genStore.impactedTokens
	} as ChangelogContext;
}

export async function generate(
	stores: GenerationStores,
	refKeys: DropZoneKey[],
	toast: { success: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
	const { fileStore, genStore, tokenStore, uiStore } = stores;
	if (!fileStore.canGenerate) return;
	fileStore.loading = true;
	genStore.resetForGeneration();
	fileStore.needsRegeneration = false;
	tokenStore.tokensAutoLoaded = false;
	tokenStore.tokensUpdatedBanner = null;
	try {
		genStore.progressStatus = 'Preparing token files…';
		const fd = new FormData();
		fd.append('lightColors', fileStore.slots.lightColors.file!);
		fd.append('darkColors', fileStore.slots.darkColors.file!);
		fd.append('values', fileStore.slots.values.file!);
		fd.append('platforms', JSON.stringify(fileStore.selectedPlatforms));
		fd.append('outputs', JSON.stringify(fileStore.selectedOutputs));
		if (fileStore.slots.typography.file) fd.append('typography', fileStore.slots.typography.file);
		const REF_KEY_PLATFORM: Record<string, string> = {
			referenceColorsWeb: 'web',
			referenceTypographyWeb: 'web',
			referenceColorsSwift: 'ios',
			referenceColorsKotlin: 'android',
			referenceTypographySwift: 'ios',
			referenceTypographyKotlin: 'android',
		};
		for (const key of refKeys) {
			const platform = REF_KEY_PLATFORM[key];
			if (platform && !fileStore.selectedPlatforms.includes(platform as Platform)) continue;
			const slot = fileStore.slots[key];
			if (slot.files.length > 0) {
				for (const f of slot.files) fd.append(key, f);
			} else if (slot.file) {
				fd.append(key, slot.file);
			}
		}
		const themeSlot = fileStore.slots.additionalThemes;
		if (themeSlot.files.length > 0) {
			for (const f of themeSlot.files) fd.append('additionalThemes', f);
		} else if (themeSlot.file) {
			fd.append('additionalThemes', themeSlot.file);
		}
		genStore.progressStatus = `Generating ${fileStore.selectedPlatforms.map((p: string) => p === 'web' ? 'Web' : p === 'ios' ? 'iOS' : 'Android').join(', ')}…`;
		const res = await fetch('/api/generate', { method: 'POST', body: fd });
		if (!res.ok) {
			const text = await res.text();
			let hint = '';
			if (res.status === 400) hint = ' — Check that your token files are valid Figma DTCG exports.';
			else if (res.status === 413) hint = ' — File size exceeds the limit. Try reducing token file size.';
			else if (res.status === 422) hint = ' — Validation failed. Ensure $type and $value fields are present.';
			throw new Error((text || `HTTP ${res.status}`) + hint);
		}
		genStore.progressStatus = 'Processing results…';
		let parsed: GenerateResponse;
		try { parsed = await res.json(); } catch { throw new Error('Server returned invalid JSON — the server may have encountered an internal error.'); }
		if (!parsed?.files?.length) throw new Error('No files were generated — check that your token files contain color or typography tokens.');
		genStore.applyResult(parsed);
		uiStore.searchQuery = '';
		toast.success(`${parsed.files.length} files generated`);
		uiStore.activePanel = 'files';
	} catch (e) {
		genStore.errorMsg = e instanceof Error ? e.message : 'Generation failed';
		toast.error(genStore.errorMsg ?? 'Generation failed');
	} finally {
		fileStore.loading = false;
		genStore.progressStatus = null;
	}
}
