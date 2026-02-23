<script lang="ts">
	import { Upload, Files, History, Settings, HelpCircle } from 'lucide-svelte';

	type PanelId = 'import' | 'files' | 'history' | 'settings' | 'help';

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
		{ id: 'settings', label: 'Settings', icon: 'settings' },
		{ id: 'help', label: 'Help', icon: 'help' }
	];
</script>

<nav class="bottom-tabs" aria-label="Navigation">
	{#each ITEMS as item (item.id)}
		{@const visible = !item.needsOutput || hasOutput}
		{#if visible}
			<button
				class="tab-btn"
				class:tab-btn--active={active === item.id}
				onclick={() => onSelect(item.id)}
				aria-label={item.label}
				aria-pressed={active === item.id}
			>
				<span class="tab-icon">
					{#if item.icon === 'upload'}
						<Upload size={18} strokeWidth={1.75} />
					{:else if item.icon === 'files'}
						<Files size={18} strokeWidth={1.75} />
					{:else if item.icon === 'history'}
						<History size={18} strokeWidth={1.75} />
					{:else if item.icon === 'settings'}
						<Settings size={18} strokeWidth={1.75} />
					{:else if item.icon === 'help'}
						<HelpCircle size={18} strokeWidth={1.75} />
					{/if}
					{#if item.icon === 'history' && historyCount > 0}
						<span class="tab-badge">{historyCount > 9 ? '9+' : historyCount}</span>
					{/if}
				</span>
				<span class="tab-label">{item.label}</span>
			</button>
		{/if}
	{/each}
</nav>

<style>
	.bottom-tabs {
		display: flex;
		align-items: center;
		justify-content: space-around;
		width: 100%;
		height: 100%;
	}

	.tab-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		cursor: pointer;
		padding: 4px 12px;
		border-radius: var(--borderRadius-medium);
		transition: color 120ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.tab-btn:active {
		transform: scale(0.95);
	}

	.tab-btn--active {
		color: var(--fgColor-accent);
	}

	.tab-icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
	}

	.tab-label {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.01em;
		line-height: 1;
	}

	.tab-badge {
		position: absolute;
		top: -2px;
		right: -6px;
		min-width: 13px;
		height: 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--fontStack-monospace);
		font-size: 8px;
		font-weight: 600;
		color: var(--fgColor-onEmphasis);
		background: var(--bgColor-accent-emphasis);
		border-radius: var(--borderRadius-full);
		padding: 0 3px;
		line-height: 1;
	}
</style>
