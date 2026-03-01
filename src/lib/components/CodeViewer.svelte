<script lang="ts">
	import { List, WrapText, ChevronRight, ChevronUp, ChevronDown, AlertTriangle, ArrowLeftRight, Target, Pencil, ArrowRight, X } from 'lucide-svelte';
	import type { GeneratedFile } from '$lib/types.js';
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
	import { buildSearchHighlight, searchDiffLines } from '$lib/search-utils.js';
	import CodeMinimap from './CodeMinimap.svelte';

	interface Props {
		file: GeneratedFile;
		diffLines: DiffLine[] | null;
		viewMode: ViewMode;
		highlight: string | null;
		modifications: TokenModification[];
		renames: RenameEntry[];
		familyRenames: FamilyRename[];
		coverage: TokenCoverageResult | null;
		deprecations: string[];
		impacts: ImpactEntry[];
		searchQuery: string;
		searchShortcutHint: string;
		diffNavIndex: number;
		showChangeSummary: boolean;
		wrapLines: boolean;
		showSectionNav: boolean;
		currentBreadcrumb: string;
		highlightedLines: { start: number; end: number } | null;
		codeScrollTop: number;
		codeScrollHeight: number;
		codeClientHeight: number;
		onViewModeChange: (mode: ViewMode) => void;
		onNavigateDiff: (dir: 'prev' | 'next') => void;
		onChangeSummaryToggle: () => void;
		onScrollToLine: (line: number) => void;
		onSectionNavToggle: () => void;
		onWrapToggle: () => void;
		onSearchChange: (q: string) => void;
		onCodeKeydown: (e: KeyboardEvent) => void;
		onCodeScroll: (e: Event) => void;
		onLineClick: (lineNum: number, e: MouseEvent) => void;
		onSeekMinimap: (fraction: number) => void;
		extractSections: (content: string) => { label: string; line: number }[];
		extractDiffColor: (text: string) => string | null;
		computeHunkHeaders: (lines: DiffLine[]) => Set<number>;
		nearestContext: (lines: DiffLine[], idx: number) => string;
	}

	let {
		file, diffLines, viewMode, highlight, modifications, renames, familyRenames,
		coverage, deprecations, impacts, searchQuery, searchShortcutHint, diffNavIndex,
		showChangeSummary, wrapLines, showSectionNav, currentBreadcrumb,
		highlightedLines, codeScrollTop, codeScrollHeight, codeClientHeight,
		onViewModeChange, onNavigateDiff, onChangeSummaryToggle, onScrollToLine,
		onSectionNavToggle, onWrapToggle, onSearchChange, onCodeKeydown, onCodeScroll,
		onLineClick, onSeekMinimap,
		extractSections, extractDiffColor, computeHunkHeaders, nearestContext
	}: Props = $props();

	// ── Diff in-panel search ───────────────────────────────────────────────────
	let diffMatchIdx = $state(0);

	const activeDiffMatchIndices = $derived(
		searchQuery && diffLines && viewMode === 'diff'
			? searchDiffLines(diffLines, searchQuery)
			: []
	);

	$effect(() => {
		void searchQuery;
		diffMatchIdx = 0;
	});

	$effect(() => {
		if (!searchQuery || activeDiffMatchIndices.length === 0) return;
		const lineIdx = activeDiffMatchIndices[diffMatchIdx % activeDiffMatchIndices.length];
		if (lineIdx == null) return;
		const el = document.getElementById(`diff-line-${file.filename}-${lineIdx}`);
		if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	// ── Derived values ─────────────────────────────────────────────────────────
	const hasDiff = $derived(diffLines !== null);
	const sr = $derived(searchQuery ? buildSearchHighlight(file.content, searchQuery) : null);
	const depCount = $derived(deprecations.length);
	const modCountBanner = $derived(modifications.length);
	const familyGrouped = $derived(new Set(familyRenames.flatMap(fr => fr.members.map(m => m.oldName))));
	const individualRenames = $derived(renames.filter(r => !familyGrouped.has(r.oldName)));
	const renameCount = $derived(familyRenames.length + individualRenames.length);
	const relevantImpacts = $derived(impacts.length > 0 && hasDiff ? impacts.filter(it => it.affectedSemantics.length > 0) : []);
	const totalInsights = $derived(depCount + modCountBanner + renameCount + (coverage ? 1 : 0) + (relevantImpacts.length > 0 ? 1 : 0));
	const sections = $derived(extractSections(file.content));
</script>

<div class="code-pane" role="tabpanel" tabindex="-1" onkeydown={onCodeKeydown}>
	<!-- Toolbar -->
	<div class="code-toolbar">
		<div class="toolbar-left">
			{#if hasDiff && !searchQuery}
				{@const ds = diffStats(diffLines!, modifications)}
				<div class="view-toggle" role="group" aria-label="View mode">
					<button class="toggle-btn" class:toggle-btn--active={viewMode === 'code'} onclick={() => onViewModeChange('code')}>Code</button>
					<button class="toggle-btn" class:toggle-btn--active={viewMode === 'diff'} onclick={() => onViewModeChange('diff')} title="Compare generated output against your reference file">
						vs Reference <span class="toggle-badge">+{ds.added} -{ds.removed}</span>
					</button>
					<button class="toggle-btn" class:toggle-btn--active={viewMode === 'changes'} onclick={() => onViewModeChange('changes')}>Changes</button>
				</div>
				{#if viewMode === 'diff' || viewMode === 'changes'}
					{@const changeCount = diffLines ? diffChangeIndices(diffLines).length : 0}
					{#if changeCount > 0}
						<div class="diff-nav" role="navigation" aria-label="Diff navigation">
							<button class="diff-nav-btn" onclick={() => onNavigateDiff('prev')} aria-label="Previous change"><ChevronUp size={12} strokeWidth={2} /></button>
							<span class="diff-nav-count">{diffNavIndex + 1}/{changeCount}</span>
							<button class="diff-nav-btn" onclick={() => onNavigateDiff('next')} aria-label="Next change"><ChevronDown size={12} strokeWidth={2} /></button>
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
					onkeydown={(e) => {
						if (e.key === 'Enter' && activeDiffMatchIndices.length > 0) {
							e.preventDefault();
							diffMatchIdx = e.shiftKey
								? (diffMatchIdx - 1 + activeDiffMatchIndices.length) % activeDiffMatchIndices.length
								: (diffMatchIdx + 1) % activeDiffMatchIndices.length;
						} else if (e.key === 'Escape') {
							onSearchChange('');
						}
					}}
				/>
				{#if searchQuery}
					{#if activeDiffMatchIndices.length > 0}
						<span class="search-count">{diffMatchIdx % activeDiffMatchIndices.length + 1} / {activeDiffMatchIndices.length}</span>
					{:else if viewMode === 'diff' && diffLines}
						<span class="search-count search-count--zero">0 found</span>
					{:else if sr}
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
	{#if totalInsights > 0 && !searchQuery && viewMode === 'code'}
		<div class="change-summary">
			<button class="change-summary-toggle" onclick={onChangeSummaryToggle}>
				<span class="cs-chevron" class:cs-chevron--open={showChangeSummary}><ChevronRight size={10} strokeWidth={2} /></span>
				<span class="cs-label">
					{#if depCount > 0}<span class="cs-tag cs-tag--warn"><AlertTriangle size={10} strokeWidth={2} /> {depCount} deprecated</span>{/if}
					{#if modCountBanner > 0}<span class="cs-tag cs-tag--info">{modCountBanner} modified</span>{/if}
					{#if renameCount > 0}<span class="cs-tag"><ArrowLeftRight size={10} strokeWidth={2} /> {renameCount} rename{renameCount > 1 ? 's' : ''}</span>{/if}
					{#if coverage}<span class="cs-tag" class:cs-tag--ok={coverage.coveragePercent >= 95} class:cs-tag--warn={coverage.coveragePercent >= 80 && coverage.coveragePercent < 95} class:cs-tag--danger={coverage.coveragePercent < 80}><Target size={10} strokeWidth={2} /> {coverage.coveragePercent.toFixed(0)}%</span>{/if}
				</span>
				{#if hasDiff}<span class="cs-diff-link" role="link" tabindex="0" onclick={(e) => { e.stopPropagation(); onViewModeChange('diff'); }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onViewModeChange('diff'); } }}>View diff <ArrowRight size={10} strokeWidth={2} /></span>{/if}
			</button>
			{#if showChangeSummary}
				<div class="cs-body">
					{#if depCount > 0}
						<div class="cs-row cs-row--warn">
							<span class="cs-row-icon"><AlertTriangle size={11} strokeWidth={2} /></span>
							<span class="cs-row-text">{deprecations.slice(0, 5).join(', ')}{depCount > 5 ? ` … +${depCount - 5} more` : ''}</span>
						</div>
					{/if}
					{#if modCountBanner > 0}
						<div class="cs-row cs-row--info">
							<span class="cs-row-icon"><Pencil size={11} strokeWidth={2} /></span>
							<span class="cs-row-text">{modifications.slice(0, 3).map(m => `${m.name}: ${m.oldValue} → ${m.newValue}`).join(', ')}{modCountBanner > 3 ? ` … +${modCountBanner - 3} more` : ''}</span>
						</div>
					{/if}
					{#if familyRenames.length > 0}
						<div class="cs-row">
							<span class="cs-row-icon"><ArrowLeftRight size={11} strokeWidth={2} /></span>
							<span class="cs-row-text">{familyRenames.slice(0, 2).map(fr => `${fr.oldPrefix}* → ${fr.newPrefix}* (${fr.members.length})`).join(', ')}</span>
						</div>
					{/if}
					{#if individualRenames.length > 0}
						<div class="cs-row">
							<span class="cs-row-icon"><ArrowLeftRight size={11} strokeWidth={2} /></span>
							<span class="cs-row-text">{individualRenames.slice(0, 3).map(r => `${r.oldName} → ${r.newName}`).join(', ')}{individualRenames.length > 3 ? ` … +${individualRenames.length - 3} more` : ''}</span>
						</div>
					{/if}
					{#if coverage}
						<div class="cs-row" class:cs-row--ok={coverage.coveragePercent >= 95} class:cs-row--warn={coverage.coveragePercent >= 80 && coverage.coveragePercent < 95} class:cs-row--danger={coverage.coveragePercent < 80}>
							<span class="cs-row-icon"><Target size={11} strokeWidth={2} /></span>
							<span class="cs-row-text">Coverage: {coverage.covered}/{coverage.total} ({coverage.coveragePercent.toFixed(1)}%){coverage.orphaned.length ? ` · ${coverage.orphaned.length} orphaned` : ''}{coverage.unimplemented.length ? ` · ${coverage.unimplemented.length} unimplemented` : ''}</span>
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
	{#if currentBreadcrumb && !searchQuery && viewMode === 'code'}
		<div class="code-breadcrumb">
			<span class="breadcrumb-file">{file.filename}</span>
			<span class="breadcrumb-sep">&rsaquo;</span>
			<span class="breadcrumb-section">{currentBreadcrumb}</span>
		</div>
	{/if}

	<!-- Code body + Minimap -->
	<div class="code-body-wrap">
		<div class="code-body-scroll" id="code-scroll-region" onscroll={onCodeScroll}>
			{#if searchQuery && sr && !(viewMode === 'diff' && hasDiff)}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<pre class="code-pre code-pre--search">{@html sr.html}</pre>
			{:else if viewMode === 'diff' && hasDiff}
				{@const hunkStarts = computeHunkHeaders(diffLines!)}
				<div class="diff-view">
					{#each diffLines! as line, li (li)}
						{#if hunkStarts.has(li)}
							{@const ctx = nearestContext(diffLines!, li)}
							{#if ctx}
								<div class="diff-hunk-header">{ctx}</div>
							{/if}
						{/if}
						{@const oldNum = line.type === 'add' ? '' : (line.oldLineNum ?? '')}
						{@const newNum = line.type === 'remove' ? '' : (line.newLineNum ?? '')}
						{@const diffColor = extractDiffColor(line.text)}
						{@const isSearchMatch = searchQuery ? activeDiffMatchIndices.includes(li) : false}
						{@const isCurrentMatch = searchQuery && li === activeDiffMatchIndices[diffMatchIdx % Math.max(1, activeDiffMatchIndices.length)]}
						<div class="diff-line diff-line--{line.type}"
							class:diff-line--search-match={isSearchMatch}
							class:diff-line--search-current={isCurrentMatch}
							id="diff-line-{file.filename}-{li}">
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
			{:else if viewMode === 'changes' && hasDiff}
				<div class="diff-view diff-view--filtered">
					{#each filterDiffLines(diffLines!) as item, fi (fi)}
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
			{:else if highlight}
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
					{@html highlight}
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
			diffRegions={diffLines?.filter(l => l.type !== 'equal').map(l => ({ line: l.newLineNum ?? l.oldLineNum ?? 0, type: l.type === 'add' ? 'add' as const : 'remove' as const })) ?? []}
			searchMatchLines={sr?.matchLines ?? []}
			onSeek={onSeekMinimap}
		/>
	</div>
</div>

<style>
	/* ─── Code Pane ──────────────────────────────── */
	.code-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		animation: tab-crossfade var(--transition-fast) ease both;
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
		background: var(--bgColor-muted);
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
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-md);
		padding: 2px;
		gap: 2px;
	}

	.toggle-btn {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		padding: 3px 8px;
		background: transparent;
		border: none;
		border-radius: calc(var(--radius-md) - 2px);
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.toggle-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-default);
		box-shadow: var(--shadow-button);
	}

	.toggle-badge {
		font-family: var(--font-code);
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
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: color var(--transition-fast);
	}

	.diff-nav-btn:hover {
		color: var(--fgColor-default);
		background: var(--bgColor-muted);
	}

	.diff-nav-count {
		font-family: var(--font-code);
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
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-md);
		padding: 4px;
		min-width: 220px;
		max-width: 360px;
		max-height: 280px;
		overflow-y: auto;
		box-shadow: var(--shadow-panel);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.section-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 9px;
		font-family: var(--font-code);
		font-size: 11px;
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background var(--transition-fast);
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
		font-family: var(--font-display);
		font-size: 12px;
		padding: 3px 8px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-sm);
		color: var(--fgColor-default);
		width: 100%;
		outline: none;
		transition: border-color var(--transition-default), box-shadow var(--transition-default);
	}

	.search-input:focus {
		border-color: var(--fgColor-accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--fgColor-accent) 15%, transparent);
	}

	.search-count {
		font-family: var(--font-display);
		font-size: 12px;
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
		transition: color var(--transition-fast);
	}

	.search-clear:hover {
		color: var(--fgColor-muted);
	}

	/* ─── Ctrl Button (for wrap/section icons) ───── */
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

	.ctrl-btn--icon { padding: 3px 5px; }

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
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-muted);
		text-align: left;
		transition: background var(--transition-fast);
	}

	.change-summary-toggle:hover {
		background: var(--bgColor-muted);
	}

	.cs-chevron {
		flex-shrink: 0;
		opacity: 0.5;
		transition: transform var(--transition-default);
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
		border-radius: 100px;
		font-family: var(--font-code);
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
		font-family: var(--font-display);
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
		font-family: var(--font-code);
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
		font-family: var(--font-display);
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
		box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.1);
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--fgColor-disabled) 30%, transparent) transparent;
	}

	/* ─── Diff View ──────────────────────────────── */
	.diff-view {
		flex: 1;
		font-family: var(--font-code);
		font-size: 12px;
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
		font-family: var(--font-code);
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

	.diff-line--search-match {
		outline: 1px solid color-mix(in srgb, var(--fgColor-attention, #9a6700) 40%, transparent);
		outline-offset: -1px;
	}
	.diff-line--search-current {
		background: color-mix(in srgb, var(--bgColor-attention-muted, #fff3b0) 55%, transparent) !important;
		outline: 1px solid var(--fgColor-attention, #9a6700);
		outline-offset: -1px;
	}

	.diff-hunk-header {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 3px 20px;
		font-family: var(--font-code);
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
		font-family: var(--font-code);
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
		font-family: var(--font-code);
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

	/* ─── Responsive ─────────────────────────────── */
	@media (max-width: 1199px) {
		.toolbar-right {
			gap: 4px;
		}
	}

	@media (max-width: 767px) {
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
