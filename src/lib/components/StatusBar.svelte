<script lang="ts">
	import type { GeneratedFile, GenerateWarning } from '$lib/types.js';
	import { type DiffLine, type TokenModification, diffStats } from '$lib/diff-utils.js';
	import { AlertTriangle, Keyboard } from 'lucide-svelte';
	import { browser } from '$app/environment';

	interface Props {
		activeFile: GeneratedFile | undefined;
		diffs: Record<string, DiffLine[]>;
		modifications: Record<string, TokenModification[]>;
		diffTotals: { added: number; removed: number; modified: number };
		warnings: GenerateWarning[];
		lastGeneratedAt: Date | null;
		langLabel: (format: string) => string;
		formatFileSize: (bytes: number) => string;
		timeAgo: (d: Date) => string;
	}

	let { activeFile, diffs, modifications, diffTotals, warnings, lastGeneratedAt, langLabel, formatFileSize, timeAgo }: Props = $props();

	let showWarnings = $state(false);
	let showShortcuts = $state(false);

	const isMac = browser && /Mac|iPhone|iPad/.test(navigator.userAgent);
	const mod = isMac ? '⌘' : 'Ctrl';

	const SHORTCUTS: { keys: string; desc: string }[] = [
		{ keys: `${mod}+F`, desc: 'Search in file' },
		{ keys: 'Alt+↓', desc: 'Next diff change' },
		{ keys: 'Alt+↑', desc: 'Previous diff change' },
		{ keys: '↑ ↓ ← →', desc: 'Navigate file tabs' },
		{ keys: 'Click line', desc: 'Highlight line' },
		{ keys: 'Shift+click', desc: 'Highlight range' },
		{ keys: 'Esc', desc: 'Clear selection' }
	];

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showWarnings) showWarnings = false;
			if (showShortcuts) showShortcuts = false;
		}
		if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
			showShortcuts = !showShortcuts;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="status-bar">
	{#if activeFile}
		<span class="status-item">{langLabel(activeFile.format)}</span>
		<span class="status-sep">|</span>
		<span class="status-item">{activeFile.content.split('\n').length} lines</span>
		<span class="status-sep">|</span>
		<span class="status-item">{formatFileSize(new Blob([activeFile.content]).size)}</span>

		{#if diffs[activeFile.filename]}
			{@const ds = diffStats(diffs[activeFile.filename], modifications[activeFile.filename])}
			<span class="status-sep">|</span>
			<span class="status-item status-item--add">+{ds.added}</span>
			<span class="status-item status-item--rm">-{ds.removed}</span>
			{#if ds.modified > 0}
				<span class="status-item status-item--mod">~{ds.modified}</span>
			{/if}
		{/if}
	{/if}

	<span class="status-spacer"></span>

	{#if diffTotals.added > 0 || diffTotals.removed > 0}
		<span class="status-item status-item--add">+{diffTotals.added}</span>
		<span class="status-item status-item--rm">-{diffTotals.removed}</span>
		{#if diffTotals.modified > 0}
			<span class="status-item status-item--mod">~{diffTotals.modified}</span>
		{/if}
		<span class="status-sep">|</span>
	{/if}

	{#if warnings.length > 0}
		<button class="status-warnings" onclick={() => (showWarnings = !showWarnings)} title="Show warnings">
			<AlertTriangle size={10} />
			<span>{warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>
		</button>
		<span class="status-sep">|</span>
	{/if}

	{#if lastGeneratedAt}
		<span class="status-item">{timeAgo(lastGeneratedAt)}</span>
		<span class="status-sep">|</span>
	{/if}

	<button class="status-shortcuts" onclick={() => (showShortcuts = !showShortcuts)} title="Keyboard shortcuts (?)">
		<Keyboard size={10} strokeWidth={2} />
	</button>
</div>

{#if showShortcuts}
	<div class="shortcuts-panel">
		<div class="shortcuts-header">
			<span>Keyboard shortcuts</span>
			<button class="shortcuts-close" onclick={() => (showShortcuts = false)}>&times;</button>
		</div>
		<dl class="shortcuts-list">
			{#each SHORTCUTS as s}
				<div class="shortcut-row">
					<dt class="shortcut-keys">
						{#each s.keys.split('+') as part, i}
							{#if i > 0}<span class="shortcut-plus">+</span>{/if}
							<kbd>{part}</kbd>
						{/each}
					</dt>
					<dd class="shortcut-desc">{s.desc}</dd>
				</div>
			{/each}
		</dl>
	</div>
{/if}

{#if showWarnings && warnings.length > 0}
	<div class="warnings-panel">
		<div class="warnings-header">
			<span>Warnings ({warnings.length})</span>
			<button class="warnings-close" onclick={() => (showWarnings = false)}>&times;</button>
		</div>
		<ul class="warnings-list">
			{#each warnings as w}
				<li class="warning-item">
					<AlertTriangle size={12} />
					<span class="warning-type">{w.type}</span>
					<span class="warning-msg">{w.message}</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
		white-space: nowrap;
		overflow: hidden;
	}

	.status-item {
		letter-spacing: 0.02em;
	}

	.status-sep {
		color: var(--borderColor-muted);
	}

	.status-spacer {
		flex: 1;
	}

	.status-item--add { color: var(--fgColor-success); }
	.status-item--rm { color: var(--fgColor-danger); }
	.status-item--mod { color: var(--fgColor-attention); }

	/* ─── Shortcuts ────────────────────────────── */
	.status-shortcuts {
		display: inline-flex;
		align-items: center;
		background: none;
		border: none;
		padding: 0;
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition: color 100ms ease;
	}

	.status-shortcuts:hover {
		color: var(--fgColor-default);
	}

	.shortcuts-panel {
		position: absolute;
		bottom: 100%;
		right: 0;
		width: 280px;
		background: var(--overlay-bgColor);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		box-shadow: var(--shadow-floating-large);
		z-index: 50;
	}

	.shortcuts-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-default);
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.shortcuts-close {
		background: none;
		border: none;
		color: var(--fgColor-muted);
		font-size: 14px;
		cursor: pointer;
		line-height: 1;
	}

	.shortcuts-list {
		padding: 6px 0;
		margin: 0;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 12px;
		gap: 12px;
	}

	.shortcut-keys {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.shortcut-keys kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: 3px;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-muted);
	}

	.shortcut-plus {
		font-size: 9px;
		color: var(--fgColor-disabled);
		margin: 0 1px;
	}

	.shortcut-desc {
		font-size: 11px;
		color: var(--fgColor-muted);
		text-align: right;
		margin: 0;
	}

	/* ─── Warnings ─────────────────────────────── */
	.status-warnings {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		padding: 0;
		color: var(--fgColor-attention);
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		cursor: pointer;
	}

	.status-warnings:hover {
		text-decoration: underline;
	}

	.warnings-panel {
		position: absolute;
		bottom: 100%;
		right: 0;
		width: 420px;
		max-height: 200px;
		background: var(--overlay-bgColor);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		box-shadow: var(--shadow-floating-large);
		overflow: auto;
		z-index: 50;
	}

	.warnings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-attention);
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.warnings-close {
		background: none;
		border: none;
		color: var(--fgColor-muted);
		font-size: 14px;
		cursor: pointer;
		line-height: 1;
	}

	.warnings-list {
		list-style: none;
		margin: 0;
		padding: 4px 0;
	}

	.warning-item {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 4px 10px;
		font-size: 11px;
		color: var(--fgColor-default);
		line-height: 1.4;
	}

	.warning-item :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--fgColor-attention);
	}

	.warning-type {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 9px;
		color: var(--fgColor-attention);
		padding: 1px 4px;
		background: var(--bgColor-attention-muted);
		border-radius: 3px;
		flex-shrink: 0;
	}

	.warning-msg {
		word-break: break-word;
	}

	@media (max-width: 767px) {
		.status-bar {
			justify-content: center;
			gap: 6px;
			font-size: 9px;
		}

		.status-spacer {
			display: none;
		}

		.warnings-panel {
			width: calc(100vw - 20px);
			right: -10px;
		}
	}
</style>
