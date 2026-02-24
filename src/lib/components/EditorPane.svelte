<script lang="ts">
	import { Download, ClipboardCopy, GitPullRequest, List, WrapText, Check, X, ChevronRight, ChevronUp, ChevronDown, AlertTriangle, ArrowLeftRight, Target, Pencil, ArrowRight, Home } from 'lucide-svelte';
	import type { GeneratedFile, Platform, DropZoneKey, FileSlot, OutputCategory } from '$lib/types.js';
	import type { FileInsight } from '$lib/file-validation.js';
	import WelcomeView from './WelcomeView.svelte';
	import {
		type DiffLine,
		type ViewMode,
		type TokenModification,
		type RenameEntry,
		type FamilyRename,
		type TokenCoverageResult,
		type ImpactEntry,
		diffStats,
		diffChangeIndices,
		filterDiffLines
	} from '$lib/diff-utils.js';
	import type { Swatch, SwatchComparison } from '$lib/swatch-utils.js';
	import { buildSearchHighlight } from '$lib/search-utils.js';
	import CodeMinimap from './CodeMinimap.svelte';
	import PlatformConsistency from './PlatformConsistency.svelte';
	import SwatchPanel from './SwatchPanel.svelte';
	import PrResults from './PrResults.svelte';
	import type { PrResult, GenerateResponse } from '$lib/types.js';
	import { type PlatformMismatch, diffStats as computeDiffStats } from '$lib/diff-utils.js';

	interface ThemeOption {
		id: string;
		label: string;
		bg: string;
		mode: 'dark' | 'light';
	}

	interface PlatformOption {
		id: Platform;
		label: string;
		sublabel: string;
		color: string;
		icon: string;
		techIcons: { svg: string; color: string; label: string }[];
	}

	interface Props {
		result: GenerateResponse | null;
		errorMsg?: string | null;
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
		storedTokenVersion?: number | null;
		storedTokenPushedAt?: string | null;
		tokensUpdatedBanner?: { version: number; summary: string } | null;
		onRegenerate?: () => void;
		onBackToHome?: () => void;
		platforms: PlatformOption[];
		onSelectPlatform: (id: Platform) => void;
		swatchCount: number;
		refKeys: DropZoneKey[];
		visibleKeysAll: DropZoneKey[];
		slots: Record<DropZoneKey, FileSlot>;
		fileInsights: Partial<Record<DropZoneKey, FileInsight>>;
		hasRefFiles: boolean;
		selectedOutputs: OutputCategory[];
		onToggleOutput: (cat: OutputCategory) => void;
		tokensInitialLoading: boolean;
		canGenerate: boolean;
		loading: boolean;
		progressStatus?: string | null;
		onGenerate: () => void;
		onOpenImportPanel: () => void;
		onOpenSettings: () => void;
		onWelcomeDragEnter: (key: DropZoneKey, e: DragEvent) => void;
		onWelcomeDragOver: (key: DropZoneKey, e: DragEvent) => void;
		onWelcomeDragLeave: (key: DropZoneKey) => void;
		onWelcomeDrop: (key: DropZoneKey, e: DragEvent) => void;
		onWelcomeFileInput: (key: DropZoneKey, e: Event) => void;
		onWelcomeClearFile: (key: DropZoneKey, e: MouseEvent) => void;
		requiredFilled: number;
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
		result, errorMsg = null, visibleFiles, activeTab, highlights, diffs, viewModes, modifications,
		renames, familyRenames, tokenCoverage, deprecations, impactedTokens,
		searchQuery, searchInputEl, searchShortcutHint, highlightedLines, wrapLines,
		showSectionNav, showChangeSummary, collapsedSections, currentBreadcrumb,
		codeScrollTop, codeScrollHeight, codeClientHeight, codeScrollEl,
		lastGeneratedAt, sendingPrs, diffTotals, diffNavIndex, swatches,
		showSwatches, swatchComparisons, swatchTab, prResults,
		platformMismatches, themes, selectedTheme, showThemePicker, selectedPlatforms,
		storedTokenVersion = null, storedTokenPushedAt = null,
		tokensUpdatedBanner = null, onRegenerate, onBackToHome,
		platforms, onSelectPlatform, swatchCount,
		refKeys, visibleKeysAll, slots, fileInsights, hasRefFiles,
		selectedOutputs, onToggleOutput,
		tokensInitialLoading, canGenerate, loading, progressStatus = null, onGenerate, onOpenImportPanel, onOpenSettings,
		onWelcomeDragEnter, onWelcomeDragOver, onWelcomeDragLeave, onWelcomeDrop,
		onWelcomeFileInput, onWelcomeClearFile, requiredFilled,
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
	{#if !result}
		<div class="welcome-wrapper">
		<WelcomeView
			{platforms}
			{selectedPlatforms}
			{onSelectPlatform}
			{swatchCount}
			{storedTokenVersion}
			storedTokenPushedAt={storedTokenPushedAt ?? null}
			{refKeys}
			visibleKeys={visibleKeysAll}
			{slots}
			{fileInsights}
			{hasRefFiles}
			{selectedOutputs}
			{onToggleOutput}
			{tokensInitialLoading}
			{canGenerate}
			{loading}
			{progressStatus}
			{errorMsg}
			{onGenerate}
			onDragEnter={onWelcomeDragEnter}
			onDragOver={onWelcomeDragOver}
			onDragLeave={onWelcomeDragLeave}
			onDrop={onWelcomeDrop}
			onFileInput={onWelcomeFileInput}
			onClearFile={onWelcomeClearFile}
			{requiredFilled}
		/>
		</div>
	{:else}
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
				{@const mode = getViewMode(file.filename)}
				{@const hasDiff = !!diffs[file.filename]}
				{@const sr = searchQuery ? buildSearchHighlight(file.content, searchQuery) : null}
				{@const depCount = deprecations[file.filename]?.length ?? 0}
				{@const modCountBanner = modifications[file.filename]?.length ?? 0}
				{@const fileRenames = renames[file.filename] ?? []}
				{@const fileFamilyRenames = familyRenames[file.filename] ?? []}
				{@const familyGrouped = new Set(fileFamilyRenames.flatMap(fr => fr.members.map(m => m.oldName)))}
				{@const individualRenames = fileRenames.filter(r => !familyGrouped.has(r.oldName))}
				{@const renameCount = fileFamilyRenames.length + individualRenames.length}
				{@const cov = tokenCoverage[file.filename]}
				{@const relevantImpacts = impactedTokens.length > 0 && diffs[file.filename] ? impactedTokens.filter(it => it.affectedSemantics.length > 0) : []}
				{@const totalInsights = depCount + modCountBanner + renameCount + (cov ? 1 : 0) + (relevantImpacts.length > 0 ? 1 : 0)}
				{@const sections = extractSections(file.content)}

				<div class="code-pane" role="tabpanel" tabindex="-1" onkeydown={onCodeKeydown}>
					<!-- Toolbar -->
					<div class="code-toolbar">
						<div class="toolbar-left">
							{#if hasDiff && !searchQuery}
								{@const ds = diffStats(diffs[file.filename], modifications[file.filename])}
								<div class="view-toggle" role="group" aria-label="View mode">
									<button class="toggle-btn" class:toggle-btn--active={mode === 'code'} onclick={() => onViewModeChange(file.filename, 'code')}>Code</button>
								<button class="toggle-btn" class:toggle-btn--active={mode === 'diff'} onclick={() => onViewModeChange(file.filename, 'diff')} title="Compare generated output against your reference file">
									vs Reference <span class="toggle-badge">+{ds.added} -{ds.removed}</span>
								</button>
									<button class="toggle-btn" class:toggle-btn--active={mode === 'changes'} onclick={() => onViewModeChange(file.filename, 'changes')}>Changes</button>
								</div>
								{#if mode === 'diff' || mode === 'changes'}
									{@const changeCount = diffs[file.filename] ? diffChangeIndices(diffs[file.filename]).length : 0}
									{#if changeCount > 0}
										<div class="diff-nav" role="navigation" aria-label="Diff navigation">
											<button class="diff-nav-btn" onclick={() => onNavigateDiff(file.filename, 'prev')} aria-label="Previous change"><ChevronUp size={12} strokeWidth={2} /></button>
											<span class="diff-nav-count">{(diffNavIndex[file.filename] ?? 0) + 1}/{changeCount}</span>
											<button class="diff-nav-btn" onclick={() => onNavigateDiff(file.filename, 'next')} aria-label="Next change"><ChevronDown size={12} strokeWidth={2} /></button>
										</div>
									{/if}
								{/if}
							{/if}
						</div>
						<div class="toolbar-right">
							{#if sections.length > 0}
								<div class="section-nav">
									<button
										class="ctrl-btn ctrl-btn--icon"
										onclick={onSectionNavToggle}
										aria-expanded={showSectionNav}
										title="Jump to section"
									>
										<List size={14} strokeWidth={1.75} />
									</button>
									{#if showSectionNav}
										<div class="section-menu" role="menu" aria-label="Jump to section">
											{#each sections as sec (sec.line)}
												<button class="section-option" role="menuitem" onclick={() => onScrollToLine(sec.line)}>
													<span class="section-line">L{sec.line}</span>
													{sec.label}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
							<div class="search-wrap">
								<input
									class="search-input"
									type="text"
									placeholder="Search ({searchShortcutHint})"
									value={searchQuery}
									oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
								/>
								{#if searchQuery}
									{#if sr}
										<span class="search-count" class:search-count--zero={sr.count === 0}>{sr.count} found</span>
									{/if}
									<button class="search-clear" onclick={() => onSearchChange('')}><X size={10} strokeWidth={2} /></button>
								{/if}
							</div>
							<div class="toolbar-divider"></div>
							<button class="ctrl-btn ctrl-btn--icon" onclick={onWrapToggle} title={wrapLines ? 'Disable line wrap' : 'Enable line wrap'} aria-pressed={wrapLines}>
								<WrapText size={12} strokeWidth={2} />
							</button>
						</div>
					</div>

					<!-- Change Summary Banner -->
					{#if totalInsights > 0 && !searchQuery && mode === 'code'}
						<div class="change-summary">
							<button class="change-summary-toggle" onclick={() => onChangeSummaryToggle(file.filename)}>
								<span class="cs-chevron" class:cs-chevron--open={showChangeSummary[file.filename]}><ChevronRight size={10} strokeWidth={2} /></span>
								<span class="cs-label">
									{#if depCount > 0}<span class="cs-tag cs-tag--warn"><AlertTriangle size={10} strokeWidth={2} /> {depCount} deprecated</span>{/if}
									{#if modCountBanner > 0}<span class="cs-tag cs-tag--info">{modCountBanner} modified</span>{/if}
									{#if renameCount > 0}<span class="cs-tag"><ArrowLeftRight size={10} strokeWidth={2} /> {renameCount} rename{renameCount > 1 ? 's' : ''}</span>{/if}
									{#if cov}<span class="cs-tag" class:cs-tag--ok={cov.coveragePercent >= 95} class:cs-tag--warn={cov.coveragePercent >= 80 && cov.coveragePercent < 95} class:cs-tag--danger={cov.coveragePercent < 80}><Target size={10} strokeWidth={2} /> {cov.coveragePercent.toFixed(0)}%</span>{/if}
								</span>
								{#if hasDiff}<span class="cs-diff-link" role="link" tabindex="0" onclick={(e) => { e.stopPropagation(); onViewModeChange(file.filename, 'diff'); }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onViewModeChange(file.filename, 'diff'); } }}>View diff <ArrowRight size={10} strokeWidth={2} /></span>{/if}
							</button>
							{#if showChangeSummary[file.filename]}
								<div class="cs-body">
									{#if depCount > 0}
										<div class="cs-row cs-row--warn">
											<span class="cs-row-icon"><AlertTriangle size={11} strokeWidth={2} /></span>
											<span class="cs-row-text">{deprecations[file.filename].slice(0, 5).join(', ')}{depCount > 5 ? ` … +${depCount - 5} more` : ''}</span>
										</div>
									{/if}
									{#if modCountBanner > 0}
										<div class="cs-row cs-row--info">
											<span class="cs-row-icon"><Pencil size={11} strokeWidth={2} /></span>
											<span class="cs-row-text">{modifications[file.filename].slice(0, 3).map(m => `${m.name}: ${m.oldValue} → ${m.newValue}`).join(', ')}{modCountBanner > 3 ? ` … +${modCountBanner - 3} more` : ''}</span>
										</div>
									{/if}
									{#if fileFamilyRenames.length > 0}
										<div class="cs-row">
											<span class="cs-row-icon"><ArrowLeftRight size={11} strokeWidth={2} /></span>
											<span class="cs-row-text">{fileFamilyRenames.slice(0, 2).map(fr => `${fr.oldPrefix}* → ${fr.newPrefix}* (${fr.members.length})`).join(', ')}</span>
										</div>
									{/if}
									{#if individualRenames.length > 0}
										<div class="cs-row">
											<span class="cs-row-icon"><ArrowLeftRight size={11} strokeWidth={2} /></span>
											<span class="cs-row-text">{individualRenames.slice(0, 3).map(r => `${r.oldName} → ${r.newName}`).join(', ')}{individualRenames.length > 3 ? ` … +${individualRenames.length - 3} more` : ''}</span>
										</div>
									{/if}
									{#if cov}
										<div class="cs-row" class:cs-row--ok={cov.coveragePercent >= 95} class:cs-row--warn={cov.coveragePercent >= 80 && cov.coveragePercent < 95} class:cs-row--danger={cov.coveragePercent < 80}>
											<span class="cs-row-icon"><Target size={11} strokeWidth={2} /></span>
											<span class="cs-row-text">Coverage: {cov.covered}/{cov.total} ({cov.coveragePercent.toFixed(1)}%){cov.orphaned.length ? ` · ${cov.orphaned.length} orphaned` : ''}{cov.unimplemented.length ? ` · ${cov.unimplemented.length} unimplemented` : ''}</span>
										</div>
									{/if}
									{#if relevantImpacts.length > 0}
										<div class="cs-row cs-row--info">
											<span class="cs-row-icon"><Target size={11} strokeWidth={2} /></span>
											<span class="cs-row-text">{relevantImpacts.slice(0, 3).map(it => `${it.primitiveName} ${it.changeType} → affects ${it.affectedSemantics.length} semantic token${it.affectedSemantics.length > 1 ? 's' : ''}`).join(' · ')}</span>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Breadcrumb -->
					{#if currentBreadcrumb && !searchQuery && mode === 'code'}
						<div class="code-breadcrumb">
							<span class="breadcrumb-file">{file.filename}</span>
							<span class="breadcrumb-sep">&rsaquo;</span>
							<span class="breadcrumb-section">{currentBreadcrumb}</span>
						</div>
					{/if}

					<!-- Code body + Minimap -->
					<div class="code-body-wrap">
						<div class="code-body-scroll" id="code-scroll-region" onscroll={onCodeScroll}>
							{#if searchQuery && sr}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								<pre class="code-pre code-pre--search">{@html sr.html}</pre>
							{:else if mode === 'diff' && hasDiff}
								{@const hunkStarts = computeHunkHeaders(diffs[file.filename])}
								<div class="diff-view">
									{#each diffs[file.filename] as line, li (li)}
										{#if hunkStarts.has(li)}
											{@const ctx = nearestContext(diffs[file.filename], li)}
											{#if ctx}
												<div class="diff-hunk-header">{ctx}</div>
											{/if}
										{/if}
										{@const oldNum = line.type === 'add' ? '' : (line.oldLineNum ?? '')}
										{@const newNum = line.type === 'remove' ? '' : (line.newLineNum ?? '')}
										{@const diffColor = extractDiffColor(line.text)}
										<div class="diff-line diff-line--{line.type}" id="diff-line-{file.filename}-{li}">
											<span class="diff-ln diff-ln--old">{oldNum}</span>
											<span class="diff-ln diff-ln--new">{newNum}</span>
											<span class="diff-sig">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
											{#if diffColor}
												<span class="diff-color-swatch" style="background:{diffColor}" aria-hidden="true"></span>
											{/if}
											<span class="diff-text">{#if line.spans}{#each line.spans as span, si (si)}<span class:diff-word--changed={span.changed}>{span.text}</span>{/each}{:else}{line.text}{/if}</span>
										</div>
									{/each}
								</div>
							{:else if mode === 'changes' && hasDiff}
								<div class="diff-view diff-view--filtered">
									{#each filterDiffLines(diffs[file.filename]) as item, fi (fi)}
										{#if 'text' in item}
											{@const changeColor = extractDiffColor(item.text)}
											<div class="diff-line diff-line--{item.type}">
												<span class="diff-sig">{item.type === 'add' ? '+' : item.type === 'remove' ? '-' : ' '}</span>
												{#if changeColor}
													<span class="diff-color-swatch" style="background:{changeColor}" aria-hidden="true"></span>
												{/if}
												<span class="diff-text">{#if item.spans}{#each item.spans as span, si (si)}<span class:diff-word--changed={span.changed}>{span.text}</span>{/each}{:else}{item.text}{/if}</span>
											</div>
										{:else}
											<div class="diff-separator">···</div>
										{/if}
									{/each}
								</div>
							{:else if highlights[file.filename]}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="shiki-wrap numbered"
									class:shiki-wrap--wrap={wrapLines}
									class:shiki-wrap--has-highlight={highlightedLines !== null}
									onclick={(e) => {
										const target = e.target as HTMLElement;
										const line = target.closest('.line') as HTMLElement | null;
										if (!line) return;
										const codeEl = line.closest('code');
										if (!codeEl) return;
										const allLines = Array.from(codeEl.querySelectorAll(':scope > .line'));
										const idx = allLines.indexOf(line);
										if (idx >= 0) onLineClick(idx + 1, e);
									}}
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html highlights[file.filename]}
								</div>
							{:else}
								<pre class="code-pre numbered" class:code-pre--wrap={wrapLines}><code>{file.content}</code></pre>
							{/if}
						</div>
					<CodeMinimap
						content={file.content}
						totalLines={file.content.split('\n').length}
						scrollTop={codeScrollTop}
						scrollHeight={codeScrollHeight}
						clientHeight={codeClientHeight}
						diffRegions={diffs[file.filename]?.filter(l => l.type !== 'equal').map(l => ({ line: l.newLineNum ?? l.oldLineNum ?? 0, type: l.type === 'add' ? 'add' as const : 'remove' as const })) ?? []}
						searchMatchLines={sr?.matchLines ?? []}
						onSeek={onSeekMinimap}
					/>
					</div>
				</div>
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
	{/if}
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
	.welcome-wrapper {
		display: flex;
		flex: 1;
		min-height: 0;
		animation: view-enter 300ms ease both;
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
		.welcome-wrapper,
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
		background: color-mix(in srgb, var(--bgColor-success-muted, #2ea04326) 40%, var(--bgColor-default));
		border-bottom: 1px solid var(--borderColor-success-muted, #2ea04340);
	}

	.success-banner-inner {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--base-text-size-xs);
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
		font-family: var(--fontStack-monospace);
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
		font-family: 'JetBrains Mono', var(--fontStack-monospace);
		border: 1px solid var(--borderColor-default);
		border-radius: 4px;
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		cursor: pointer;
		transition: background 0.1s;
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
		border-radius: 3px;
	}

	.success-dismiss:hover {
		color: var(--fgColor-default);
		background: var(--bgColor-muted);
	}

	/* ─── Swatch preview ─────────────────────────── */
	/* ─── File Tabs ──────────────────────────────── */
	/* ─── Tokens Updated Banner ─────────────────── */
	.tokens-updated-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px;
		background: var(--bgColor-attention-muted);
		border-bottom: 1px solid var(--borderColor-attention-muted);
		font-size: 12px;
		color: var(--fgColor-attention);
		animation: banner-slide-in 0.3s ease;
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
		border-radius: var(--borderRadius-medium);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--base-duration-100) var(--base-easing-ease);
	}

	.tokens-updated-btn:hover {
		opacity: 0.85;
	}

	@keyframes banner-slide-in {
		from { transform: translateY(-100%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	.file-tabs-bar {
		display: flex;
		align-items: center;
		background: var(--bgColor-inset);
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
		transition: color 100ms ease, background 100ms ease;
	}

	.home-btn:hover {
		color: var(--fgColor-accent);
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
		padding: 6px 14px;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-disabled);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			border-color var(--base-duration-100) var(--base-easing-ease);
	}

	.file-tab:hover {
		color: var(--fgColor-muted);
	}

	.file-tab--active {
		color: var(--fgColor-default);
		border-bottom-color: var(--tab-accent, var(--brand-color));
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
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		font-weight: 600;
		color: var(--fgColor-attention);
		background: var(--bgColor-attention-muted);
		border-radius: var(--borderRadius-full);
		line-height: 1;
	}

	.tab-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 8px;
		flex-shrink: 0;
	}

	/* ─── Code Pane ──────────────────────────────── */
	.code-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		animation: tab-crossfade 150ms ease both;
	}

	@keyframes tab-crossfade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.code-toolbar {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 4px 10px;
		background: var(--bgColor-inset);
		border-bottom: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
		z-index: 10;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.toolbar-divider {
		width: 1px;
		height: 16px;
		background: var(--borderColor-muted);
		flex-shrink: 0;
	}

	/* ─── View Toggle ────────────────────────────── */
	.view-toggle {
		display: flex;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 2px;
		gap: 2px;
	}

	.toggle-btn {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: 500;
		padding: 3px 8px;
		background: transparent;
		border: none;
		border-radius: calc(var(--borderRadius-medium) - 2px);
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition: background var(--base-duration-100) var(--base-easing-ease), color var(--base-duration-100) var(--base-easing-ease);
	}

	.toggle-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-default);
		box-shadow: var(--shadow-floating-small);
	}

	.toggle-badge {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		color: var(--fgColor-disabled);
		margin-left: 2px;
	}

	.toggle-btn--active .toggle-badge {
		color: var(--fgColor-muted);
	}

	/* ─── Diff Nav ───────────────────────────────── */
	.diff-nav {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.diff-nav-btn {
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-default);
		color: var(--fgColor-muted);
		font-size: 11px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}

	.diff-nav-btn:hover {
		color: var(--fgColor-default);
		background: var(--bgColor-muted);
	}

	.diff-nav-count {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-muted);
		min-width: 36px;
		text-align: center;
	}

	/* ─── Section Nav ────────────────────────────── */
	.section-nav { position: relative; }

	.section-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 50;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 4px;
		min-width: 220px;
		max-width: 360px;
		max-height: 280px;
		overflow-y: auto;
		box-shadow: var(--shadow-floating-small);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.section-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 9px;
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		text-align: left;
		width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background var(--base-duration-100) var(--base-easing-ease);
	}

	.section-option:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}

	.section-line {
		font-size: 9px;
		color: var(--fgColor-disabled);
		min-width: 32px;
		text-align: right;
		flex-shrink: 0;
	}

	/* ─── Search ─────────────────────────────────── */
	.search-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		max-width: 200px;
		position: relative;
	}

	.search-input {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		padding: 3px 8px;
		background: var(--control-bgColor-rest);
		border: 1px solid var(--control-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		color: var(--control-fgColor-rest);
		width: 100%;
		outline: none;
		transition: border-color var(--base-duration-200) var(--base-easing-ease);
	}

	.search-input:focus {
		border-color: var(--borderColor-accent-emphasis);
		color: var(--fgColor-default);
	}

	.search-count {
		font-size: var(--base-text-size-xs);
		font-weight: 500;
		color: var(--fgColor-success);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.search-count--zero {
		color: var(--fgColor-danger);
	}

	.search-clear {
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		font-size: 10px;
		padding: 2px 4px;
		flex-shrink: 0;
	}

	.search-clear:hover {
		color: var(--fgColor-muted);
	}

	/* ─── Change Summary ─────────────────────────── */
	.change-summary {
		border-bottom: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
	}

	.change-summary-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 5px 12px;
		background: color-mix(in srgb, var(--bgColor-muted) 50%, transparent);
		border: none;
		cursor: pointer;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-muted);
		text-align: left;
		transition: background var(--base-duration-100) var(--base-easing-ease);
	}

	.change-summary-toggle:hover {
		background: var(--bgColor-muted);
	}

	.cs-chevron {
		flex-shrink: 0;
		opacity: 0.5;
		transition: transform var(--base-duration-200) var(--base-easing-ease);
	}

	.cs-chevron--open {
		transform: rotate(90deg);
	}

	.cs-label {
		display: flex;
		align-items: center;
		gap: 5px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.cs-tag {
		display: inline-flex;
		align-items: center;
		padding: 1px 6px;
		border-radius: var(--borderRadius-full);
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		font-weight: 500;
		white-space: nowrap;
		color: var(--fgColor-muted);
		background: var(--bgColor-inset);
	}

	.cs-tag--warn { color: var(--fgColor-attention); background: color-mix(in srgb, var(--bgColor-attention-muted) 40%, transparent); }
	.cs-tag--info { color: var(--fgColor-accent); background: color-mix(in srgb, var(--bgColor-accent-muted) 30%, transparent); }
	.cs-tag--ok { color: var(--fgColor-success); background: color-mix(in srgb, var(--bgColor-success-muted) 30%, transparent); }
	.cs-tag--danger { color: var(--fgColor-danger); background: color-mix(in srgb, var(--bgColor-danger-muted) 30%, transparent); }

	.cs-diff-link {
		background: none;
		border: none;
		color: var(--fgColor-accent);
		font-family: var(--fontStack-sansSerif);
		font-size: 11px;
		cursor: pointer;
		padding: 0;
		white-space: nowrap;
		text-decoration: underline;
		text-underline-offset: 2px;
		flex-shrink: 0;
	}

	.cs-body {
		padding: 4px 0;
		background: color-mix(in srgb, var(--bgColor-muted) 30%, transparent);
	}

	.cs-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 3px 12px 3px 30px;
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		color: var(--fgColor-muted);
	}

	.cs-row--warn { color: var(--fgColor-attention); }
	.cs-row--info { color: var(--fgColor-accent); }
	.cs-row--ok { color: var(--fgColor-success); }
	.cs-row--danger { color: var(--fgColor-danger); }

	.cs-row-icon {
		flex-shrink: 0;
		width: 12px;
		text-align: center;
		font-weight: 600;
	}

	.cs-row-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ─── Breadcrumb ─────────────────────────────── */
	.code-breadcrumb {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 16px;
		font-family: var(--fontStack-monospace);
		font-size: 10.5px;
		color: var(--fgColor-muted);
		background: var(--bgColor-inset);
		border-bottom: 1px solid var(--borderColor-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-height: 22px;
		flex-shrink: 0;
	}

	.breadcrumb-file { color: var(--fgColor-disabled); }
	.breadcrumb-sep { color: var(--fgColor-disabled); font-size: 12px; }
	.breadcrumb-section { color: var(--fgColor-default); font-weight: 500; }

	/* ─── Code Body ──────────────────────────────── */
	.code-body-wrap {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.code-body-scroll {
		flex: 1;
		overflow: auto;
		min-height: 0;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--fgColor-disabled) 30%, transparent) transparent;
	}

	/* ─── Diff View ──────────────────────────────── */
	.diff-view {
		flex: 1;
		font-family: 'IBM Plex Mono', var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		font-weight: 300;
		line-height: 1.7;
		padding: 12px 0;
	}

	.diff-line {
		display: flex;
		gap: 10px;
		padding: 0 20px;
		min-height: 19px;
	}

	.diff-line--add { background: var(--bgColor-success-muted); }
	.diff-line--remove { background: var(--bgColor-danger-muted); }

	.diff-sig {
		width: 10px;
		flex-shrink: 0;
		font-weight: 600;
		user-select: none;
	}

	.diff-line--add .diff-sig { color: var(--fgColor-success); }
	.diff-line--remove .diff-sig { color: var(--fgColor-danger); }
	.diff-line--equal .diff-sig { color: var(--fgColor-disabled); }

	.diff-ln {
		display: inline-block;
		width: 3.5ch;
		text-align: right;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
		user-select: none;
		flex-shrink: 0;
		opacity: 0.6;
	}

	.diff-ln--old { padding-right: 4px; }
	.diff-ln--new { padding-right: 8px; border-right: 1px solid var(--borderColor-muted); margin-right: 8px; }

	.diff-text { white-space: pre; }
	.diff-line--add .diff-text { color: var(--fgColor-success); }
	.diff-line--remove .diff-text { color: var(--fgColor-danger); }
	.diff-line--equal .diff-text { color: var(--fgColor-disabled); }

	.diff-word--changed { border-radius: 2px; padding: 0 1px; }
	.diff-line--add .diff-word--changed { background: color-mix(in srgb, var(--bgColor-success-emphasis) 30%, transparent); }
	.diff-line--remove .diff-word--changed { background: color-mix(in srgb, var(--bgColor-danger-emphasis) 30%, transparent); }

	.diff-hunk-header {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 3px 20px;
		font-family: var(--fontStack-monospace);
		font-size: 10.5px;
		color: var(--fgColor-accent);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 40%, var(--bgColor-default));
		border-bottom: 1px solid var(--borderColor-accent-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.diff-separator {
		text-align: center;
		color: var(--fgColor-disabled);
		font-size: 11px;
		padding: 4px 0;
		background: var(--bgColor-inset);
		border-top: 1px dashed var(--borderColor-muted);
		border-bottom: 1px dashed var(--borderColor-muted);
		user-select: none;
	}

	.diff-color-swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.15);
		vertical-align: middle;
	}

	/* ─── Code Pre / Shiki ───────────────────────── */
	.code-pre {
		padding: 16px 24px;
		flex: 1;
		tab-size: 2;
	}

	.code-pre :global(code) {
		font-family: 'IBM Plex Mono', var(--fontStack-monospace);
		font-size: 12.5px;
		font-weight: 400;
		line-height: 1.8;
		color: var(--fgColor-muted);
		white-space: pre;
	}

	.code-pre--search {
		overflow: auto;
		padding: 16px 24px;
		flex: 1;
		font-family: 'IBM Plex Mono', var(--fontStack-monospace);
		font-size: 12.5px;
		font-weight: 400;
		line-height: 1.8;
		color: var(--fgColor-muted);
		white-space: pre;
		tab-size: 2;
	}

	.code-pre--wrap :global(code) {
		white-space: pre-wrap !important;
		word-break: break-all;
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
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		transition: border-color var(--base-duration-200) var(--base-easing-ease);
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
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 4px;
		min-width: 140px;
		box-shadow: var(--shadow-floating-small);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.theme-option {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 5px 9px;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background var(--base-duration-100) var(--base-easing-ease);
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
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: 500;
		color: var(--fgColor-muted);
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		padding: 3px 8px;
		cursor: pointer;
		white-space: nowrap;
		transition: color var(--base-duration-100) var(--base-easing-ease), background var(--base-duration-100) var(--base-easing-ease), border-color var(--base-duration-100) var(--base-easing-ease);
	}

	.ctrl-btn:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-emphasis);
		background: var(--control-bgColor-hover);
	}

	.ctrl-btn--icon { padding: 3px 5px; }

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
		.toolbar-right {
			gap: 4px;
		}

		.file-tab {
			max-width: 140px;
		}
	}

	/* ─── Responsive: small ──────────────────────── */
	@media (max-width: 767px) {
		.file-tab {
			max-width: 110px;
			padding: 6px 8px;
			font-size: 10px;
		}

		.code-toolbar {
			padding: 4px 8px;
			flex-wrap: wrap;
			gap: 4px;
		}

		.toolbar-left {
			flex-wrap: wrap;
		}

		.code-breadcrumb {
			padding: 3px 10px;
			font-size: 9.5px;
		}

		.diff-line {
			padding: 0 8px;
			gap: 6px;
		}

		.diff-ln {
			width: 3ch;
			font-size: 9px;
		}
	}
</style>
