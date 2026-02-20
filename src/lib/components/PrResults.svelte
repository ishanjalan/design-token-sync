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
		border-top: 1px solid var(--borderColor-muted);
		background: var(--bgColor-inset);
		padding: 14px 20px;
	}
	.pr-results-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		text-transform: none;
	}
	.pr-result-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 5px 0;
	}
	.pr-platform {
		font-size: 9px;
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		flex-shrink: 0;
		width: 50px;
	}
	.pr-link {
		font-size: 10px;
		color: var(--fgColor-accent);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: 0.02em;
	}
	.pr-link:hover {
		text-decoration: underline;
	}
	.pr-result-row--failed {
		opacity: 0.85;
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
		font-family: var(--fontStack-monospace);
	}
	.pr-retry-btn {
		background: none;
		border: 1px solid var(--borderColor-default);
		color: var(--fgColor-accent);
		font-size: 10px;
		padding: 2px 8px;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		flex-shrink: 0;
		transition: background var(--base-duration-100) var(--base-easing-ease);
	}
	.pr-retry-btn:hover {
		background: var(--bgColor-accent-muted);
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
</style>
