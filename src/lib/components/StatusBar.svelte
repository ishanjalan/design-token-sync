<script lang="ts">
	import type { GeneratedFile } from '$lib/types.js';
	import { type DiffLine, type TokenModification, diffStats } from '$lib/diff-utils.js';

	interface Props {
		activeFile: GeneratedFile | undefined;
		diffs: Record<string, DiffLine[]>;
		modifications: Record<string, TokenModification[]>;
		diffTotals: { added: number; removed: number; modified: number };
		lastGeneratedAt: Date | null;
		langLabel: (format: string) => string;
		formatFileSize: (bytes: number) => string;
		timeAgo: (d: Date) => string;
	}

	let { activeFile, diffs, modifications, diffTotals, lastGeneratedAt, langLabel, formatFileSize, timeAgo }: Props = $props();
</script>

<div class="status-bar">
	{#if activeFile}
		<span class="status-item">{langLabel(activeFile.format)}</span>
		<span class="status-sep">|</span>
		<span class="status-item">{activeFile.content.split('\n').length} lines</span>
		<span class="status-sep">|</span>
		<span class="status-item">{formatFileSize(new Blob([activeFile.content]).size)}</span>

		{#if diffs[activeFile.filename]}
			{@const ds = diffStats(diffs[activeFile.filename], modifications[activeFile.filename])}
			<span class="status-sep">|</span>
			<span class="status-item status-item--add">+{ds.added}</span>
			<span class="status-item status-item--rm">-{ds.removed}</span>
			{#if ds.modified > 0}
				<span class="status-item status-item--mod">~{ds.modified}</span>
			{/if}
		{/if}
	{/if}

	<span class="status-spacer"></span>

	{#if diffTotals.added > 0 || diffTotals.removed > 0}
		<span class="status-item status-item--add">+{diffTotals.added}</span>
		<span class="status-item status-item--rm">-{diffTotals.removed}</span>
		{#if diffTotals.modified > 0}
			<span class="status-item status-item--mod">~{diffTotals.modified}</span>
		{/if}
		<span class="status-sep">|</span>
	{/if}

	{#if lastGeneratedAt}
		<span class="status-item">{timeAgo(lastGeneratedAt)}</span>
	{/if}
</div>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
		white-space: nowrap;
		overflow: hidden;
	}

	.status-item {
		letter-spacing: 0.02em;
	}

	.status-sep {
		color: var(--borderColor-muted);
	}

	.status-spacer {
		flex: 1;
	}

	.status-item--add { color: var(--fgColor-success); }
	.status-item--rm { color: var(--fgColor-danger); }
	.status-item--mod { color: var(--fgColor-attention); }

	@media (max-width: 767px) {
		.status-bar {
			justify-content: center;
			gap: 6px;
			font-size: 9px;
		}

		.status-spacer {
			display: none;
		}
	}
</style>
