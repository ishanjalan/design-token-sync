<script lang="ts">
	import type { GeneratedFile } from '$lib/types.js';
	import { type DiffLine, type TokenModification, diffStats } from '$lib/diff-utils.js';

	interface Props {
		files: GeneratedFile[];
		activeTab: string;
		diffs: Record<string, DiffLine[]>;
		modifications: Record<string, TokenModification[]>;
		onTabSelect: (filename: string) => void;
		onTabKeydown: (e: KeyboardEvent) => void;
	}

	let { files, activeTab, diffs, modifications, onTabSelect, onTabKeydown }: Props = $props();

	function formatDotColor(format: string): string {
		switch (format) {
			case 'css': return '#2196F3';
			case 'scss': return '#F06090';
			case 'typescript': return '#3178C6';
			case 'swift': return '#FF8040';
			case 'kotlin': return '#B060FF';
			default: return '#4D9EFF';
		}
	}
</script>

<div class="explorer" role="tablist" aria-label="Generated files" aria-orientation="vertical">
	<div class="explorer-eyebrow">
		<span>FILES</span>
		<span class="explorer-count">{files.length}</span>
	</div>

	{#each files as file, idx (file.filename)}
		{@const hasDiff = !!diffs[file.filename]}
		{@const ds = hasDiff ? diffStats(diffs[file.filename], modifications[file.filename]) : null}
		<button
			class="explorer-item"
			class:explorer-item--active={activeTab === file.filename}
			role="tab"
			aria-selected={activeTab === file.filename}
			onclick={() => onTabSelect(file.filename)}
			onkeydown={onTabKeydown}
			style="animation-delay: {idx * 30}ms"
		>
			<span class="explorer-dot" style="background: {formatDotColor(file.format)}"></span>
			<span class="explorer-name">{file.filename}</span>
			<span class="explorer-stats">
				{#if hasDiff && ds}
					<span class="explorer-change-dot" title="Has changes"></span>
				{/if}
				<span class="explorer-lines">{file.content.split('\n').length}L</span>
			</span>
		</button>
	{/each}
</div>

<style>
	.explorer {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--fgColor-disabled) 30%, transparent) transparent;
	}

	.explorer-eyebrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px 8px;
		font-family: 'JetBrains Mono', var(--fontStack-monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--fgColor-disabled);
		text-transform: uppercase;
	}

	.explorer-count {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		color: var(--fgColor-disabled);
		background: var(--bgColor-neutral-muted);
		padding: 1px 6px;
		border-radius: var(--borderRadius-full);
	}

	.explorer-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 14px;
		background: none;
		border: none;
		border-left: 2px solid transparent;
		border-bottom: 1px solid var(--borderColor-muted);
		font-family: var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		text-align: left;
		cursor: pointer;
		color: var(--fgColor-disabled);
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			border-color var(--base-duration-100) var(--base-easing-ease),
			color var(--base-duration-100) var(--base-easing-ease);
		animation: file-reveal 0.3s ease both;
	}

	.explorer-item:last-child {
		border-bottom: none;
	}

	.explorer-item:hover {
		background: var(--bgColor-muted);
		color: var(--fgColor-muted);
	}

	.explorer-item--active {
		background: var(--bgColor-muted);
		border-left-color: var(--brand-color);
		color: var(--fgColor-default);
	}

	@keyframes file-reveal {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.explorer-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		opacity: 0.5;
		transition: opacity var(--base-duration-200) var(--base-easing-ease);
	}

	.explorer-item--active .explorer-dot {
		opacity: 1;
	}

	.explorer-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
		letter-spacing: 0;
	}

	.explorer-stats {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
	}

	.explorer-change-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fgColor-attention);
	}

	.explorer-lines {
		font-size: 9px;
		color: var(--fgColor-disabled);
		white-space: nowrap;
	}

	/* ─── Responsive: small ──────────────────────── */
	@media (max-width: 767px) {
		.explorer-item {
			padding: 8px 14px;
		}
	}
</style>
