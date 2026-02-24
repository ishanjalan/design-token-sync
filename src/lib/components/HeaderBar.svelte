<script lang="ts">
	import { Moon, Sun, Diamond, RefreshCw, ArrowRight } from 'lucide-svelte';
	import type { Platform, OutputCategory } from '$lib/types.js';

	interface PlatformOption {
		id: Platform;
		label: string;
		sublabel: string;
		color: string;
		icon: string;
		techIcons: { svg: string; color: string; label: string }[];
	}

	interface Props {
		platforms: PlatformOption[];
		selectedPlatforms: Platform[];
		selectedOutputs: OutputCategory[];
		onToggleOutput: (cat: OutputCategory) => void;
		canGenerate: boolean;
		loading: boolean;
		progressStatus?: string | null;
		needsRegeneration?: boolean;
		appColorMode: 'dark' | 'light';
		tokensAutoLoaded?: boolean;
		welcomeMode?: boolean;
		onSelectPlatform: (id: Platform) => void;
		onGenerate: () => void;
		onThemeToggle: () => void;
	}

	let {
		platforms,
		selectedPlatforms,
		selectedOutputs,
		onToggleOutput,
		canGenerate,
		loading,
		progressStatus = null,
		needsRegeneration = false,
		appColorMode,
		tokensAutoLoaded = false,
		welcomeMode = false,
		onSelectPlatform,
		onGenerate,
		onThemeToggle
	}: Props = $props();
</script>

<div class="header-inner">
	<div class="header-left">
		<div class="brand">
			<span class="brand-mark" aria-hidden="true">
				<Diamond size={18} strokeWidth={2} />
			</span>
			<span class="brand-name">Tokensmith</span>
		</div>

		{#if !welcomeMode}
			<div class="platform-segmented" role="radiogroup" aria-label="Select platform">
				{#each platforms as p (p.id)}
					<button
						class="seg-btn"
						class:seg-btn--active={selectedPlatforms.includes(p.id)}
						style="--p-color: {p.color}"
						onclick={() => onSelectPlatform(p.id)}
						role="radio"
						aria-checked={selectedPlatforms.includes(p.id)}
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<span class="seg-icon">{@html p.icon}</span>
						<span class="seg-label">{p.label}</span>
					</button>
				{/each}
			</div>

			<div class="output-chips">
				<button
					class="out-chip"
					class:out-chip--active={selectedOutputs.includes('colors')}
					title="Toggle color output"
					onclick={() => onToggleOutput('colors')}
				>
					<span class="out-dot" style="background: var(--fgColor-accent)"></span>
					C
				</button>
				<button
					class="out-chip"
					class:out-chip--active={selectedOutputs.includes('typography')}
					title="Toggle typography output"
					onclick={() => onToggleOutput('typography')}
				>
					<span class="out-dot" style="background: #F5A623"></span>
					T
				</button>
			</div>

			<button
				class="generate-btn"
				class:generate-btn--stale={needsRegeneration}
				class:generate-btn--ready={tokensAutoLoaded && canGenerate && !loading}
				disabled={!canGenerate}
				onclick={onGenerate}
			>
			{#if loading}
				<span class="btn-spinner"></span>
				{progressStatus ?? 'Generating…'}
				{:else if needsRegeneration}
					Regenerate
					<span class="btn-arrow"><RefreshCw size={12} strokeWidth={2} /></span>
				{:else}
					Generate
					<span class="btn-arrow"><ArrowRight size={12} strokeWidth={2} /></span>
				{/if}
			</button>
		{/if}
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
	}

	.brand-mark {
		display: flex;
		align-items: center;
		color: var(--brand-color);
		line-height: 1;
	}

	.brand-name {
		font-family: 'JetBrains Mono', var(--fontStack-monospace);
		font-size: 13px;
		font-weight: 700;
		color: var(--fgColor-default);
		letter-spacing: -0.02em;
	}

	/* ─── Platform Segmented Control ────────────────── */
	.platform-segmented {
		display: flex;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		padding: 2px;
		gap: 1px;
	}

	.seg-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		border: none;
		background: transparent;
		border-radius: calc(var(--borderRadius-medium) - 2px);
		font-family: var(--fontStack-sansSerif);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-muted);
		cursor: pointer;
		transition:
			background var(--base-duration-150) var(--base-easing-ease),
			color var(--base-duration-150) var(--base-easing-ease),
			box-shadow var(--base-duration-150) var(--base-easing-ease);
	}

	.seg-btn:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.seg-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--p-color, var(--fgColor-default));
		box-shadow: var(--shadow-floating-small);
	}

	.seg-icon {
		display: flex;
		align-items: center;
		opacity: 0.7;
	}

	.seg-btn--active .seg-icon {
		opacity: 1;
	}

	.seg-label {
		white-space: nowrap;
	}

	/* ─── Output Chips ─────────────────────────────── */
	.output-chips {
		display: flex;
		gap: 2px;
		margin-left: 4px;
	}

	.out-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--fgColor-disabled);
		background: none;
		border: 1px solid transparent;
		border-radius: var(--borderRadius-small);
		padding: 2px 6px;
		cursor: pointer;
		transition: all 120ms ease;
	}

	.out-chip:hover {
		background: var(--control-bgColor-hover);
	}

	.out-chip--active {
		color: var(--fgColor-default);
		border-color: var(--borderColor-default);
		background: var(--control-bgColor-rest);
	}

	.out-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		opacity: 0.35;
		transition: opacity 120ms ease;
	}

	.out-chip--active .out-dot {
		opacity: 1;
	}

	/* ─── Generate Button ──────────────────────────── */
	.generate-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 16px;
		background: var(--brand-color);
		color: var(--fgColor-onEmphasis);
		border: none;
		border-radius: var(--borderRadius-medium);
		font-family: var(--fontStack-sansSerif);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--base-duration-150) var(--base-easing-ease),
			box-shadow var(--base-duration-200) var(--base-easing-ease),
			transform var(--base-duration-100) var(--base-easing-ease);
	}

	.generate-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--brand-color) 85%, white);
		box-shadow: 0 0 var(--atmosphere-glow-spread, 20px) color-mix(in srgb, var(--brand-color) 30%, transparent);
	}

	.generate-btn:active:not(:disabled) {
		transform: scale(0.97);
	}

	.generate-btn:not(:disabled) {
		animation: gen-ready-pulse 2s ease-in-out infinite;
	}

	.generate-btn--ready:not(:disabled) {
		animation: gen-autoloaded-pulse 1.5s ease-in-out infinite;
		box-shadow: 0 0 20px color-mix(in srgb, var(--brand-color) 40%, transparent);
	}

	.generate-btn--stale:not(:disabled) {
		background: var(--bgColor-attention-emphasis);
		animation: gen-stale-pulse 1.2s ease-in-out infinite;
	}

	@keyframes gen-ready-pulse {
		0%, 100% { box-shadow: none; }
		50% { box-shadow: 0 0 16px color-mix(in srgb, var(--brand-color) 25%, transparent); }
	}

	@keyframes gen-autoloaded-pulse {
		0%, 100% { box-shadow: 0 0 12px color-mix(in srgb, var(--brand-color) 25%, transparent); }
		50% { box-shadow: 0 0 28px color-mix(in srgb, var(--brand-color) 50%, transparent); }
	}

	@keyframes gen-stale-pulse {
		0%, 100% { box-shadow: none; }
		50% { box-shadow: 0 0 16px color-mix(in srgb, var(--bgColor-attention-emphasis) 40%, transparent); }
	}

	.generate-btn:disabled {
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		color: var(--fgColor-disabled);
		cursor: not-allowed;
		opacity: 0.5;
		animation: none;
	}

	.btn-arrow {
		font-weight: 300;
		transition: transform var(--base-duration-200) var(--base-easing-ease);
	}

	.generate-btn:hover:not(:disabled) .btn-arrow {
		transform: translateX(2px);
	}

	.btn-spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 1.5px solid color-mix(in srgb, var(--fgColor-onEmphasis) 30%, transparent);
		border-top-color: var(--fgColor-onEmphasis);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
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
		border-radius: var(--borderRadius-small);
		color: var(--fgColor-muted);
		cursor: pointer;
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			border-color var(--base-duration-100) var(--base-easing-ease);
	}

	.theme-toggle:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-default);
	}

	/* ─── Responsive ──────────────────────────── */
	@media (max-width: 1199px) {
		.platform-segmented {
			gap: 0;
		}

		.seg-label {
			display: none;
		}
	}

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
