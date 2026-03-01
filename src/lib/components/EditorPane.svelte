<script lang="ts">
	import { Download, ClipboardCopy, GitPullRequest, List, WrapText, Check, X, ChevronRight, ChevronUp, ChevronDown, AlertTriangle, ArrowLeftRight, Target, Pencil, ArrowRight, Home } from 'lucide-svelte';
	import type { GeneratedFile, GenerationMode, Platform } from '$lib/types.js';
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
	import CodeMinimap from './CodeMinimap.svelte';
	import PlatformConsistency from './PlatformConsistency.svelte';
	import SwatchPanel from './SwatchPanel.svelte';
	import PrResults from './PrResults.svelte';
	import CodeViewer from './CodeViewer.svelte';
	import type { PrResult, GenerateResponse } from '$lib/types.js';
	import { type PlatformMismatch, diffStats as computeDiffStats } from '$lib/diff-utils.js';

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

	let showSuccessBanner = $state(false);
	let prevResultId = $state<number | null>(null);
	let dismissTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const id = result?.files?.length ?? 0;
		if (result && id !== prevResultId) {
			showSuccessBanner = true;
			prevResultId = id;
			if (dismissTimer) clearTimeout(dismissTimer);
			dismissTimer = setTimeout(() => { showSuccessBanner = false; }, 5000);
		}
	});

	function getViewMode(filename: string): ViewMode {
		return viewModes[filename] ?? 'code';
	}
</script>

<div class="editor-pane atmosphere-noise">
		<div class="editor-wrapper">
		{#if tokensUpdatedBanner}
			<div class="tokens-updated-banner">
				<span class="tokens-updated-text">
					Tokens updated to v{tokensUpdatedBanner.version}{tokensUpdatedBanner.summary ? ` — ${tokensUpdatedBanner.summary}` : ''}
				</span>
				<button class="tokens-updated-btn" onclick={onRegenerate}>Regenerate</button>
			</div>
		{/if}
		<!-- File tabs bar -->
		<div class="file-tabs-bar">
			{#if onBackToHome}
				<button class="home-btn" onclick={onBackToHome} title="Back to home" aria-label="Back to home">
					<Home size={13} strokeWidth={2} />
				</button>
			{/if}
			<div class="file-tabs" role="tablist" aria-label="Open files">
				{#each visibleFiles as file (file.filename)}
					{@const dotColor = file.format === 'scss' ? '#F06090' : file.format === 'css' ? '#2196F3' : file.format === 'typescript' ? '#3178C6' : file.format === 'swift' ? '#FF8040' : file.format === 'kotlin' ? '#B060FF' : '#4D9EFF'}
					{@const fileDiffs = diffs[file.filename]}
					{@const fileDiffStats = fileDiffs ? computeDiffStats(fileDiffs, modifications[file.filename]) : null}
					<button
						class="file-tab"
						class:file-tab--active={activeTab === file.filename}
						role="tab"
						aria-selected={activeTab === file.filename}
						onclick={() => onTabSelect(file.filename)}
						onkeydown={onTabKeydown}
						style="--tab-accent: {dotColor}"
					>
						<span class="tab-dot" style="background: {dotColor}"></span>
						{file.filename}
						{#if fileDiffStats && (fileDiffStats.added > 0 || fileDiffStats.removed > 0)}
							<span class="tab-diff-pill" title="+{fileDiffStats.added} / -{fileDiffStats.removed}">
								{fileDiffStats.added + fileDiffStats.removed}
							</span>
						{/if}
					</button>
				{/each}
			</div>

			{#if hasDualMode}
				<div class="mode-toggle" role="group" aria-label="Generation mode">
					<button
						class="mode-btn"
						class:mode-btn--active={activeMode === 'matched'}
						onclick={() => onModeChange('matched')}
					>
						Your conventions
					</button>
					<button
						class="mode-btn"
						class:mode-btn--active={activeMode === 'best-practices'}
						onclick={() => onModeChange('best-practices')}
					>
						Best practices
					</button>
				</div>
			{/if}

			<div class="tab-actions">
				<!-- Theme picker -->
				<div class="theme-picker">
					<button
						class="theme-btn"
						onclick={onThemePickerToggle}
						title="Change editor theme"
						aria-label="Change editor theme"
					>
						<span class="theme-dot" style="background: {themes.find(t => t.id === selectedTheme)?.bg ?? '#22272e'}"></span>
					</button>
					{#if showThemePicker}
						<div class="theme-menu" role="menu" aria-label="Editor themes">
							<span class="theme-group-label">Dark</span>
							{#each themes.filter(t => t.mode === 'dark') as t (t.id)}
								<button class="theme-option" class:theme-option--active={selectedTheme === t.id} role="menuitem" onclick={() => onChangeTheme(t.id)}>
									<span class="theme-dot" style="background: {t.bg}"></span>
									{t.label}
								</button>
							{/each}
							<span class="theme-group-label">Light</span>
							{#each themes.filter(t => t.mode === 'light') as t (t.id)}
								<button class="theme-option" class:theme-option--active={selectedTheme === t.id} role="menuitem" onclick={() => onChangeTheme(t.id)}>
									<span class="theme-dot" style="background: {t.bg}"></span>
									{t.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Action buttons -->
				<button class="ctrl-btn" onclick={onCopyFile} title="Copy file to clipboard">
					<ClipboardCopy size={12} strokeWidth={2} />
					Copy
				</button>

				<button class="ctrl-btn" onclick={onDownloadZip} title="Download ZIP">
					<Download size={12} strokeWidth={2} />
					ZIP
				</button>

				{#if Object.keys(diffs).length > 0}
					<button class="ctrl-btn" onclick={onCopyChangelog} title="Copy changelog">
						<ClipboardCopy size={12} strokeWidth={2} />
						Changelog
					</button>

					<button class="ctrl-btn ctrl-btn--primary" onclick={onSendPRs} disabled={sendingPrs} title="Create pull requests">
						{#if sendingPrs}
							<span class="btn-spinner"></span>
						{:else}
							<GitPullRequest size={12} strokeWidth={2} />
						{/if}
						PR
					</button>
				{/if}
			</div>
		</div>

		{#if showSuccessBanner}
			<div class="success-banner">
				<div class="success-banner-inner">
					<Check size={14} strokeWidth={2.5} />
					<span>{visibleFiles.length} file{visibleFiles.length !== 1 ? 's' : ''} generated</span>
					{#if diffTotals.added > 0 || diffTotals.removed > 0}
						<span class="success-stats">
							{#if diffTotals.added > 0}<span class="success-stat success-stat--add">+{diffTotals.added}</span>{/if}
							{#if diffTotals.removed > 0}<span class="success-stat success-stat--del">-{diffTotals.removed}</span>{/if}
						</span>
					{/if}
				</div>
				<div class="success-banner-actions">
					<button class="success-action" onclick={onCopyFile}>
						<ClipboardCopy size={12} strokeWidth={2} />
						Copy
					</button>
					<button class="success-action" onclick={onDownloadZip}>
						<Download size={12} strokeWidth={2} />
						ZIP
					</button>
					{#if Object.keys(diffs).length > 0}
						<button class="success-action success-action--primary" onclick={onSendPRs}>
							<GitPullRequest size={12} strokeWidth={2} />
							Send PR
						</button>
					{/if}
					<button class="success-dismiss" onclick={() => (showSuccessBanner = false)} aria-label="Dismiss">
						<X size={12} />
					</button>
				</div>
			</div>
		{/if}

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

	/* ─── View Wrappers ──────────────────────────── */
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

	/* ─── Success Banner ─────────────────────────── */
	.success-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px;
		background: var(--surface-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--borderColor-muted);
		border-left: 3px solid var(--brand-color, var(--fgColor-success));
	}

	.success-banner-inner {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--fgColor-success, #2ea043);
	}

	.success-stats {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 4px;
		padding-left: 8px;
		border-left: 1px solid var(--borderColor-muted);
	}

	.success-stat {
		font-family: var(--font-code);
		font-size: 11px;
		font-weight: 600;
	}

	.success-stat--add { color: var(--fgColor-success, #2ea043); }
	.success-stat--del { color: var(--fgColor-danger, #f85149); }

	.success-banner-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.success-action {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: 500;
		font-family: var(--font-code);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--radius-sm);
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.success-action:hover {
		background: var(--bgColor-muted);
	}

	.success-action--primary {
		background: var(--bgColor-success-emphasis, #2ea043);
		color: #fff;
		border-color: transparent;
	}

	.success-action--primary:hover {
		opacity: 0.9;
	}

	.success-dismiss {
		display: inline-flex;
		align-items: center;
		padding: 2px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.success-dismiss:hover {
		color: var(--fgColor-default);
		background: var(--bgColor-muted);
	}

	/* ─── Tokens Updated Banner ─────────────────── */
	.tokens-updated-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px;
		background: var(--surface-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--borderColor-muted);
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-attention);
		animation: banner-slide-in var(--transition-default) ease;
		z-index: 2;
		position: relative;
	}

	.tokens-updated-text {
		font-weight: 500;
	}

	.tokens-updated-btn {
		flex-shrink: 0;
		padding: 4px 12px;
		background: var(--bgColor-attention-emphasis);
		color: var(--fgColor-onEmphasis);
		border: none;
		border-radius: var(--radius-md);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.tokens-updated-btn:hover {
		opacity: 0.85;
	}

	@keyframes banner-slide-in {
		from { transform: translateY(-100%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	/* ─── File Tabs ──────────────────────────────── */
	.file-tabs-bar {
		display: flex;
		align-items: center;
		background: var(--bgColor-default);
		border-bottom: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
		min-height: 36px;
		position: relative;
	}

	.home-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 28px;
		flex-shrink: 0;
		background: none;
		border: none;
		border-right: 1px solid var(--borderColor-muted);
		color: var(--fgColor-muted);
		cursor: pointer;
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.home-btn:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.file-tabs {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		mask-image: linear-gradient(to right, transparent 0, black 8px, black calc(100% - 4px), transparent 100%);
		-webkit-mask-image: linear-gradient(to right, transparent 0, black 8px, black calc(100% - 4px), transparent 100%);
	}

	.file-tabs::-webkit-scrollbar {
		display: none;
	}

	.file-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px 8px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		color: var(--fgColor-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: color var(--transition-fast), border-color var(--transition-fast);
	}

	.file-tab:hover {
		color: var(--fgColor-default);
	}

	.file-tab--active {
		color: var(--fgColor-default);
		border-bottom-color: var(--tab-accent, var(--brand-color, var(--fgColor-accent)));
	}

	.tab-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		opacity: 0.5;
	}

	.file-tab--active .tab-dot {
		opacity: 1;
	}

	.tab-diff-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		font-family: var(--font-code);
		font-size: 9px;
		font-weight: 600;
		color: var(--fgColor-attention);
		background: color-mix(in srgb, var(--fgColor-attention) 10%, transparent);
		border-radius: 100px;
		line-height: 1;
	}

	.tab-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		flex-shrink: 0;
	}

	/* ─── Mode Toggle ────────────────────────────── */
	.mode-toggle {
		display: flex;
		align-items: center;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-md);
		padding: 2px;
		gap: 2px;
		flex-shrink: 0;
		margin-right: 4px;
	}

	.mode-btn {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		padding: 3px 10px;
		background: transparent;
		border: none;
		border-radius: calc(var(--radius-md) - 2px);
		color: var(--fgColor-disabled);
		cursor: pointer;
		white-space: nowrap;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.mode-btn:hover {
		color: var(--fgColor-muted);
	}

	.mode-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-default);
		box-shadow: var(--shadow-button);
	}

	/* ─── Theme Picker ───────────────────────────── */
	.theme-picker { position: relative; display: flex; align-items: center; }

	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		background: transparent;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: border-color var(--transition-default);
	}

	.theme-btn:hover { border-color: var(--borderColor-default); }

	.theme-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.15);
		flex-shrink: 0;
	}

	.theme-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 50;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-md);
		padding: 4px;
		min-width: 140px;
		box-shadow: var(--shadow-panel);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.theme-option {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 5px 9px;
		font-family: var(--font-display);
		font-size: 10px;
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background var(--transition-fast);
	}

	.theme-option:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}

	.theme-option--active {
		color: var(--fgColor-default);
		background: var(--control-bgColor-rest);
	}

	.theme-option--active::after {
		content: '✓';
		margin-left: auto;
		font-size: 9px;
		color: var(--fgColor-accent);
	}

	.theme-group-label {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 600;
		color: var(--fgColor-disabled);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 6px 10px 2px;
		user-select: none;
	}

	/* ─── Ctrl Buttons ───────────────────────────── */
	.ctrl-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		color: var(--fgColor-muted);
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		border-radius: var(--radius-md);
		padding: 3px 8px;
		cursor: pointer;
		white-space: nowrap;
		transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
	}

	.ctrl-btn:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-emphasis);
		background: var(--control-bgColor-hover);
	}

	.ctrl-btn--primary {
		background: var(--bgColor-accent-muted);
		border-color: color-mix(in srgb, var(--borderColor-accent-emphasis) 40%, transparent);
		color: var(--fgColor-accent);
	}

	.ctrl-btn--primary:hover {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 80%, var(--bgColor-accent-emphasis));
		color: var(--fgColor-onEmphasis);
	}

	.ctrl-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-spinner {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 1.5px solid color-mix(in srgb, var(--fgColor-accent) 30%, transparent);
		border-top-color: var(--fgColor-accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* ─── Responsive: medium ─────────────────────── */
	@media (max-width: 1199px) {
		.file-tab {
			max-width: 140px;
		}
	}

	/* ─── Responsive: small ──────────────────────── */
	@media (max-width: 767px) {
		.file-tab {
			max-width: 110px;
			padding: 6px 8px 8px;
			font-size: 10px;
		}
	}
</style>
