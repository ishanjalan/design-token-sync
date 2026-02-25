<script lang="ts">
	import type { PlatformMismatch } from '$lib/diff-utils.js';

	interface Props {
		mismatches: PlatformMismatch[];
	}

	let { mismatches }: Props = $props();
</script>

{#if mismatches.length > 0}
	<div class="platform-consistency-panel">
		<div class="platform-consistency-header">
			<span class="platform-consistency-title">Platform Consistency</span>
			<span
				class="platform-consistency-count"
				class:platform-consistency-count--ok={mismatches.length === 0}
			>
				{mismatches.length} mismatch{mismatches.length !== 1 ? 'es' : ''}
			</span>
		</div>
		<div class="platform-consistency-list">
			{#each mismatches.slice(0, 20) as mm (mm.tokenName)}
				<div class="platform-consistency-row">
					<span class="platform-consistency-name">{mm.tokenName}</span>
					<div class="platform-consistency-values">
						{#each mm.values as v (v.platform)}
							<span class="platform-consistency-chip">
								<span class="platform-consistency-swatch" style="background:{v.normalizedHex}"
								></span>
								{v.platform}: {v.rawValue}
							</span>
						{/each}
					</div>
				</div>
			{/each}
			{#if mismatches.length > 20}
				<div class="platform-consistency-more">… +{mismatches.length - 20} more</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.platform-consistency-panel {
		background: var(--surface-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-md);
		margin: 12px 0;
		overflow: hidden;
	}
	.platform-consistency-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bgColor-muted);
		border-bottom: 1px solid var(--borderColor-default);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
	}
	.platform-consistency-count {
		font-size: 11px;
		padding: 1px 8px;
		border-radius: 100px;
		background: color-mix(in srgb, var(--bgColor-attention-muted) 50%, transparent);
		color: var(--fgColor-attention);
	}
	.platform-consistency-count--ok {
		color: var(--fgColor-success);
		background: color-mix(in srgb, var(--bgColor-success-muted) 50%, transparent);
	}
	.platform-consistency-list {
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.platform-consistency-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		font-family: var(--font-code);
		padding: 4px 0;
	}
	.platform-consistency-row:nth-child(even) {
		background: var(--surface-glass);
		margin: 0 -12px;
		padding: 4px 12px;
	}
	.platform-consistency-name {
		flex-shrink: 0;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--fgColor-muted);
		min-width: 120px;
	}
	.platform-consistency-values {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.platform-consistency-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		background: var(--bgColor-inset);
		border-radius: var(--radius-sm);
		font-family: var(--font-code);
	}
	.platform-consistency-swatch {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
	}
	.platform-consistency-more {
		font-size: 11px;
		color: var(--fgColor-muted);
		text-align: center;
	}
</style>
