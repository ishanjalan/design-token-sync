<script lang="ts">
	import { Diamond } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Error — Tokensmith</title>
</svelte:head>

<div class="error-page">
	<div class="error-card">
		<span class="error-mark">
			<Diamond size={32} strokeWidth={1.5} />
		</span>
		<p class="error-code">{$page.status}</p>
		<p class="error-message">{$page.error?.message ?? 'Something went wrong'}</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="error-back" href="{base}/">← Back to Tokensmith</a>
	</div>
</div>

<style>
	:global(body) {
		font-family: var(--font-code, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace);
		background: var(--bgColor-default, #0a0a0a);
		color: var(--fgColor-default, #d8d8d8);
		min-height: 100dvh;
		margin: 0;
		padding: 0;
	}

	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: 32px;
	}

	.error-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
		max-width: 400px;
	}

	.error-mark {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--brand-color, #e83030);
		opacity: 0.6;
	}

	.error-code {
		font-size: 48px;
		font-weight: 700;
		color: var(--fgColor-disabled, #656c76);
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.error-message {
		font-size: 13px;
		font-weight: 300;
		color: var(--fgColor-disabled, #656c76);
		line-height: 1.6;
	}

	.error-back {
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-disabled, #656c76);
		text-decoration: none;
		letter-spacing: 0.06em;
		padding: 8px 16px;
		border: 1px solid var(--borderColor-default, #3d444d);
		border-radius: 3px;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.error-back:hover {
		color: var(--fgColor-default, #f0f6fc);
		border-color: var(--borderColor-emphasis, #656c76);
	}
</style>
