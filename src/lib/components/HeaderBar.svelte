<script lang="ts">
	import { Moon, Sun, Diamond } from 'lucide-svelte';

	interface Props {
		appColorMode: 'dark' | 'light';
		onThemeToggle: () => void;
		onBrandClick?: () => void;
	}

	let { appColorMode, onThemeToggle, onBrandClick }: Props = $props();
</script>

<div class="header-inner">
	<div class="header-left">
		<button class="brand" onclick={onBrandClick} title="Back to home" aria-label="Back to home">
			<span class="brand-mark" aria-hidden="true">
				<Diamond size={18} strokeWidth={2} />
			</span>
			<span class="brand-name">Tokensmith</span>
		</button>
	</div>

	<div class="header-right">
		<button
			class="theme-toggle"
			onclick={onThemeToggle}
			title="Switch theme"
			aria-label="Switch theme"
		>
			{#if appColorMode === 'dark'}
				<Moon size={14} strokeWidth={1.75} />
			{:else}
				<Sun size={14} strokeWidth={1.75} />
			{/if}
		</button>
	</div>
</div>

<style>
	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		padding: 0 16px;
		gap: 16px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* ─── Brand ─────────────────────────────────────── */
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		background: none;
		border: none;
		padding: 4px 8px;
		margin: -4px -8px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.brand:hover {
		opacity: 0.8;
	}

	.brand:active {
		opacity: 0.6;
	}

	.brand-mark {
		display: flex;
		align-items: center;
		color: var(--brand-color);
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--brand-color) 30%, transparent));
		line-height: 1;
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 800;
		letter-spacing: -0.04em;
		color: var(--fgColor-default);
	}

	/* ─── Theme toggle ─────────────────────────────── */
	.theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-sm);
		color: var(--fgColor-muted);
		cursor: pointer;
		transition:
			color var(--transition-fast),
			background var(--transition-fast),
			border-color var(--transition-fast);
	}

	.theme-toggle:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	/* ─── Responsive ──────────────────────────── */
	@media (max-width: 767px) {
		.header-inner {
			padding: 0 10px;
			gap: 8px;
		}

		.brand-name {
			display: none;
		}

		.header-right {
			gap: 4px;
		}
	}
</style>
