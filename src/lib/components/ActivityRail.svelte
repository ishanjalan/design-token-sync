<script lang="ts">
	import { Upload, Files, History, Settings } from 'lucide-svelte';

	type PanelId = 'import' | 'files' | 'history' | 'settings';

	interface Props {
		active: PanelId | null;
		hasOutput: boolean;
		historyCount: number;
		onSelect: (id: PanelId) => void;
	}

	let { active, hasOutput, historyCount, onSelect }: Props = $props();

	const ITEMS: { id: PanelId; label: string; icon: string; needsOutput?: boolean }[] = [
		{ id: 'import', label: 'Import', icon: 'upload' },
		{ id: 'files', label: 'Files', icon: 'files', needsOutput: true },
		{ id: 'history', label: 'History', icon: 'history' },
		{ id: 'settings', label: 'Settings', icon: 'settings' }
	];
</script>

<nav class="rail" aria-label="Activity bar">
	{#each ITEMS as item (item.id)}
		{@const visible = !item.needsOutput || hasOutput}
		{#if visible}
			<button
				class="rail-btn"
				class:rail-btn--active={active === item.id}
				onclick={() => onSelect(item.id)}
				title={item.label}
				aria-label={item.label}
				aria-pressed={active === item.id}
			>
				<span class="rail-accent" class:rail-accent--visible={active === item.id}></span>
				{#if item.icon === 'upload'}
					<Upload size={18} strokeWidth={1.75} />
				{:else if item.icon === 'files'}
					<Files size={18} strokeWidth={1.75} />
				{:else if item.icon === 'history'}
					<History size={18} strokeWidth={1.75} />
					{#if historyCount > 0}
						<span class="rail-badge">{historyCount > 9 ? '9+' : historyCount}</span>
					{/if}
				{:else if item.icon === 'settings'}
					<Settings size={18} strokeWidth={1.75} />
				{/if}
			</button>
		{/if}
	{/each}
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 100%;
	}

	.rail-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		cursor: pointer;
		border-radius: var(--borderRadius-medium);
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			background var(--base-duration-100) var(--base-easing-ease);
	}

	.rail-btn:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.rail-btn--active {
		color: var(--fgColor-default);
	}

	.rail-accent {
		position: absolute;
		left: -4px;
		top: 50%;
		transform: translateY(-50%);
		width: 2px;
		height: 0;
		background: var(--borderColor-accent-emphasis);
		border-radius: 1px;
		transition: height var(--base-duration-200) var(--base-easing-ease);
	}

	.rail-accent--visible {
		height: 18px;
	}

	.rail-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		font-weight: 600;
		color: var(--fgColor-onEmphasis);
		background: var(--bgColor-accent-emphasis);
		border-radius: var(--borderRadius-full);
		padding: 0 3px;
		line-height: 1;
	}
</style>
