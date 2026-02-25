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
					{:else if item.icon === 'settings'}
						<Settings size={18} strokeWidth={1.75} />
				{:else if item.icon === 'shield-check'}
					<ShieldCheck size={18} strokeWidth={1.75} />
				{:else if item.icon === 'help'}
					<HelpCircle size={18} strokeWidth={1.75} />
				{/if}
				{#if item.icon === 'shield-check' && qualityIssueCount > 0}
					<span class="tab-badge tab-badge--warn">{qualityIssueCount > 9 ? '9+' : qualityIssueCount}</span>
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
		background: var(--surface-glass);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-top: 1px solid var(--surface-glass-border);
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
		border-radius: var(--radius-md);
		transition: color var(--transition-fast);
		-webkit-tap-highlight-color: transparent;
	}

	.tab-btn:active {
		transform: scale(0.95);
	}

	.tab-btn--active {
		color: var(--fgColor-default);
	}

	.tab-icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
	}

	.tab-btn--active .tab-icon::after {
		content: '';
		position: absolute;
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--brand-color);
	}

	.tab-label {
		font-family: var(--font-display);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.01em;
		line-height: 1;
	}

	.tab-badge {
		position: absolute;
		top: -2px;
		right: -6px;
		min-width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 8px;
		font-weight: 600;
		color: var(--fgColor-onEmphasis);
		background: var(--brand-color);
		border-radius: 100px;
		padding: 0 3px;
		line-height: 1;
	}

	.tab-badge--warn {
		background: var(--brand-color);
	}
</style>
