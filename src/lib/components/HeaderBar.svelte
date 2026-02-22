<script lang="ts">
	import { Moon, Sun, Diamond } from 'lucide-svelte';
	import type { Platform } from '$lib/types.js';

	interface PlatformOption {
		id: Platform;
		label: string;
		sublabel: string;
		color: string;
		icon: string;
	}

	interface Props {
		platforms: PlatformOption[];
		selectedPlatforms: Platform[];
		canGenerate: boolean;
		loading: boolean;
		needsRegeneration?: boolean;
		requiredFilled: number;
		appColorMode: 'dark' | 'light';
		pluginSyncAvailable: boolean;
		pluginAutoLoad: boolean;
		figmaWebhookEvent: { file_name: string; timestamp: string; receivedAt: string } | null;
		figmaWebhookSeen: boolean;
		onSelectPlatform: (id: Platform) => void;
		onGenerate: () => void;
		onThemeToggle: () => void;
		onLoadPluginSync: () => void;
		onAutoLoadChange: (val: boolean) => void;
		onWebhookDismiss: () => void;
	}

	let {
		platforms,
		selectedPlatforms,
		canGenerate,
		loading,
		needsRegeneration = false,
		requiredFilled,
		appColorMode,
		pluginSyncAvailable,
		pluginAutoLoad,
		figmaWebhookEvent,
		figmaWebhookSeen,
		onSelectPlatform,
		onGenerate,
		onThemeToggle,
		onLoadPluginSync,
		onAutoLoadChange,
		onWebhookDismiss
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

		<button
			class="generate-btn"
			class:generate-btn--stale={needsRegeneration}
			disabled={!canGenerate}
			onclick={onGenerate}
		>
			{#if loading}
				<span class="btn-spinner"></span>
				Generating…
			{:else if needsRegeneration}
				Regenerate
				<span class="btn-arrow">↻</span>
			{:else}
				Generate
				<span class="btn-arrow">→</span>
			{/if}
		</button>
	</div>

	<div class="header-right">
		{#if pluginSyncAvailable}
			<button
				class="alert-badge"
				onclick={onLoadPluginSync}
				title="Load tokens synced from Figma plugin"
			>
				<span class="alert-dot"></span>
				Plugin sync
			</button>
		{/if}

		{#if figmaWebhookEvent && !figmaWebhookSeen}
			<button
				class="alert-badge alert-badge--warn"
				onclick={onWebhookDismiss}
				title="Figma file updated"
			>
				<span class="alert-dot alert-dot--warn"></span>
				Figma updated
			</button>
		{/if}

		<label class="auto-load" title="Automatically load tokens when synced from Figma plugin">
			<input type="checkbox" checked={pluginAutoLoad} onchange={(e) => onAutoLoadChange((e.target as HTMLInputElement).checked)} />
			<span class="auto-load-text">Auto</span>
		</label>

		<div class="status-badge">
			<span class="status-dot" class:status-dot--active={requiredFilled > 0}></span>
			<span class="status-text">
				{#if requiredFilled === 3}
					Ready
				{:else}
					{requiredFilled}/3
				{/if}
			</span>
		</div>

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

	.generate-btn--stale:not(:disabled) {
		background: var(--bgColor-attention-emphasis);
		animation: gen-stale-pulse 1.2s ease-in-out infinite;
	}

	@keyframes gen-ready-pulse {
		0%, 100% { box-shadow: none; }
		50% { box-shadow: 0 0 16px color-mix(in srgb, var(--brand-color) 25%, transparent); }
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

	/* ─── Alert Badges ─────────────────────────────── */
	.alert-badge {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 10px;
		background: var(--bgColor-accent-muted);
		border: 1px solid var(--borderColor-accent-muted);
		border-radius: var(--borderRadius-full);
		font-family: var(--fontStack-sansSerif);
		font-size: 10px;
		font-weight: 600;
		color: var(--fgColor-accent);
		cursor: pointer;
		white-space: nowrap;
		animation: fade-in 0.3s ease;
	}

	.alert-badge--warn {
		background: var(--bgColor-attention-muted);
		border-color: var(--borderColor-attention-muted);
		color: var(--fgColor-attention);
	}

	.alert-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fgColor-accent);
		animation: pulse 2s ease-in-out infinite;
	}

	.alert-dot--warn {
		background: var(--fgColor-attention);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	@keyframes fade-in {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ─── Auto-load toggle ─────────────────────────── */
	.auto-load {
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		font-size: 10px;
		color: var(--fgColor-disabled);
	}

	.auto-load input {
		width: 12px;
		height: 12px;
		accent-color: var(--brand-color);
	}

	.auto-load-text {
		white-space: nowrap;
	}

	/* ─── Status Badge ─────────────────────────────── */
	.status-badge {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fgColor-disabled);
		transition: background var(--base-duration-200) var(--base-easing-ease);
	}

	.status-dot--active {
		background: var(--fgColor-success);
	}

	.status-text {
		white-space: nowrap;
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

		.auto-load {
			display: none;
		}

		.alert-badge {
			font-size: 0;
			padding: 3px 6px;
		}

		.alert-badge .alert-dot {
			margin: 0;
		}
	}
</style>
