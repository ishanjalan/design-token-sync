<script lang="ts">
	import type { HistoryEntry, Platform } from '$lib/types.js';

	interface Props {
		history: HistoryEntry[];
		platformColor: (platform: Platform) => string;
		onRestore: (entry: HistoryEntry) => void;
		onClose: () => void;
	}

	let { history, platformColor, onRestore, onClose }: Props = $props();

	function formatHistoryDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="history-panel">
	<div class="history-header">
		<span>Generation history</span>
		<button class="ctrl-btn" onclick={onClose} aria-label="Close history panel">✕ close</button>
	</div>
	{#if history.length === 0}
		<p class="history-empty">No history yet.</p>
	{:else}
		{#each history as entry (entry.id)}
			<div class="history-entry">
				<div class="history-entry-meta">
					<span class="history-date">{formatHistoryDate(entry.generatedAt)}</span>
					<div class="history-platforms">
						{#each entry.platforms as p (p)}
							<span class="history-platform" style="color: {platformColor(p)}">{p}</span>
						{/each}
					</div>
				</div>
				<div class="history-stats">
					{#if entry.stats.primitiveColors > 0}<span class="stat-pill"
							>{entry.stats.primitiveColors} prim</span
						>{/if}
					{#if entry.stats.semanticColors > 0}<span class="stat-pill"
							>{entry.stats.semanticColors} sem</span
						>{/if}
					{#if entry.stats.spacingSteps > 0}<span class="stat-pill"
							>{entry.stats.spacingSteps} space</span
						>{/if}
					{#if entry.stats.typographyStyles > 0}<span class="stat-pill stat-pill--typo"
							>{entry.stats.typographyStyles} typo</span
						>{/if}
					<span class="history-files">{entry.files.length} files</span>
				</div>
				<button class="ctrl-btn history-restore" onclick={() => onRestore(entry)}>restore</button>
			</div>
		{/each}
	{/if}
</div>

<style>
	.history-panel {
		border-top: 1px solid var(--borderColor-muted);
		background: var(--bgColor-inset);
		padding: 16px 20px;
		max-height: 320px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--borderColor-default) transparent;
	}
	.history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		text-transform: none;
	}
	.history-empty {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		font-weight: var(--base-text-weight-normal);
	}
	.history-entry {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 0;
		border-bottom: 1px solid var(--borderColor-muted);
	}
	.history-entry:last-child {
		border-bottom: none;
	}
	.history-entry-meta {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.history-date {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		white-space: nowrap;
	}
	.history-platforms {
		display: flex;
		gap: 6px;
	}
	.history-platform {
		font-size: 9px;
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.history-stats {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		flex: 1;
		align-items: center;
	}
	.history-files {
		font-size: 10px;
		color: var(--fgColor-disabled);
		white-space: nowrap;
	}
	.history-restore {
		flex-shrink: 0;
	}

	.ctrl-btn {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--fgColor-muted);
		background: none;
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-small);
		padding: 3px 10px;
		cursor: pointer;
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			color var(--base-duration-100) var(--base-easing-ease);
		white-space: nowrap;
	}
	.ctrl-btn:hover {
		background: var(--bgColor-neutral-muted);
		color: var(--fgColor-default);
	}

	.stat-pill {
		display: inline-flex;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 10px;
		color: var(--fgColor-muted);
		background: var(--bgColor-neutral-muted);
		padding: 1px 8px;
		border-radius: 10px;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.stat-pill--typo {
		color: #c084fc;
		background: color-mix(in srgb, #c084fc 12%, transparent);
	}
</style>
