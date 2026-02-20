<script lang="ts">
	import { version } from '$app/environment';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';

	let { children } = $props();

	type AppTheme = 'dark' | 'light' | 'auto';
	let appTheme = $state<AppTheme>('dark');

	function getSystemPreference(): 'light' | 'dark' {
		return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
	}

	function applyTheme(theme: AppTheme) {
		const html = document.documentElement;
		html.setAttribute('data-color-mode', theme === 'auto' ? 'auto' : theme);
		html.setAttribute('data-light-theme', 'light');
		html.setAttribute('data-dark-theme', 'dark');
	}

	function cycleTheme() {
		const order: AppTheme[] = ['dark', 'light', 'auto'];
		appTheme = order[(order.indexOf(appTheme) + 1) % order.length];
		applyTheme(appTheme);
		localStorage.setItem('app-theme', appTheme);
	}

	const themeLabels: Record<AppTheme, string> = {
		dark: 'Dark',
		light: 'Light',
		auto: 'System'
	};

	if (browser) {
		const saved = localStorage.getItem('app-theme') as AppTheme | null;
		let initialTheme: AppTheme = 'dark';
		if (saved && ['dark', 'light', 'auto'].includes(saved)) {
			initialTheme = saved;
		}
		appTheme = initialTheme;
		applyTheme(initialTheme);
	}
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Token Sync</title>
	<meta name="description" content="Design token pipeline — Figma → SCSS · TS · Swift · Kotlin" />
</svelte:head>

{@render children()}

<footer class="app-footer">
	<span>Token Sync v{version}</span>
	<span class="footer-sep">·</span>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href="{base}/api/health" target="_blank" rel="noopener" class="footer-link">health</a>
	<span class="footer-sep">·</span>
	<button class="theme-toggle" onclick={cycleTheme} title="Switch theme ({themeLabels[appTheme]})">
		{#if appTheme === 'dark'}
			<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.598 1.591a.749.749 0 01.785-.175 7.001 7.001 0 11-8.967 8.967.75.75 0 01.961-.96 5.5 5.5 0 007.046-7.046.75.75 0 01.175-.786zm1.616 1.945a7 7 0 01-7.678 7.678 5.499 5.499 0 107.678-7.678z"/></svg>
		{:else if appTheme === 'light'}
			<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12a4 4 0 100-8 4 4 0 000 8zm0-1.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm5.657-8.157a.75.75 0 010 1.06l-1.061 1.06a.749.749 0 01-1.275-.326.749.749 0 01.215-.734l1.06-1.06a.75.75 0 011.06 0zm-9.193 9.193a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM8 0a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V.75A.75.75 0 018 0zM3 8a.75.75 0 01-.75.75H.75a.75.75 0 010-1.5h1.5A.75.75 0 013 8zm13 0a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0116 8zm-8 5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 13zm3.536-1.464a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM2.343 2.343a.75.75 0 011.061 0l1.06 1.061a.751.751 0 01-.018 1.042.751.751 0 01-1.042.018l-1.06-1.06a.75.75 0 010-1.06z"/></svg>
		{:else}
			<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14.5 8a6.5 6.5 0 01-13 0 6.5 6.5 0 0113 0zM8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5V1.5a6.5 6.5 0 010 13z"/></svg>
		{/if}
		<span class="theme-label">{themeLabels[appTheme]}</span>
	</button>
</footer>

<style>
	@import '@primer/primitives/dist/css/base/typography/typography.css';
	@import '@primer/primitives/dist/css/base/motion/motion.css';
	@import '@primer/primitives/dist/css/functional/themes/light.css';
	@import '@primer/primitives/dist/css/functional/themes/dark.css';
	@import '@primer/primitives/dist/css/functional/typography/typography.css';
	@import '@primer/primitives/dist/css/functional/size/size.css';
	@import '@primer/primitives/dist/css/functional/size/border.css';
	@import '@primer/primitives/dist/css/functional/size/radius.css';

	.app-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 16px 32px;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		border-top: 1px solid var(--borderColor-muted);
	}

	.footer-sep {
		opacity: 0.4;
	}

	.footer-link {
		color: inherit;
		text-decoration: none;
		transition: color var(--base-duration-200) var(--base-easing-ease);
	}

	.footer-link:hover {
		color: var(--fgColor-muted);
	}

	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--borderRadius-small);
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			background var(--base-duration-100) var(--base-easing-ease);
	}

	.theme-toggle:hover {
		color: var(--fgColor-muted);
		background: var(--bgColor-muted);
	}

	.theme-label {
		font-weight: var(--base-text-weight-medium);
	}
</style>
