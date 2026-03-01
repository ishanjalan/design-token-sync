<script lang="ts">
	import type { GeneratedFile, GenerationMode, Platform } from '$lib/types.js';
	import SuccessBanner from './SuccessBanner.svelte';
	import TokensUpdatedBanner from './TokensUpdatedBanner.svelte';
	import FileTabsBar from './FileTabsBar.svelte';
	import {
		type DiffLine,
		type ViewMode,
		type TokenModification,
		type RenameEntry,
		type FamilyRename,
		type TokenCoverageResult,
		type ImpactEntry
	} from '$lib/diff-utils.js';
	import type { Swatch, SwatchComparison } from '$lib/swatch-utils.js';
	import PlatformConsistency from './PlatformConsistency.svelte';
	import SwatchPanel from './SwatchPanel.svelte';
	import PrResults from './PrResults.svelte';
	import CodeViewer from './CodeViewer.svelte';
	import type { PrResult, GenerateResponse } from '$lib/types.js';
	import { type PlatformMismatch } from '$lib/diff-utils.js';

	interface ThemeOption {
		id: string;
		label: string;
		bg: string;
		mode: 'dark' | 'light';
	}

	interface Props {
		result: GenerateResponse;
		visibleFiles: GeneratedFile[];
		activeTab: string;
		highlights: Record<string, string>;
		diffs: Record<string, DiffLine[]>;
		viewModes: Record<string, ViewMode>;
		modifications: Record<string, TokenModification[]>;
		renames: Record<string, RenameEntry[]>;
		familyRenames: Record<string, FamilyRename[]>;
		tokenCoverage: Record<string, TokenCoverageResult>;
		deprecations: Record<string, string[]>;
		impactedTokens: ImpactEntry[];
		searchQuery: string;
		searchInputEl: HTMLInputElement | null;
		searchShortcutHint: string;
		highlightedLines: { start: number; end: number } | null;
		wrapLines: boolean;
		showSectionNav: boolean;
		showChangeSummary: Record<string, boolean>;
		collapsedSections: Set<number>;
		currentBreadcrumb: string;
		codeScrollTop: number;
		codeScrollHeight: number;
		codeClientHeight: number;
		codeScrollEl: HTMLElement | null;
		lastGeneratedAt: Date | null;
		sendingPrs: boolean;
		diffTotals: { added: number; removed: number; modified: number };
		diffNavIndex: Record<string, number>;
		swatches: Swatch[];
		showSwatches: boolean;
		swatchComparisons: SwatchComparison[];
		swatchTab: 'all' | 'changes';
		prResults: PrResult[];
		platformMismatches: PlatformMismatch[];
		themes: readonly ThemeOption[];
		selectedTheme: string;
		showThemePicker: boolean;
		selectedPlatforms: Platform[];
		tokensUpdatedBanner?: { version: number; summary: string } | null;
		onRegenerate?: () => void;
		onBackToHome?: () => void;
		hasDualMode: boolean;
		activeMode: GenerationMode;
		onModeChange: (mode: GenerationMode) => void;
		formatTime: (d: Date) => string;
		timeAgo: (d: Date) => string;
		platformColor: (platform: Platform) => string;
		onTabSelect: (f: string) => void;
		onTabKeydown: (e: KeyboardEvent) => void;
		onViewModeChange: (filename: string, mode: ViewMode) => void;
		onSearchChange: (q: string) => void;
		onSearchInputBind: (el: HTMLInputElement) => void;
		onCodeKeydown: (e: KeyboardEvent) => void;
		onCodeScroll: (e: Event) => void;
		onCodeScrollBind: (el: HTMLElement) => void;
		onLineClick: (lineNum: number, e: MouseEvent) => void;
		onSectionNavToggle: () => void;
		onScrollToLine: (line: number) => void;
		onWrapToggle: () => void;
		onChangeSummaryToggle: (filename: string) => void;
		onNavigateDiff: (filename: string, dir: 'prev' | 'next') => void;
		onSeekMinimap: (fraction: number) => void;
		onDownloadZip: () => void;
		onCopyFile: () => void;
		onSendPRs: () => void;
		onCopyChangelog: () => void;
		onToggleSwatches: () => void;
		onSwatchTabChange: (t: 'all' | 'changes') => void;
		onDismissPrResults: () => void;
		onRetryPr: (platform: string) => void;
		onChangeTheme: (id: string) => void;
		onThemePickerToggle: () => void;
		extractSections: (content: string) => { label: string; line: number }[];
		extractDiffColor: (text: string) => string | null;
		computeHunkHeaders: (lines: DiffLine[]) => Set<number>;
		nearestContext: (lines: DiffLine[], idx: number) => string;
		langLabel: (format: string) => string;
		formatFileSize: (bytes: number) => string;
	}

	let {
		result, visibleFiles, activeTab, highlights, diffs, viewModes, modifications,
		renames, familyRenames, tokenCoverage, deprecations, impactedTokens,
		searchQuery, searchInputEl, searchShortcutHint, highlightedLines, wrapLines,
		showSectionNav, showChangeSummary, collapsedSections, currentBreadcrumb,
		codeScrollTop, codeScrollHeight, codeClientHeight, codeScrollEl,
		lastGeneratedAt, sendingPrs, diffTotals, diffNavIndex, swatches,
		showSwatches, swatchComparisons, swatchTab, prResults,
		platformMismatches, themes, selectedTheme, showThemePicker, selectedPlatforms,
		tokensUpdatedBanner = null, onRegenerate, onBackToHome,
		hasDualMode, activeMode, onModeChange,
		formatTime, timeAgo, platformColor,
		onTabSelect, onTabKeydown, onViewModeChange, onSearchChange, onSearchInputBind,
		onCodeKeydown, onCodeScroll, onCodeScrollBind, onLineClick, onSectionNavToggle,
		onScrollToLine, onWrapToggle, onChangeSummaryToggle, onNavigateDiff,
		onSeekMinimap, onDownloadZip, onCopyFile, onSendPRs, onCopyChangelog, onToggleSwatches,
		onSwatchTabChange, onDismissPrResults,
		onRetryPr, onChangeTheme, onThemePickerToggle,
		extractSections, extractDiffColor, computeHunkHeaders, nearestContext,
		langLabel, formatFileSize
	}: Props = $props();

	function getViewMode(filename: string): ViewMode {
		return viewModes[filename] ?? 'code';
	}
</script>

<div class="editor-pane atmosphere-noise">
	<div class="editor-wrapper">
		{#if tokensUpdatedBanner}
			<TokensUpdatedBanner
				version={tokensUpdatedBanner.version}
				summary={tokensUpdatedBanner.summary}
				onRegenerate={onRegenerate ?? (() => {})}
			/>
		{/if}
		<FileTabsBar
			{visibleFiles}
			{activeTab}
			{diffs}
			{modifications}
			{hasDualMode}
			{activeMode}
			{themes}
			{selectedTheme}
			{showThemePicker}
			{sendingPrs}
			hasDiffs={Object.keys(diffs).length > 0}
			{onBackToHome}
			{onTabSelect}
			{onTabKeydown}
			{onModeChange}
			{onThemePickerToggle}
			{onChangeTheme}
			{onCopyFile}
			{onDownloadZip}
			{onCopyChangelog}
			{onSendPRs}
		/>
		<SuccessBanner
			{result}
			{diffTotals}
			hasDiffs={Object.keys(diffs).length > 0}
			onCopy={onCopyFile}
			onDownload={onDownloadZip}
			{onSendPRs}
		/>

		<!-- Per-file views -->
		{#each visibleFiles as file (file.filename)}
			{#if activeTab === file.filename}
				<CodeViewer
					{file}
					diffLines={diffs[file.filename] ?? null}
					viewMode={getViewMode(file.filename)}
					highlight={highlights[file.filename] ?? null}
					modifications={modifications[file.filename] ?? []}
					renames={renames[file.filename] ?? []}
					familyRenames={familyRenames[file.filename] ?? []}
					coverage={tokenCoverage[file.filename] ?? null}
					deprecations={deprecations[file.filename] ?? []}
					impacts={impactedTokens}
					{searchQuery}
					{searchShortcutHint}
					diffNavIndex={diffNavIndex[file.filename] ?? 0}
					showChangeSummary={showChangeSummary[file.filename] ?? false}
					{wrapLines}
					{showSectionNav}
					{currentBreadcrumb}
					{highlightedLines}
					{codeScrollTop}
					{codeScrollHeight}
					{codeClientHeight}
					onViewModeChange={(mode) => onViewModeChange(file.filename, mode)}
					onNavigateDiff={(dir) => onNavigateDiff(file.filename, dir)}
					onChangeSummaryToggle={() => onChangeSummaryToggle(file.filename)}
					{onScrollToLine}
					{onSectionNavToggle}
					{onWrapToggle}
					{onSearchChange}
					{onCodeKeydown}
					{onCodeScroll}
					{onLineClick}
					{onSeekMinimap}
					{extractSections}
					{extractDiffColor}
					{computeHunkHeaders}
					{nearestContext}
				/>
			{/if}
		{/each}

		<!-- Overlays -->
		<PlatformConsistency mismatches={platformMismatches} />

		{#if showSwatches && swatches.length > 0}
			<SwatchPanel
				{swatches}
				comparisons={swatchComparisons}
				tab={swatchTab}
				onTabChange={onSwatchTabChange}
				onClose={() => onToggleSwatches()}
			/>
		{/if}

		<PrResults
			results={prResults}
			{platformColor}
			onRetry={onRetryPr}
			onDismiss={onDismissPrResults}
		/>
		</div>
</div>

<style>
	.editor-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		position: relative;
		background: var(--bgColor-default);
	}

	/* Vignette effect */
	.editor-pane::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		background: radial-gradient(ellipse at center, transparent 60%, color-mix(in srgb, var(--bgColor-default) 95%, black) 100%);
		opacity: var(--atmosphere-vignette-strength, 0.08);
	}

	.editor-pane > * {
		position: relative;
		z-index: 1;
	}

	.editor-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		animation: view-enter 200ms ease both;
	}

	@keyframes view-enter {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@media (prefers-reduced-motion: reduce) {
		.editor-wrapper {
			animation-duration: 0.01ms !important;
		}
	}
</style>
