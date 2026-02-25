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
	<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

{@render children()}

<style>
	@import '$lib/styles/shared.css';

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
