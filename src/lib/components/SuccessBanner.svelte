<script lang="ts">
	import { Check, ClipboardCopy, Download, GitPullRequest, X } from 'lucide-svelte';
	import type { GenerateResponse } from '$lib/types.js';

	interface Props {
		result: GenerateResponse | null;
		diffTotals: { added: number; removed: number; modified: number };
		hasDiffs: boolean;
		onCopy: () => void;
		onDownload: () => void;
		onSendPRs: () => void;
	}

	let { result, diffTotals, hasDiffs, onCopy, onDownload, onSendPRs }: Props = $props();

	let show = $state(false);
	let prevFileCount = $state<number | null>(null);
	let dismissTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const count = result?.files?.length ?? 0;
		if (result && count !== prevFileCount) {
			show = true;
			prevFileCount = count;
			if (dismissTimer) clearTimeout(dismissTimer);
			dismissTimer = setTimeout(() => { show = false; }, 5000);
		}
	});

	const fileCount = $derived(result?.files?.length ?? 0);
</script>

{#if show}
	<div class="success-banner">
		<div class="success-banner-inner">
			<Check size={14} strokeWidth={2.5} />
			<span>{fileCount} file{fileCount !== 1 ? 's' : ''} generated</span>
			{#if diffTotals.added > 0 || diffTotals.removed > 0}
				<span class="success-stats">
					{#if diffTotals.added > 0}<span class="success-stat success-stat--add">+{diffTotals.added}</span>{/if}
					{#if diffTotals.removed > 0}<span class="success-stat success-stat--del">-{diffTotals.removed}</span>{/if}
				</span>
			{/if}
		</div>
		<div class="success-banner-actions">
			<button class="success-action" onclick={onCopy}>
				<ClipboardCopy size={12} strokeWidth={2} />
				Copy
			</button>
			<button class="success-action" onclick={onDownload}>
				<Download size={12} strokeWidth={2} />
				ZIP
			</button>
			{#if hasDiffs}
				<button class="success-action success-action--primary" onclick={onSendPRs}>
					<GitPullRequest size={12} strokeWidth={2} />
					Send PR
				</button>
			{/if}
			<button class="success-dismiss" onclick={() => (show = false)} aria-label="Dismiss">
				<X size={12} />
			</button>
		</div>
	</div>
{/if}

<style>
	.success-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px;
		background: var(--surface-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--borderColor-muted);
		border-left: 3px solid var(--brand-color, var(--fgColor-success));
	}

	.success-banner-inner {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--fgColor-success, #2ea043);
	}

	.success-stats {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 4px;
		padding-left: 8px;
		border-left: 1px solid var(--borderColor-muted);
	}

	.success-stat {
		font-family: var(--font-code);
		font-size: 11px;
		font-weight: 600;
	}

	.success-stat--add { color: var(--fgColor-success, #2ea043); }
	.success-stat--del { color: var(--fgColor-danger, #f85149); }

	.success-banner-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.success-action {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: 500;
		font-family: var(--font-code);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--radius-sm);
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.success-action:hover {
		background: var(--bgColor-muted);
	}

	.success-action--primary {
		background: var(--bgColor-success-emphasis, #2ea043);
		color: #fff;
		border-color: transparent;
	}

	.success-action--primary:hover {
		opacity: 0.9;
	}

	.success-dismiss {
		display: inline-flex;
		align-items: center;
		padding: 2px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.success-dismiss:hover {
		color: var(--fgColor-default);
		background: var(--bgColor-muted);
	}
</style>
