<script lang="ts">
	import type { GenerateResponse, GenerationStats } from '$lib/types.js';

	interface DiffTotals {
		added: number;
		removed: number;
		modified: number;
	}

	interface Props {
		result: GenerateResponse;
		lastGeneratedAt: Date | null;
		sendingPrs: boolean;
		hasDiffs: boolean;
		diffTotals: DiffTotals;
		swatchCount: number;
		historyCount: number;
		showSwatches: boolean;
		showHistory: boolean;
		formatTime: (d: Date) => string;
		timeAgo: (d: Date) => string;
		onDownloadZip: () => void;
		onSendPRs: () => void;
		onCopyChangelog: () => void;
		onToggleSwatches: () => void;
		onToggleHistory: () => void;
	}

	let {
		result,
		lastGeneratedAt,
		sendingPrs,
		hasDiffs,
		diffTotals,
		swatchCount,
		historyCount,
		showSwatches,
		showHistory,
		formatTime,
		timeAgo,
		onDownloadZip,
		onSendPRs,
		onCopyChangelog,
		onToggleSwatches,
		onToggleHistory
	}: Props = $props();
</script>

<div class="output-header">
	<div class="output-header-top">
		<div class="panel-eyebrow panel-eyebrow--out">
			<span>OUTPUT</span>
			{#if lastGeneratedAt}
				<span class="generated-at" title="Generated at {formatTime(lastGeneratedAt)}">
					{timeAgo(lastGeneratedAt)}
				</span>
			{/if}
		</div>
		<div class="output-actions">
			<button
				class="ctrl-btn ctrl-btn--primary"
				onclick={onDownloadZip}
				aria-label="Download all files as ZIP"
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
					><path
						d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14zM7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06z"
					/></svg
				>
				ZIP
			</button>
			<button
				class="ctrl-btn"
				onclick={onSendPRs}
				disabled={sendingPrs}
				title="Send pull requests to team repos"
				aria-label="Send pull requests"
			>
				<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
					><path
						d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm0 9.5a.75.75 0 100 1.5.75.75 0 000-1.5zm9.5 0a.75.75 0 100 1.5.75.75 0 000-1.5z"
					/></svg
				>
				{sendingPrs ? '…' : 'PR'}
			</button>
			{#if hasDiffs}
				<button
					class="ctrl-btn"
					onclick={onCopyChangelog}
					aria-label="Copy changelog to clipboard"
					title="Copy changelog"
				>
					<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
						><path
							d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25zM5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25z"
						/></svg
					>
					Log
				</button>
			{/if}
			{#if swatchCount > 0}
				<button
					class="ctrl-btn"
					class:ctrl-btn--active={showSwatches}
					onclick={onToggleSwatches}
					title="Toggle color swatch preview">◈</button
				>
			{/if}
			{#if historyCount > 0}
				<button
					class="ctrl-btn"
					class:ctrl-btn--active={showHistory}
					onclick={onToggleHistory}
					title="View generation history"
				>
					<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
						><path
							d="M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.751.751 0 017 8.25v-3.5A.75.75 0 017.75 4z"
						/></svg
					>
					{historyCount}
				</button>
			{/if}
		</div>
	</div>
	{#if result.stats}
		{@const s = result.stats}
		<div class="output-stats-row">
			{#if s.primitiveColors > 0}
				<span class="stat-pill" title="Primitive color tokens"
					>{s.primitiveColors} primitives</span
				>
			{/if}
			{#if s.semanticColors > 0}
				<span class="stat-pill" title="Semantic color tokens"
					>{s.semanticColors} semantic</span
				>
			{/if}
			{#if s.spacingSteps > 0}
				<span class="stat-pill" title="Spacing tokens">{s.spacingSteps} spacing</span>
			{/if}
			{#if s.typographyStyles > 0}
				<span class="stat-pill stat-pill--typo" title="Typography text styles"
					>{s.typographyStyles} text styles</span
				>
			{/if}
			{#if s.shadowTokens > 0}
				<span class="stat-pill" title="Shadow effect tokens"
					>{s.shadowTokens} shadows</span
				>
			{/if}
			{#if s.borderTokens > 0}
				<span class="stat-pill" title="Border tokens"
					>{s.borderTokens} borders</span
				>
			{/if}
			{#if s.opacityTokens > 0}
				<span class="stat-pill" title="Opacity tokens"
					>{s.opacityTokens} opacity</span
				>
			{/if}
			<span class="stat-pill stat-pill--files">{result.files.length} files</span>
		</div>
		{#if hasDiffs && (diffTotals.added > 0 || diffTotals.removed > 0 || diffTotals.modified > 0)}
			<div class="output-diff-row">
				{#if diffTotals.added > 0}
					<span class="diff-pill diff-pill--add">+{diffTotals.added} new</span>
				{/if}
				{#if diffTotals.modified > 0}
					<span class="diff-pill diff-pill--mod">~{diffTotals.modified} modified</span>
				{/if}
				{#if diffTotals.removed > 0}
					<span class="diff-pill diff-pill--rm">-{diffTotals.removed} removed</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>
