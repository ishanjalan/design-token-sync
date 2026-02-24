<script lang="ts">
	import '$lib/styles/shared.css';

	type SidePanelId = 'import' | 'files' | 'history' | 'settings' | 'help' | null;

	interface Props {
		activePanel: SidePanelId;
		panelWidth: number;
		welcomeMode?: boolean;
		onClosePanel?: () => void;
		header: import('svelte').Snippet;
		rail: import('svelte').Snippet;
		sidePanel: import('svelte').Snippet;
		editor: import('svelte').Snippet;
		statusBar: import('svelte').Snippet;
		bottomTab?: import('svelte').Snippet;
	}

	let { activePanel, panelWidth = $bindable(), welcomeMode = false, onClosePanel, header, rail, sidePanel, editor, statusBar, bottomTab }: Props = $props();

	let resizing = $state(false);
	let startX = 0;
	let startWidth = 0;

	function onPointerDown(e: PointerEvent) {
		resizing = true;
		startX = e.clientX;
		startWidth = panelWidth;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!resizing) return;
		const delta = e.clientX - startX;
		const next = Math.max(120, Math.min(480, startWidth + delta));
		panelWidth = next;
	}

	function onPointerUp() {
		if (!resizing) return;
		resizing = false;
		try { localStorage.setItem('tokensmith:panel-width', String(panelWidth)); } catch { /* persist failure is non-critical */ }
	}
</script>

<div class="shell" class:shell--resizing={resizing}>
	<div class="shell-header">
		{@render header()}
	</div>

	<div class="shell-main">
		{#if !welcomeMode}
			<div class="shell-rail">
				{@render rail()}
			</div>
		{/if}

		{#if activePanel && (!welcomeMode || activePanel === 'import' || activePanel === 'settings' || activePanel === 'help')}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="shell-overlay" onclick={onClosePanel}></div>
			<div
				class="shell-side"
				class:shell-side--no-rail={welcomeMode}
				style="width: {panelWidth}px"
			>
				{@render sidePanel()}
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="shell-resize-handle"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
			></div>
		{/if}

		<div class="shell-editor">
			{@render editor()}
		</div>
	</div>

	<div class="shell-status desktop-only">
		{@render statusBar()}
	</div>

	{#if bottomTab}
		<div class="shell-bottom-tab mobile-only">
			{@render bottomTab()}
		</div>
	{/if}
</div>

<style>
	.shell {
		display: grid;
		grid-template-rows: 48px 1fr 24px;
		height: 100dvh;
		overflow: hidden;
		background: var(--bgColor-default);
	}

	.shell--resizing {
		cursor: col-resize;
		user-select: none;
	}

	/* ─── Header ────────────────────────────────────────────────────────── */
	.shell-header {
		z-index: 20;
		background: color-mix(in srgb, var(--bgColor-default) 92%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--borderColor-muted);
	}

	/* ─── Main area ─────────────────────────────────────────────────────── */
	.shell-main {
		display: flex;
		overflow: hidden;
		min-height: 0;
	}

	/* ─── Activity Rail ─────────────────────────────────────────────────── */
	.shell-rail {
		width: 44px;
		flex-shrink: 0;
		background: var(--bgColor-inset);
		border-right: 1px solid var(--borderColor-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 8px;
		gap: 2px;
	}

	/* ─── Side Panel ────────────────────────────────────────────────────── */
	.shell-side {
		flex-shrink: 0;
		background: var(--bgColor-inset);
		border-right: 1px solid var(--borderColor-muted);
		box-shadow: 2px 0 8px color-mix(in srgb, black 6%, transparent);
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--fgColor-disabled) 30%, transparent) transparent;
		animation: panel-slide-in 200ms ease both;
	}

	@keyframes panel-slide-in {
		from {
			opacity: 0;
			transform: translateX(-12px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	/* ─── Resize Handle ─────────────────────────────────────────────────── */
	.shell-resize-handle {
		width: 4px;
		flex-shrink: 0;
		cursor: col-resize;
		background: transparent;
		transition: background var(--base-duration-100) var(--base-easing-ease);
		z-index: 5;
	}

	.shell-resize-handle:hover,
	.shell--resizing .shell-resize-handle {
		background: var(--borderColor-accent-emphasis);
	}

	/* ─── Editor Area ───────────────────────────────────────────────────── */
	.shell-editor {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	/* ─── Status Bar ────────────────────────────────────────────────────── */
	.shell-status {
		background: var(--bgColor-inset);
		border-top: 1px solid var(--borderColor-muted);
		display: flex;
		align-items: center;
		padding: 0 12px;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
		gap: 16px;
		overflow: hidden;
	}

	/* ─── Overlay (for medium / small overlaying panels) ─────────── */
	.shell-overlay {
		display: none;
	}

	/* ─── Bottom Tab Bar ───────────────────────────────────────── */
	.shell-bottom-tab {
		background: var(--bgColor-inset);
		border-top: 1px solid var(--borderColor-muted);
		display: flex;
		align-items: center;
		justify-content: space-around;
		height: 44px;
	}

	.mobile-only {
		display: none;
	}

	/* ─── Responsive: medium (768–1199px) ──────────────────────────── */
	@media (max-width: 1199px) {
		.shell-main {
			position: relative;
		}

		.shell-overlay {
			display: block;
			position: absolute;
			inset: 0;
			z-index: 14;
			background: color-mix(in srgb, var(--bgColor-default) 50%, transparent);
			backdrop-filter: blur(2px);
			-webkit-backdrop-filter: blur(2px);
		}

		.shell-side {
			position: absolute;
			top: 0;
			left: 44px;
			bottom: 0;
			z-index: 15;
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			box-shadow: 4px 0 16px color-mix(in srgb, black 12%, transparent);
		}

		.shell-side--no-rail {
			left: 0;
		}

		.shell-resize-handle {
			display: none;
		}
	}

	/* ─── Responsive: small (below 768px) ─────────────────────────── */
	@media (max-width: 767px) {
		.shell {
			grid-template-rows: 48px 1fr auto;
		}

		.shell-rail {
			display: none;
		}

		.shell-overlay {
			display: block;
			position: fixed;
			inset: 48px 0 44px 0;
			z-index: 19;
			background: color-mix(in srgb, var(--bgColor-default) 60%, transparent);
			backdrop-filter: blur(4px);
			-webkit-backdrop-filter: blur(4px);
		}

		.shell-side {
			position: fixed;
			inset: 48px 0 44px 0;
			width: 100% !important;
			left: 0;
			z-index: 20;
			background: var(--bgColor-default);
			backdrop-filter: none;
			animation: drawer-slide-up 250ms ease both;
		}

		.shell-resize-handle {
			display: none;
		}

		.desktop-only {
			display: none;
		}

		.mobile-only {
			display: flex;
		}
	}

	@keyframes drawer-slide-up {
		from {
			opacity: 0;
			transform: translateY(100%);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
