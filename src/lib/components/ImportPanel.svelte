<script lang="ts">
	import { Check, X, RotateCcw, ChevronRight, ChevronDown, AlertTriangle, RefreshCw, Trash2, Save, FolderOpen, Upload } from 'lucide-svelte';
	import type { Platform, DropZoneKey, FileSlot, OutputCategory } from '$lib/types.js';
	import type { FileInsight } from '$lib/file-validation.js';

	interface PlatformOption {
		id: Platform;
		label: string;
		color: string;
		icon: string;
		techIcons: { svg: string; color: string; label: string }[];
	}

	interface Props {
		slots: Record<DropZoneKey, FileSlot>;
		visibleKeys: DropZoneKey[];
		refKeys: DropZoneKey[];
		fileInsights: Partial<Record<DropZoneKey, FileInsight>>;
		platforms: PlatformOption[];
		selectedPlatforms: Platform[];
		hasRefFiles: boolean;
		bulkDropActive: boolean;
		canGenerate: boolean;
		loading: boolean;
		errorMsg: string | null;
		requiredFilled: number;
		iconFigma: string;
		onDragEnter: (key: DropZoneKey, e: DragEvent) => void;
		onDragOver: (key: DropZoneKey, e: DragEvent) => void;
		onDragLeave: (key: DropZoneKey) => void;
		onDrop: (key: DropZoneKey, e: DragEvent) => void;
		onFileInput: (key: DropZoneKey, e: Event) => void;
		onClearFile: (key: DropZoneKey, e: MouseEvent) => void;
		onBulkDragEnter: (e: DragEvent) => void;
		onBulkDragOver: (e: DragEvent) => void;
		onBulkDragLeave: (e: DragEvent) => void;
		onBulkDrop: (e: DragEvent) => void;
		selectedOutputs: OutputCategory[];
		onToggleOutput: (cat: OutputCategory) => void;
		onExportConfig: () => void;
		onImportConfig: (e: Event) => void;
		onClearAll: () => void;
		onGenerate: () => void;
		storedTokenVersion: number | null;
		storedTokenPushedAt: string | null;
		storedTokenVersions: Array<{ sha: string; version: number; pushedAt: string; message: string }>;
		storedTokensLoading: boolean;
		tokenChangeSummary: string | null;
		onRefreshStoredTokens: () => void;
		onLoadTokenVersion: (sha: string) => void;
	}

	let {
		slots, visibleKeys, refKeys, fileInsights, platforms, selectedPlatforms,
		hasRefFiles, bulkDropActive, canGenerate, loading, errorMsg,
		requiredFilled, iconFigma,
		onDragEnter, onDragOver, onDragLeave, onDrop, onFileInput, onClearFile,
		onBulkDragEnter, onBulkDragOver, onBulkDragLeave, onBulkDrop,
		selectedOutputs, onToggleOutput,
		onExportConfig, onImportConfig, onClearAll, onGenerate,
		storedTokenVersion, storedTokenPushedAt, storedTokenVersions, storedTokensLoading,
		tokenChangeSummary,
		onRefreshStoredTokens, onLoadTokenVersion
	}: Props = $props();

	let showVersionPicker = $state(false);
	let tokensCollapsedOverride = $state<boolean | null>(null);
	let tokensCollapsed = $derived(tokensCollapsedOverride ?? storedTokenVersion !== null);

	function setTokensCollapsed(val: boolean) {
		tokensCollapsedOverride = val;
	}

	let refVisible = $derived(visibleKeys.some((k) => refKeys.includes(k)));
	let activePlatform = $derived(platforms.find((p) => selectedPlatforms.includes(p.id)));

	function formatTokenDate(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60_000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHrs = Math.floor(diffMins / 60);
		if (diffHrs < 24) return `${diffHrs}h ago`;
		const diffDays = Math.floor(diffHrs / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function extColor(ext: string): string {
		if (ext === 'scss') return '#F06090';
		if (ext === 'ts') return '#4D9EFF';
		if (ext === 'swift') return '#FF8040';
		if (ext === 'kt') return '#B060FF';
		return '#F5A623';
	}


</script>

<div class="import-panel">
	<div class="panel-header">
		<span class="panel-title">Token files</span>
		<div class="panel-actions">
			<button class="panel-icon-btn" onclick={onExportConfig} title="Export config" aria-label="Export config"><Save size={12} strokeWidth={2} /></button>
			<label class="panel-icon-btn" for="import-config-input" title="Import config" aria-label="Import config">
				<FolderOpen size={12} strokeWidth={2} />
				<input id="import-config-input" type="file" accept=".json,application/json" class="sr-only" onchange={onImportConfig} />
			</label>
			<button class="panel-icon-btn" onclick={onClearAll} title="Clear all" aria-label="Clear all"><Trash2 size={12} strokeWidth={2} /></button>
		</div>
	</div>

	<div class="output-area">
		<span class="output-label">Generate</span>
		<div class="output-toggles">
			<button
				class="output-chip"
				class:output-chip--active={selectedOutputs.includes('colors')}
				onclick={() => onToggleOutput('colors')}
			>
				<span class="output-chip-dot" style="background: var(--fgColor-accent)"></span>
				Colors
			</button>
			<button
				class="output-chip"
				class:output-chip--active={selectedOutputs.includes('typography')}
				onclick={() => onToggleOutput('typography')}
			>
				<span class="output-chip-dot" style="background: #F5A623"></span>
				Typography
			</button>
		</div>
	</div>

	<div
		class="file-list"
		ondragenter={onBulkDragEnter}
		ondragover={onBulkDragOver}
		ondragleave={onBulkDragLeave}
		ondrop={onBulkDrop}
		role="region"
	>
		{#if bulkDropActive}
			<div class="bulk-overlay">
				<span class="bulk-label">Drop Figma JSON files to auto-assign</span>
			</div>
		{/if}

		{#if storedTokenVersion !== null && tokensCollapsed}
			<!-- When tokens are pre-loaded: reference files come FIRST, then the collapsed token bar -->
			{#if refVisible}
				<div class="section-label section-label--ref section-label--promoted">
					<span class="section-brand">
						{#if activePlatform}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<span class="section-platform-icon" style="color: {activePlatform.color}">{@html activePlatform.icon}</span>
						{/if}
						Your files
					</span>
					<span class="section-sub">Match your conventions</span>
				</div>
				{#if !hasRefFiles}
					<div class="ref-callout ref-callout--prominent" style="--callout-accent: {activePlatform?.color ?? 'var(--fgColor-accent)'}">
						Drop your current code files to match naming and formatting conventions
					</div>
				{/if}
			{#each visibleKeys.filter((k) => refKeys.includes(k)) as key (key)}
				{@const slot = slots[key]}
				{@const filled = !!slot.file}
				{@const insight = fileInsights[key]}
				<label
					class="file-row file-row--ref"
					class:file-row--filled={filled}
					class:file-row--restored={slot.restored}
					class:file-row--dragging={slot.dragging}
					class:file-row--dropzone={!filled}
					ondragenter={(e) => onDragEnter(key, e)}
					ondragover={(e) => onDragOver(key, e)}
					ondragleave={() => onDragLeave(key)}
					ondrop={(e) => onDrop(key, e)}
				>
					<input type="file" accept={slot.accept} class="sr-only" onchange={(e) => onFileInput(key, e)} />
					{#if filled}
						<span class="ext-dot" style="background-color: {extColor(slot.ext)}" title=".{slot.ext}"></span>
					{:else}
						<span class="dropzone-icon"><Upload size={12} strokeWidth={1.5} /></span>
					{/if}
					<div class="file-meta">
						<span class="file-label">{slot.label}</span>
						<span class="file-hint">{slot.hint}</span>
					</div>
					<div class="file-action">
						{#if filled}
							{#if insight}
								<span class="file-insight">{insight.count} {insight.label}</span>
							{/if}
							<span class="file-loaded" class:file-loaded--restored={slot.restored}>
								{#if slot.restored}
									<span class="restored-icon"><RotateCcw size={10} strokeWidth={2} /></span>
								{:else}
									<Check size={10} strokeWidth={2} />
								{/if}
								{slot.file!.name.length > 18 ? slot.file!.name.slice(0, 15) + '…' : slot.file!.name}
							</span>
							<button class="file-clear" onclick={(e) => onClearFile(key, e)} aria-label="Remove"><X size={10} strokeWidth={2} /></button>
						{:else}
							<span class="file-cta file-cta--upload">{slot.dragging ? 'Drop it' : 'Click or drag'}</span>
						{/if}
					</div>
				</label>
			{/each}
		{/if}

		<button class="tokens-collapsed-bar" onclick={() => setTokensCollapsed(false)}>
				<span class="tokens-collapsed-left">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html iconFigma}
					<span class="tokens-collapsed-summary">
						{requiredFilled + (slots.typography?.file ? 1 : 0)} files loaded from v{storedTokenVersion}
					</span>
					{#if storedTokenVersions.length > 0 && storedTokenVersions[0]?.version === storedTokenVersion}
						<span class="stored-latest-tag">Latest</span>
					{/if}
					{#if storedTokenPushedAt}
						<span class="stored-date">{formatTokenDate(storedTokenPushedAt)}</span>
					{/if}
				</span>
				<span class="tokens-collapsed-chevron"><ChevronRight size={10} strokeWidth={2} /></span>
			</button>
		{:else}
			<!-- Normal expanded view: Figma export first, then reference files -->
			<div class="section-label">
				<span class="section-brand">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html iconFigma}
					Figma export
				</span>
				{#if storedTokenVersion !== null}
					<button class="section-collapse-btn" onclick={() => setTokensCollapsed(true)} title="Collapse"><ChevronDown size={12} strokeWidth={2} /></button>
				{/if}
				<span class="section-sub">Required: Light · Dark · Value</span>
			</div>

			{#if storedTokenVersion !== null}
				<div class="stored-tokens-bar">
					<div class="stored-tokens-info">
						<span class="stored-version-badge">v{storedTokenVersion}</span>
						{#if storedTokenPushedAt}
							<span class="stored-date">{formatTokenDate(storedTokenPushedAt)}</span>
						{/if}
						{#if storedTokenVersions.length > 0 && storedTokenVersions[0]?.version === storedTokenVersion}
							<span class="stored-latest-tag">Latest</span>
						{/if}
						{#if tokenChangeSummary}
							<span class="token-change-summary">{tokenChangeSummary}</span>
						{/if}
					</div>
					<div class="stored-tokens-actions">
						{#if storedTokenVersions.length > 1}
							<div class="version-picker-wrap">
								<button
									class="stored-action-btn"
									onclick={() => (showVersionPicker = !showVersionPicker)}
									disabled={storedTokensLoading}
								>
									{showVersionPicker ? 'Close' : 'Versions'}
								</button>
								{#if showVersionPicker}
									<div class="version-picker-dropdown">
										{#each storedTokenVersions as ver (ver.sha)}
											<button
												class="version-picker-item"
												class:version-picker-item--active={ver.version === storedTokenVersion}
												onclick={() => { onLoadTokenVersion(ver.sha); showVersionPicker = false; }}
												disabled={storedTokensLoading}
											>
												<span class="version-picker-v">v{ver.version}</span>
												<span class="version-picker-date">{formatTokenDate(ver.pushedAt)}</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
						<button
							class="stored-action-btn"
							onclick={onRefreshStoredTokens}
							disabled={storedTokensLoading}
							title="Fetch latest from GitHub"
						>
							{#if storedTokensLoading}…{:else}<RefreshCw size={10} strokeWidth={2} />{/if}
						</button>
					</div>
				</div>
			{/if}

			{#each ['lightColors', 'darkColors', 'values', 'typography'] as key (key)}
				{@const dk = key as DropZoneKey}
				{@const slot = slots[dk]}
				{@const filled = !!slot.file}
				{@const insight = fileInsights[dk]}
				<label
					class="file-row"
					class:file-row--filled={filled}
					class:file-row--dragging={slot.dragging}
					class:file-row--optional={!slot.required}
					ondragenter={(e) => onDragEnter(dk, e)}
					ondragover={(e) => onDragOver(dk, e)}
					ondragleave={() => onDragLeave(dk)}
					ondrop={(e) => onDrop(dk, e)}
				>
					<input type="file" accept={slot.accept} class="sr-only" onchange={(e) => onFileInput(dk, e)} />
					<span class="ext-dot" style="background-color: {extColor(slot.ext)}" title=".{slot.ext}"></span>
					<div class="file-meta">
						<span class="file-label">{slot.label}</span>
						<span class="file-hint">{slot.hint}</span>
					</div>
					<div class="file-action">
						{#if filled}
							{#if slot.warning}
								<span class="file-warn" title={slot.warning}><AlertTriangle size={14} strokeWidth={2} /></span>
							{/if}
							{#if insight}
								<span class="file-insight">{insight.count} {insight.label}</span>
							{/if}
							<span class="file-loaded">
								<Check size={10} strokeWidth={2} />
								{slot.file!.name.length > 18 ? slot.file!.name.slice(0, 15) + '…' : slot.file!.name}
							</span>
							<button class="file-clear" onclick={(e) => onClearFile(dk, e)} aria-label="Remove"><X size={10} strokeWidth={2} /></button>
						{:else}
							<span class="file-cta" class:file-cta--drag={slot.dragging}>
								{slot.dragging ? 'Drop it' : slot.required ? 'Click or drag' : 'Optional'}
							</span>
						{/if}
					</div>
				</label>
			{/each}

			{#if refVisible}
			<div class="section-label section-label--ref">
				<span class="section-brand">
					{#if activePlatform}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<span class="section-platform-icon" style="color: {activePlatform.color}">{@html activePlatform.icon}</span>
					{/if}
					Reference files
				</span>
				<span class="section-sub">Optional — naming convention detection</span>
			</div>
			{#each visibleKeys.filter((k) => refKeys.includes(k)) as key (key)}
				{@const slot = slots[key]}
				{@const filled = !!slot.file}
				{@const insight = fileInsights[key]}
				<label
					class="file-row file-row--ref"
					class:file-row--filled={filled}
					class:file-row--restored={slot.restored}
					class:file-row--dragging={slot.dragging}
					class:file-row--dropzone={!filled}
					ondragenter={(e) => onDragEnter(key, e)}
					ondragover={(e) => onDragOver(key, e)}
					ondragleave={() => onDragLeave(key)}
					ondrop={(e) => onDrop(key, e)}
				>
					<input type="file" accept={slot.accept} class="sr-only" onchange={(e) => onFileInput(key, e)} />
					{#if filled}
						<span class="ext-dot" style="background-color: {extColor(slot.ext)}" title=".{slot.ext}"></span>
					{:else}
						<span class="dropzone-icon"><Upload size={12} strokeWidth={1.5} /></span>
					{/if}
					<div class="file-meta">
						<span class="file-label">{slot.label}</span>
						<span class="file-hint">{slot.hint}</span>
					</div>
					<div class="file-action">
						{#if filled}
							{#if insight}
								<span class="file-insight">{insight.count} {insight.label}</span>
							{/if}
							<span class="file-loaded" class:file-loaded--restored={slot.restored}>
								{#if slot.restored}
									<span class="restored-icon"><RotateCcw size={10} strokeWidth={2} /></span>
								{:else}
									<Check size={10} strokeWidth={2} />
								{/if}
								{slot.file!.name.length > 18 ? slot.file!.name.slice(0, 15) + '…' : slot.file!.name}
							</span>
							<button class="file-clear" onclick={(e) => onClearFile(key, e)} aria-label="Remove"><X size={10} strokeWidth={2} /></button>
						{:else}
							<span class="file-cta file-cta--upload">{slot.dragging ? 'Drop it' : 'Click or drag'}</span>
						{/if}
					</div>
				</label>
			{/each}
		{/if}
	{/if}

	</div>

	{#if errorMsg}
		<div class="error-area">
			<div class="error-row">
				<span class="error-prefix">Error</span>
				{errorMsg}
			</div>
		</div>
	{/if}
</div>

<style>
	.import-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.panel-title {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: 600;
		color: var(--fgColor-muted);
	}

	.panel-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.panel-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--borderRadius-small);
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition: color 100ms ease, border-color 100ms ease, background 100ms ease;
	}

	.panel-icon-btn:hover {
		color: var(--fgColor-muted);
		border-color: var(--borderColor-muted);
		background: var(--bgColor-muted);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		clip: rect(0 0 0 0);
		overflow: hidden;
	}

	/* ─── Output Toggles ────────────────────────── */
	.output-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px;
		margin: 0 10px 6px;
	}

	.output-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--fgColor-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.output-toggles {
		display: flex;
		gap: 4px;
	}

	.output-chip {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 10px;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		font-family: var(--fontStack-sansSerif);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-muted);
		cursor: pointer;
		transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
	}

	.output-chip:hover {
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	.output-chip--active {
		background: var(--control-bgColor-rest);
		border-color: var(--borderColor-default);
		color: var(--fgColor-default);
		font-weight: 600;
		box-shadow: var(--shadow-floating-small);
	}

	.output-chip-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		opacity: 0.4;
		transition: opacity 150ms ease;
	}

	.output-chip--active .output-chip-dot {
		opacity: 1;
	}

	/* ─── File List ──────────────────────────────── */
	.file-list {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--fgColor-disabled) 30%, transparent) transparent;
	}

	.bulk-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--bgColor-accent-muted) 60%, transparent);
		backdrop-filter: blur(4px);
		z-index: 10;
		border-radius: var(--borderRadius-medium);
	}

	.bulk-label {
		font-size: var(--base-text-size-sm);
		font-weight: 600;
		color: var(--fgColor-accent);
	}

	/* ─── Section Labels ─────────────────────────── */
	/* ─── Collapsed Tokens Bar ──────────────────── */
	.tokens-collapsed-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--bgColor-accent-muted) 30%, var(--bgColor-inset));
		border-bottom: 1px solid var(--borderColor-muted);
		cursor: pointer;
		border: none;
		width: 100%;
		text-align: left;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-muted);
		transition: background var(--base-duration-100) var(--base-easing-ease);
	}

	.tokens-collapsed-bar:hover {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 50%, var(--bgColor-inset));
	}

	.tokens-collapsed-left {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.tokens-collapsed-summary {
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.tokens-collapsed-chevron {
		font-size: 10px;
		color: var(--fgColor-disabled);
		transition: transform var(--base-duration-100) var(--base-easing-ease);
	}

	.section-collapse-btn {
		background: none;
		border: none;
		font-size: 10px;
		color: var(--fgColor-disabled);
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}

	.section-collapse-btn:hover {
		color: var(--fgColor-muted);
	}

	.section-label {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		background: var(--bgColor-inset);
		border-bottom: 1px solid var(--borderColor-muted);
		font-size: var(--base-text-size-xs);
		font-weight: 500;
		color: var(--fgColor-disabled);
	}

	.section-label--ref {
		border-top: 1px solid var(--borderColor-muted);
	}

	.section-label--promoted {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 30%, var(--bgColor-inset));
		color: var(--fgColor-default);
	}

	.ref-callout {
		padding: 8px 14px;
		font-size: 11px;
		color: var(--callout-accent, var(--fgColor-accent));
		background: color-mix(in srgb, var(--callout-accent, var(--fgColor-accent)) 8%, transparent);
		border-left: 2px solid var(--callout-accent, var(--fgColor-accent));
	}

	.ref-callout--prominent {
		padding: 10px 14px;
		font-size: 12px;
		font-weight: 500;
		border-left-width: 3px;
	}

	.section-brand {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
	}

	.section-platform-icon {
		display: flex;
		align-items: center;
		opacity: 0.85;
	}

	.section-sub {
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		opacity: 0.6;
	}

	/* ─── File Rows ──────────────────────────────── */
	.file-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 14px;
		cursor: pointer;
		border-bottom: 1px solid var(--borderColor-muted);
		transition: background var(--base-duration-100) var(--base-easing-ease);
		position: relative;
	}

	.file-row:last-child {
		border-bottom: none;
	}

	.file-row:hover {
		background: var(--control-bgColor-rest);
	}

	.file-row--ref {
		background: var(--bgColor-inset);
	}

	.file-row--dropzone {
		border: 1px dashed var(--borderColor-default);
		border-bottom: 1px dashed var(--borderColor-default);
		border-radius: var(--borderRadius-small);
		margin: 4px 10px;
		padding: 10px 12px;
		background: color-mix(in srgb, var(--bgColor-inset) 50%, transparent);
		transition: background var(--base-duration-100) var(--base-easing-ease), border-color var(--base-duration-100) var(--base-easing-ease);
	}

	.file-row--dropzone:hover {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 20%, var(--bgColor-inset));
		border-color: var(--fgColor-accent);
	}

	.file-row--dropzone:hover .dropzone-icon {
		color: var(--fgColor-accent);
	}

	.file-row--dropzone:hover .file-cta--upload {
		color: var(--fgColor-accent);
	}

	.file-row--dragging {
		background: var(--control-bgColor-hover);
		outline: 1px dashed var(--borderColor-default);
		outline-offset: -2px;
	}

	.file-row--dropzone.file-row--dragging {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 40%, var(--bgColor-inset));
		border-color: var(--fgColor-accent);
		border-style: solid;
		outline: none;
	}

	.file-row--filled {
		background: var(--bgColor-default);
	}

	.file-row--ref.file-row--filled {
		background: var(--bgColor-inset);
	}

	.file-row--filled::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--brand-color);
		animation: row-fill 0.25s ease-out;
	}

	.file-row--restored::before {
		background: var(--fgColor-accent);
	}

	@keyframes row-fill {
		from { transform: scaleY(0); }
		to { transform: scaleY(1); }
	}

	.dropzone-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--fgColor-disabled);
		margin-top: 1px;
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}

	.ext-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		opacity: 0.5;
		margin-top: 5px;
		transition: opacity var(--base-duration-200) var(--base-easing-ease);
	}

	.file-row--filled .ext-dot {
		opacity: 1;
	}

	.file-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.file-label {
		font-family: var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		font-weight: 500;
		color: var(--fgColor-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--base-duration-200) var(--base-easing-ease);
	}

	.file-row--filled .file-label {
		color: var(--fgColor-default);
	}

	.file-hint {
		font-family: var(--fontStack-sansSerif);
		font-size: 10px;
		color: var(--fgColor-disabled);
	}

	.file-action {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.file-cta {
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		white-space: nowrap;
	}

	.file-cta--drag {
		color: var(--fgColor-muted);
	}

	.file-cta--upload {
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-muted);
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}

	.file-loaded {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-success);
		max-width: 140px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.file-loaded--restored {
		color: var(--fgColor-accent);
	}

	.restored-icon {
		font-size: var(--base-text-size-xs);
		opacity: 0.8;
	}

	.file-clear {
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		font-size: 10px;
		padding: 2px 4px;
		border-radius: 2px;
		transition: color var(--base-duration-100) var(--base-easing-ease), background var(--base-duration-100) var(--base-easing-ease);
	}

	.file-clear:hover {
		color: var(--brand-color);
		background: var(--bgColor-danger-muted);
	}

	.file-warn {
		font-size: 14px;
		line-height: 1;
		cursor: help;
		flex-shrink: 0;
		filter: saturate(2);
	}

	.file-insight {
		font-size: 10px;
		font-weight: 500;
		color: var(--fgColor-disabled);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.file-row--optional:not(.file-row--filled) .ext-dot {
		opacity: 0.4;
	}

	.file-row--optional:not(.file-row--filled) .file-label {
		opacity: 0.6;
	}

	/* ─── Error Area ─────────────────────────────── */
	.error-area {
		padding: 10px 14px;
		border-top: 1px solid var(--borderColor-muted);
	}

	.error-row {
		display: flex;
		gap: 8px;
		padding: 8px 10px;
		background: var(--bgColor-danger-muted);
		border: 1px solid var(--borderColor-danger-muted);
		border-radius: var(--borderRadius-small);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-danger);
	}

	.error-prefix {
		font-weight: 700;
		flex-shrink: 0;
	}

	/* ─── Responsive: small ──────────────────────── */
	@media (max-width: 767px) {
		.import-panel {
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}
	}

	/* ─── Stored Tokens Bar ─────────────────────── */
	.stored-tokens-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		margin: 0 0 2px;
		background: color-mix(in srgb, var(--bgColor-accent-muted) 40%, transparent);
		border-radius: 6px;
		gap: 8px;
	}

	.stored-tokens-info {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.stored-version-badge {
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-accent);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 60%, transparent);
		padding: 1px 6px;
		border-radius: 4px;
		white-space: nowrap;
	}

	.stored-date {
		font-size: 10px;
		color: var(--fgColor-muted);
		white-space: nowrap;
	}

	.stored-latest-tag {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fgColor-success);
		background: color-mix(in srgb, var(--bgColor-success-muted) 50%, transparent);
		padding: 1px 5px;
		border-radius: 3px;
		white-space: nowrap;
	}

	.token-change-summary {
		font-size: 10px;
		font-weight: 500;
		color: var(--fgColor-attention);
		white-space: nowrap;
	}

	.stored-tokens-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.stored-action-btn {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-muted);
		background: none;
		border: 1px solid var(--borderColor-muted);
		border-radius: 4px;
		padding: 2px 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.stored-action-btn:hover:not(:disabled) {
		color: var(--fgColor-default);
		border-color: var(--borderColor-default);
		background: var(--bgColor-muted);
	}

	.stored-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.version-picker-wrap {
		position: relative;
	}

	.version-picker-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		min-width: 180px;
		background: var(--overlay-bgColor);
		border: 1px solid var(--borderColor-muted);
		border-radius: 8px;
		box-shadow: var(--shadow-floating-large);
		z-index: 20;
		overflow: hidden;
		max-height: 200px;
		overflow-y: auto;
	}

	.version-picker-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 8px 12px;
		font-size: 11px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--fgColor-default);
		transition: background 0.1s ease;
	}

	.version-picker-item:hover {
		background: var(--bgColor-muted);
	}

	.version-picker-item--active {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 30%, transparent);
	}

	.version-picker-v {
		font-family: var(--fontStack-monospace);
		font-weight: 600;
		color: var(--fgColor-accent);
	}

	.version-picker-date {
		color: var(--fgColor-muted);
		font-size: 10px;
	}
</style>
