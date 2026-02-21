<script lang="ts">
	import type { GeneratedFile } from '$lib/types.js';
	import type { DiffLine, DiffSummary, TokenModification } from '$lib/diff-utils.js';

	interface Props {
		files: GeneratedFile[];
		activeTab: string;
		diffs: Record<string, DiffLine[]>;
		modifications: Record<string, TokenModification[]>;
		diffStats: (lines: DiffLine[], mods?: TokenModification[]) => DiffSummary;
		onTabSelect: (filename: string) => void;
		onTabKeydown: (e: KeyboardEvent) => void;
	}

	let { files, activeTab, diffs, modifications, diffStats, onTabSelect, onTabKeydown }: Props =
		$props();

	function formatDotColor(format: string): string {
		switch (format) {
			case 'scss':
				return '#F06090';
			case 'swift':
				return '#FF8040';
			case 'kotlin':
				return '#B060FF';
			default:
				return '#4D9EFF';
		}
	}
</script>

<div
	class="file-sidebar"
	role="tablist"
	aria-label="Generated files"
	tabindex="0"
	onkeydown={onTabKeydown}
>
	{#each files as file (file.filename)}
		{@const hasDiff = !!diffs[file.filename]}
		{@const stats = hasDiff ? diffStats(diffs[file.filename]) : null}
		{@const modCount = modifications[file.filename]?.length ?? 0}
		{@const totalChanges = (stats?.added ?? 0) + (stats?.removed ?? 0) + modCount}
		<button
			class="sidebar-item"
			class:sidebar-item--active={activeTab === file.filename}
			role="tab"
			aria-selected={activeTab === file.filename}
			onclick={() => onTabSelect(file.filename)}
		>
			<span class="sidebar-name">
				<span class="sidebar-dot" style="background: {formatDotColor(file.format)}"></span>
				{file.filename}
			</span>
			<span class="sidebar-stats">
				<span class="sidebar-lines">{file.content.split('\n').length} lines</span>
				{#if totalChanges > 0}
					<span
						class="sidebar-change-dot"
						title="{stats?.added ?? 0} added, {stats?.removed ??
							0} removed, {modCount} modified"
					></span>
				{/if}
			</span>
		</button>
	{/each}
</div>
