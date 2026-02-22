<script lang="ts">
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
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

{@render children()}

<style>
	@import '@primer/primitives/dist/css/base/typography/typography.css';
	@import '@primer/primitives/dist/css/base/motion/motion.css';
	@import '@primer/primitives/dist/css/functional/themes/light.css';
	@import '@primer/primitives/dist/css/functional/themes/dark.css';
	@import '@primer/primitives/dist/css/functional/typography/typography.css';
	@import '@primer/primitives/dist/css/functional/size/size.css';
	@import '@primer/primitives/dist/css/functional/size/border.css';
	@import '@primer/primitives/dist/css/functional/size/radius.css';

	@media (prefers-reduced-motion: reduce) {
		:global(*),
		:global(*::before),
		:global(*::after) {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
			scroll-behavior: auto !important;
		}
	}
</style>
