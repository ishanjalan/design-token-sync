<script lang="ts">
	interface Props {
		version: number;
		summary?: string;
		onRegenerate: () => void;
	}

	let { version, summary, onRegenerate }: Props = $props();
</script>

<div class="tokens-updated-banner">
	<span class="tokens-updated-text">
		Tokens updated to v{version}{summary ? ` — ${summary}` : ''}
	</span>
	<button class="tokens-updated-btn" onclick={onRegenerate}>Regenerate</button>
</div>

<style>
	.tokens-updated-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px;
		background: var(--surface-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--borderColor-muted);
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-attention);
		animation: banner-slide-in var(--transition-default) ease;
		z-index: 2;
		position: relative;
	}

	.tokens-updated-text {
		font-weight: 500;
	}

	.tokens-updated-btn {
		flex-shrink: 0;
		padding: 4px 12px;
		background: var(--bgColor-attention-emphasis);
		color: var(--fgColor-onEmphasis);
		border: none;
		border-radius: var(--radius-md);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.tokens-updated-btn:hover {
		opacity: 0.85;
	}

	@keyframes banner-slide-in {
		from { transform: translateY(-100%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
</style>
