<script lang="ts">
	import type { Platform, PrResult } from '$lib/types.js';

	interface Props {
		results: PrResult[];
		platformColor: (platform: Platform) => string;
		onRetry: (platform: string) => void;
		onDismiss: () => void;
	}

	let { results, platformColor, onRetry, onDismiss }: Props = $props();
</script>

{#if results.length > 0}
	<div class="pr-results">
		<div class="pr-results-header">
			<span>Pull Requests</span>
			<button class="ctrl-btn" onclick={onDismiss} aria-label="Dismiss pull request results"
				>✕</button
			>
		</div>
		{#each results as pr (pr.platform)}
			<div class="pr-result-row" class:pr-result-row--failed={pr.status === 'failed'}>
				<span
					class="pr-status-dot"
					class:pr-status-dot--ok={pr.status === 'success'}
					class:pr-status-dot--fail={pr.status === 'failed'}
				></span>
				<span class="pr-platform" style="color: {platformColor(pr.platform as Platform)}"
					>{pr.platform}</span
				>
				{#if pr.status === 'success' && pr.url}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external URL, not a SvelteKit route -->
					<a href={pr.url} target="_blank" rel="noopener noreferrer" class="pr-link">{pr.url}</a>
				{:else if pr.status === 'failed'}
					<span class="pr-error" title={pr.error}
						>{pr.error?.slice(0, 60)}{(pr.error?.length ?? 0) > 60 ? '…' : ''}</span
					>
					<button class="pr-retry-btn" onclick={() => onRetry(pr.platform)}>↻ retry</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.pr-results {
		background: var(--surface-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-md);
		padding: 14px 20px;
	}
	.pr-results-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		text-transform: none;
	}
	.pr-result-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 5px 0;
		border-radius: var(--radius-sm);
		border-left: 3px solid transparent;
	}
	.pr-result-row:has(.pr-status-dot--ok) {
		border-left-color: var(--fgColor-success);
	}
	.pr-result-row--failed {
		border-left-color: var(--fgColor-danger);
		opacity: 0.85;
	}
	.pr-platform {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		flex-shrink: 0;
		width: 50px;
	}
	.pr-link {
		font-size: 10px;
		color: var(--brand-color);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: 0.02em;
		transition: text-decoration var(--transition-fast);
	}
	.pr-link:hover {
		text-decoration: underline;
	}
	.pr-status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.pr-status-dot--ok {
		background: var(--bgColor-success-emphasis);
	}
	.pr-status-dot--fail {
		background: var(--bgColor-danger-emphasis);
	}
	.pr-error {
		font-size: 10px;
		color: var(--fgColor-danger);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-code);
	}
	.pr-retry-btn {
		font-family: var(--font-code);
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--fgColor-muted);
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-sm);
		padding: 3px 10px;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}
	.pr-retry-btn:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}

	.ctrl-btn {
		font-family: var(--font-code);
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--fgColor-muted);
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-sm);
		padding: 3px 10px;
		cursor: pointer;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
		white-space: nowrap;
	}
	.ctrl-btn:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}
</style>
