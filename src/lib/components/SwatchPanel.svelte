<script lang="ts">
	import type { Swatch, SwatchComparison } from '$lib/swatch-utils.js';

	interface Props {
		swatches: Swatch[];
		comparisons: SwatchComparison[];
		tab: 'all' | 'changes';
		onTabChange: (tab: 'all' | 'changes') => void;
		onClose: () => void;
	}

	let { swatches, comparisons, tab, onTabChange, onClose }: Props = $props();

	const families = $derived([...new Set(swatches.map((s) => s.family))]);
</script>

<div class="swatch-panel">
	<div class="swatch-panel-header">
		<div class="swatch-tabs">
			<button
				class="swatch-tab"
				class:swatch-tab--active={tab === 'all'}
				onclick={() => onTabChange('all')}>All ({swatches.length})</button
			>
			{#if comparisons.length > 0}
				<button
					class="swatch-tab"
					class:swatch-tab--active={tab === 'changes'}
					onclick={() => onTabChange('changes')}>Changes ({comparisons.length})</button
				>
			{/if}
		</div>
		<button class="ctrl-btn" onclick={onClose} aria-label="Close color swatches panel"
			>✕ close</button
		>
	</div>
	{#if tab === 'all'}
		{#each families as family (family)}
			{@const group = swatches.filter((s) => s.family === family)}
			<div class="swatch-group">
				<span class="swatch-group-name">{family}</span>
				<div class="swatch-row">
					{#each group as swatch (swatch.name)}
						<div class="swatch-item" title="{swatch.name}\n{swatch.hex}">
							<div class="swatch-color" style="background: {swatch.hex}"></div>
							<span class="swatch-hex">{swatch.hex}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{:else}
		<div class="swatch-comparison-list">
			{#each comparisons as cmp (cmp.name + cmp.status)}
				<div class="swatch-cmp-row">
					<span class="swatch-cmp-name" title={cmp.name}>{cmp.name}</span>
					<div class="swatch-cmp-colors">
						{#if cmp.oldHex}
							<div
								class="swatch-cmp-chip"
								style="background: {cmp.oldHex}"
								title="Old: {cmp.oldHex}"
							></div>
						{:else}
							<div class="swatch-cmp-chip swatch-cmp-chip--empty" title="(none)"></div>
						{/if}
						<span class="swatch-cmp-arrow">→</span>
						{#if cmp.newHex}
							<div
								class="swatch-cmp-chip"
								style="background: {cmp.newHex}"
								title="New: {cmp.newHex}"
							></div>
						{:else}
							<div class="swatch-cmp-chip swatch-cmp-chip--empty" title="(removed)"></div>
						{/if}
					</div>
					<span class="swatch-cmp-badge swatch-cmp-badge--{cmp.status}">{cmp.status}</span>
				</div>
			{/each}
			{#if comparisons.length === 0}
				<p class="swatch-cmp-empty">No color changes detected.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.swatch-panel {
		border-top: 1px solid var(--borderColor-muted);
		padding: 16px 20px;
		background: var(--bgColor-inset);
		max-height: 380px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--borderColor-default) transparent;
	}
	.swatch-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		font-size: 10px;
		font-weight: var(--base-text-weight-medium);
		color: var(--fgColor-disabled);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.swatch-group {
		margin-bottom: 16px;
	}
	.swatch-group-name {
		display: block;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		text-transform: none;
		margin-bottom: 8px;
	}
	.swatch-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.swatch-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		cursor: default;
	}
	.swatch-color {
		width: 32px;
		height: 32px;
		border-radius: var(--borderRadius-medium);
		border: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}
	.swatch-hex {
		font-size: 9px;
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		max-width: 36px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}
	.swatch-tabs {
		display: flex;
		gap: 4px;
	}
	.swatch-tab {
		background: none;
		border: 1px solid var(--borderColor-default);
		color: var(--fgColor-muted);
		font-size: 10px;
		padding: 2px 8px;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: var(--base-text-weight-medium);
	}
	.swatch-tab--active {
		background: var(--bgColor-accent-muted);
		color: var(--fgColor-accent);
		border-color: var(--borderColor-accent-emphasis);
	}
	.swatch-comparison-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.swatch-cmp-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0;
	}
	.swatch-cmp-name {
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		color: var(--fgColor-default);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.swatch-cmp-colors {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}
	.swatch-cmp-chip {
		width: 24px;
		height: 24px;
		border-radius: var(--borderRadius-small);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.swatch-cmp-chip--empty {
		background: repeating-conic-gradient(var(--bgColor-inset) 0% 25%, transparent 0% 50%) 50% / 8px
			8px;
		border-style: dashed;
	}
	.swatch-cmp-arrow {
		font-size: 11px;
		color: var(--fgColor-muted);
	}
	.swatch-cmp-badge {
		font-size: 9px;
		font-weight: var(--base-text-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 1px 6px;
		border-radius: var(--borderRadius-small);
		flex-shrink: 0;
	}
	.swatch-cmp-badge--changed {
		color: var(--fgColor-attention);
		background: color-mix(in srgb, var(--bgColor-attention-muted) 50%, transparent);
	}
	.swatch-cmp-badge--new {
		color: var(--fgColor-success);
		background: color-mix(in srgb, var(--bgColor-success-muted) 50%, transparent);
	}
	.swatch-cmp-badge--removed {
		color: var(--fgColor-danger);
		background: color-mix(in srgb, var(--bgColor-danger-muted) 50%, transparent);
	}
	.swatch-cmp-empty {
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-muted);
		text-align: center;
		padding: 20px;
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
