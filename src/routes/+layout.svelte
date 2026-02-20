<script lang="ts">
	import { version } from '$app/environment';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';

	let { children } = $props();

	if (browser) {
		const saved = localStorage.getItem('app-theme');
		if (saved === 'light' || saved === 'auto') {
			const html = document.documentElement;
			html.setAttribute('data-color-mode', saved === 'auto' ? 'auto' : 'light');
		}
	}
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Tokensmith</title>
	<meta name="description" content="Tokensmith — Design token pipeline. Figma → SCSS · TS · Swift · Kotlin" />
</svelte:head>

{@render children()}

<footer class="app-footer">
	<span>Tokensmith v{version}</span>
	<span class="footer-sep">·</span>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href="{base}/api/health" target="_blank" rel="noopener" class="footer-link">health</a>
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
</style>
