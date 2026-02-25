<script lang="ts">
	import { Upload, Files, Settings, HelpCircle, ShieldCheck } from 'lucide-svelte';

	type PanelId = 'import' | 'files' | 'settings' | 'help' | 'quality';

	interface Props {
		active: PanelId | null;
		hasOutput: boolean;
		qualityIssueCount?: number;
		onSelect: (id: PanelId) => void;
	}

	let { active, hasOutput, qualityIssueCount = 0, onSelect }: Props = $props();

	const ITEMS: { id: PanelId; label: string; icon: string; needsOutput?: boolean }[] = [
		{ id: 'import', label: 'Import', icon: 'upload' },
		{ id: 'files', label: 'Files', icon: 'files', needsOutput: true },
		{ id: 'quality', label: 'Quality', icon: 'shield-check', needsOutput: true },
		{ id: 'settings', label: 'Settings', icon: 'settings' },
		{ id: 'help', label: 'Help', icon: 'help' }
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
			{:else if item.icon === 'settings'}
				<Settings size={18} strokeWidth={1.75} />
		{:else if item.icon === 'shield-check'}
			<ShieldCheck size={18} strokeWidth={1.75} />
			{#if qualityIssueCount > 0}
				<span class="rail-badge rail-badge--warn">{qualityIssueCount > 9 ? '9+' : qualityIssueCount}</span>
			{/if}
		{:else if item.icon === 'help'}
			<HelpCircle size={18} strokeWidth={1.75} />
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
		gap: 0;
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
		border-radius: var(--radius-md);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.rail-btn:hover {
		background: var(--control-bgColor-hover);
	}

	.rail-btn:active {
		background: var(--control-bgColor-hover);
	}

	.rail-btn:hover,
	.rail-btn--active {
		color: var(--fgColor-default);
	}

	.rail-btn:not(:last-child) {
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.rail-btn :global(svg) {
		width: 16px;
		height: 16px;
	}

	.rail-accent {
		position: absolute;
		left: -4px;
		top: 50%;
		transform: translateY(-50%);
		width: 2px;
		height: 0;
		background: var(--brand-color);
		border-radius: 1px;
		transition: height var(--transition-fast);
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
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 600;
		color: var(--fgColor-onEmphasis);
		background: var(--brand-color);
		box-shadow: 0 0 6px color-mix(in srgb, var(--brand-color) 40%, transparent);
		border-radius: 100px;
		padding: 0 3px;
		line-height: 1;
	}

	.rail-badge--warn {
		background: var(--brand-color);
		box-shadow: 0 0 6px color-mix(in srgb, var(--brand-color) 40%, transparent);
	}
</style>
