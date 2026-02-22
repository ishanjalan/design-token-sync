<script lang="ts">
	import { Download, GitPullRequest, ClipboardCopy, History } from 'lucide-svelte';
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
				<Download size={14} strokeWidth={2} />
				ZIP
			</button>
			<button
				class="ctrl-btn"
				onclick={onSendPRs}
				disabled={sendingPrs}
				title="Send pull requests to team repos"
				aria-label="Send pull requests"
			>
				<GitPullRequest size={13} strokeWidth={2} />
				{sendingPrs ? '…' : 'PR'}
			</button>
			{#if hasDiffs}
				<button
					class="ctrl-btn"
					onclick={onCopyChangelog}
					aria-label="Copy changelog to clipboard"
					title="Copy changelog"
				>
					<ClipboardCopy size={13} strokeWidth={2} />
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
					<History size={13} strokeWidth={2} />
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
