<script lang="ts">
	import { Home, ClipboardCopy, Download, GitPullRequest } from 'lucide-svelte';
	import type { GeneratedFile, GenerationMode } from '$lib/types.js';
	import type { DiffLine, TokenModification } from '$lib/diff-utils.js';
	import { diffStats as computeDiffStats } from '$lib/diff-utils.js';

	interface ThemeOption {
		id: string;
		label: string;
		bg: string;
		mode: 'dark' | 'light';
	}

	interface Props {
		visibleFiles: GeneratedFile[];
		activeTab: string;
		diffs: Record<string, DiffLine[]>;
		modifications: Record<string, TokenModification[]>;
		hasDualMode: boolean;
		activeMode: GenerationMode;
		themes: readonly ThemeOption[];
		selectedTheme: string;
		showThemePicker: boolean;
		sendingPrs: boolean;
		hasDiffs: boolean;
		onBackToHome?: () => void;
		onTabSelect: (f: string) => void;
		onTabKeydown: (e: KeyboardEvent) => void;
		onModeChange: (mode: GenerationMode) => void;
		onThemePickerToggle: () => void;
		onChangeTheme: (id: string) => void;
		onCopyFile: () => void;
		onDownloadZip: () => void;
		onCopyChangelog: () => void;
		onSendPRs: () => void;
	}

	let {
		visibleFiles, activeTab, diffs, modifications,
		hasDualMode, activeMode, themes, selectedTheme, showThemePicker,
		sendingPrs, hasDiffs, onBackToHome, onTabSelect, onTabKeydown,
		onModeChange, onThemePickerToggle, onChangeTheme,
		onCopyFile, onDownloadZip, onCopyChangelog, onSendPRs
	}: Props = $props();
</script>

<div class="file-tabs-bar">
	{#if onBackToHome}
		<button class="home-btn" onclick={onBackToHome} title="Back to home" aria-label="Back to home">
			<Home size={13} strokeWidth={2} />
		</button>
	{/if}
	<div class="file-tabs" role="tablist" aria-label="Open files">
		{#each visibleFiles as file (file.filename)}
			{@const dotColor = file.format === 'scss' ? '#F06090' : file.format === 'css' ? '#2196F3' : file.format === 'typescript' ? '#3178C6' : file.format === 'swift' ? '#FF8040' : file.format === 'kotlin' ? '#B060FF' : '#4D9EFF'}
			{@const fileDiffs = diffs[file.filename]}
			{@const fileDiffStats = fileDiffs ? computeDiffStats(fileDiffs, modifications[file.filename]) : null}
			<button
				class="file-tab"
				class:file-tab--active={activeTab === file.filename}
				role="tab"
				aria-selected={activeTab === file.filename}
				onclick={() => onTabSelect(file.filename)}
				onkeydown={onTabKeydown}
				style="--tab-accent: {dotColor}"
			>
				<span class="tab-dot" style="background: {dotColor}"></span>
				{file.filename}
				{#if fileDiffStats && (fileDiffStats.added > 0 || fileDiffStats.removed > 0)}
					<span class="tab-diff-pill" title="+{fileDiffStats.added} / -{fileDiffStats.removed}">
						{fileDiffStats.added + fileDiffStats.removed}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if hasDualMode}
		<div class="mode-toggle" role="group" aria-label="Generation mode">
			<button
				class="mode-btn"
				class:mode-btn--active={activeMode === 'matched'}
				onclick={() => onModeChange('matched')}
			>
				Your conventions
			</button>
			<button
				class="mode-btn"
				class:mode-btn--active={activeMode === 'best-practices'}
				onclick={() => onModeChange('best-practices')}
			>
				Best practices
			</button>
		</div>
	{/if}

	<div class="tab-actions">
		<div class="theme-picker">
			<button
				class="theme-btn"
				onclick={onThemePickerToggle}
				title="Change editor theme"
				aria-label="Change editor theme"
			>
				<span class="theme-dot" style="background: {themes.find(t => t.id === selectedTheme)?.bg ?? '#22272e'}"></span>
			</button>
			{#if showThemePicker}
				<div class="theme-menu" role="menu" aria-label="Editor themes">
					<span class="theme-group-label">Dark</span>
					{#each themes.filter(t => t.mode === 'dark') as t (t.id)}
						<button class="theme-option" class:theme-option--active={selectedTheme === t.id} role="menuitem" onclick={() => onChangeTheme(t.id)}>
							<span class="theme-dot" style="background: {t.bg}"></span>
							{t.label}
						</button>
					{/each}
					<span class="theme-group-label">Light</span>
					{#each themes.filter(t => t.mode === 'light') as t (t.id)}
						<button class="theme-option" class:theme-option--active={selectedTheme === t.id} role="menuitem" onclick={() => onChangeTheme(t.id)}>
							<span class="theme-dot" style="background: {t.bg}"></span>
							{t.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<button class="ctrl-btn" onclick={onCopyFile} title="Copy file to clipboard">
			<ClipboardCopy size={12} strokeWidth={2} />
			Copy
		</button>

		<button class="ctrl-btn" onclick={onDownloadZip} title="Download ZIP">
			<Download size={12} strokeWidth={2} />
			ZIP
		</button>

		{#if hasDiffs}
			<button class="ctrl-btn" onclick={onCopyChangelog} title="Copy changelog">
				<ClipboardCopy size={12} strokeWidth={2} />
				Changelog
			</button>

			<button class="ctrl-btn ctrl-btn--primary" onclick={onSendPRs} disabled={sendingPrs} title="Create pull requests">
				{#if sendingPrs}
					<span class="btn-spinner"></span>
				{:else}
					<GitPullRequest size={12} strokeWidth={2} />
				{/if}
				PR
			</button>
		{/if}
	</div>
</div>

<style>
	.file-tabs-bar {
		display: flex;
		align-items: center;
		background: var(--bgColor-default);
		border-bottom: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
		min-height: 36px;
		position: relative;
	}

	.home-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 28px;
		flex-shrink: 0;
		background: none;
		border: none;
		border-right: 1px solid var(--borderColor-muted);
		color: var(--fgColor-muted);
		cursor: pointer;
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.home-btn:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.file-tabs {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		mask-image: linear-gradient(to right, transparent 0, black 8px, black calc(100% - 4px), transparent 100%);
		-webkit-mask-image: linear-gradient(to right, transparent 0, black 8px, black calc(100% - 4px), transparent 100%);
	}

	.file-tabs::-webkit-scrollbar {
		display: none;
	}

	.file-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px 8px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		color: var(--fgColor-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: color var(--transition-fast), border-color var(--transition-fast);
	}

	.file-tab:hover {
		color: var(--fgColor-default);
	}

	.file-tab--active {
		color: var(--fgColor-default);
		border-bottom-color: var(--tab-accent, var(--brand-color, var(--fgColor-accent)));
	}

	.tab-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		opacity: 0.5;
	}

	.file-tab--active .tab-dot {
		opacity: 1;
	}

	.tab-diff-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		font-family: var(--font-code);
		font-size: 9px;
		font-weight: 600;
		color: var(--fgColor-attention);
		background: color-mix(in srgb, var(--fgColor-attention) 10%, transparent);
		border-radius: 100px;
		line-height: 1;
	}

	.tab-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		flex-shrink: 0;
	}

	.mode-toggle {
		display: flex;
		align-items: center;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-md);
		padding: 2px;
		gap: 2px;
		flex-shrink: 0;
		margin-right: 4px;
	}

	.mode-btn {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		padding: 3px 10px;
		background: transparent;
		border: none;
		border-radius: calc(var(--radius-md) - 2px);
		color: var(--fgColor-disabled);
		cursor: pointer;
		white-space: nowrap;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.mode-btn:hover {
		color: var(--fgColor-muted);
	}

	.mode-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-default);
		box-shadow: var(--shadow-button);
	}

	.theme-picker { position: relative; display: flex; align-items: center; }

	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		background: transparent;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: border-color var(--transition-default);
	}

	.theme-btn:hover { border-color: var(--borderColor-default); }

	.theme-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.15);
		flex-shrink: 0;
	}

	.theme-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 50;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-md);
		padding: 4px;
		min-width: 140px;
		box-shadow: var(--shadow-panel);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.theme-option {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 5px 9px;
		font-family: var(--font-display);
		font-size: 10px;
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background var(--transition-fast);
	}

	.theme-option:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}

	.theme-option--active {
		color: var(--fgColor-default);
		background: var(--control-bgColor-rest);
	}

	.theme-option--active::after {
		content: '✓';
		margin-left: auto;
		font-size: 9px;
		color: var(--fgColor-accent);
	}

	.theme-group-label {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 600;
		color: var(--fgColor-disabled);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 6px 10px 2px;
		user-select: none;
	}

	.ctrl-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		color: var(--fgColor-muted);
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		border-radius: var(--radius-md);
		padding: 3px 8px;
		cursor: pointer;
		white-space: nowrap;
		transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
	}

	.ctrl-btn:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-emphasis);
		background: var(--control-bgColor-hover);
	}

	.ctrl-btn--primary {
		background: var(--bgColor-accent-muted);
		border-color: color-mix(in srgb, var(--borderColor-accent-emphasis) 40%, transparent);
		color: var(--fgColor-accent);
	}

	.ctrl-btn--primary:hover {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 80%, var(--bgColor-accent-emphasis));
		color: var(--fgColor-onEmphasis);
	}

	.ctrl-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-spinner {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 1.5px solid color-mix(in srgb, var(--fgColor-accent) 30%, transparent);
		border-top-color: var(--fgColor-accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 1199px) {
		.file-tab {
			max-width: 140px;
		}
	}

	@media (max-width: 767px) {
		.file-tab {
			max-width: 110px;
			padding: 6px 8px 8px;
			font-size: 10px;
		}
	}
</style>
