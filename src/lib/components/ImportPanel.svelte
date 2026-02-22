<script lang="ts">
	import { Check } from 'lucide-svelte';
	import type { Platform, DropZoneKey, FileSlot, GithubConfigs } from '$lib/types.js';
	import type { FileInsight } from '$lib/file-validation.js';
	import SettingsPanel from './SettingsPanel.svelte';

	interface PlatformOption {
		id: Platform;
		label: string;
		color: string;
		icon: string;
	}

	interface Props {
		slots: Record<DropZoneKey, FileSlot>;
		visibleKeys: DropZoneKey[];
		refKeys: DropZoneKey[];
		fileInsights: Partial<Record<DropZoneKey, FileInsight>>;
		platforms: PlatformOption[];
		selectedPlatforms: Platform[];
		hasRefFiles: boolean;
		bestPractices: boolean;
		bulkDropActive: boolean;
		canGenerate: boolean;
		loading: boolean;
		errorMsg: string | null;
		requiredFilled: number;
		visibleFilled: number;
		figmaConnected: boolean;
		figmaFetching: boolean;
		showSettings: boolean;
		chatWebhookUrl: string;
		githubPat: string;
		githubRepos: GithubConfigs;
		figmaFileKey: string;
		figmaPat: string;
		figmaWebhookPasscode: string;
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
		onBestPracticesChange: (val: boolean) => void;
		onExportConfig: () => void;
		onImportConfig: (e: Event) => void;
		onClearAll: () => void;
		onGenerate: () => void;
		onFigmaFetch: () => void;
		onSettingsToggle: () => void;
		onChatWebhookChange: (e: Event) => void;
		onGithubPatChange: (e: Event) => void;
		onGithubRepoChange: (platform: Platform, field: string, e: Event) => void;
		onFigmaFileKeyChange: (e: Event) => void;
		onFigmaPatChange: (e: Event) => void;
		onFigmaPasscodeChange: (e: Event) => void;
	}

	let {
		slots, visibleKeys, refKeys, fileInsights, platforms, selectedPlatforms,
		hasRefFiles, bestPractices, bulkDropActive, canGenerate, loading, errorMsg,
		requiredFilled, visibleFilled, figmaConnected, figmaFetching, showSettings,
		chatWebhookUrl, githubPat, githubRepos, figmaFileKey, figmaPat, figmaWebhookPasscode,
		iconFigma,
		onDragEnter, onDragOver, onDragLeave, onDrop, onFileInput, onClearFile,
		onBulkDragEnter, onBulkDragOver, onBulkDragLeave, onBulkDrop,
		onBestPracticesChange, onExportConfig, onImportConfig, onClearAll, onGenerate,
		onFigmaFetch, onSettingsToggle,
		onChatWebhookChange, onGithubPatChange, onGithubRepoChange,
		onFigmaFileKeyChange, onFigmaPatChange, onFigmaPasscodeChange
	}: Props = $props();

	function extColor(ext: string): string {
		if (ext === 'scss') return '#F06090';
		if (ext === 'ts') return '#4D9EFF';
		if (ext === 'swift') return '#FF8040';
		if (ext === 'kt') return '#B060FF';
		return '#F5A623';
	}
</script>

<div class="import-panel">
	<div class="panel-eyebrow">
		<span>INPUT</span>
		<div class="panel-actions">
			<button class="action-link" onclick={onExportConfig} title="Export config" aria-label="Export config">↑</button>
			<label class="action-link" for="import-config-input" title="Import config" aria-label="Import config">
				↓
				<input id="import-config-input" type="file" accept=".json,application/json" class="sr-only" onchange={onImportConfig} />
			</label>
			<button class="action-link" onclick={onClearAll}>Clear</button>
		</div>
	</div>

	{#if hasRefFiles}
		<div class="best-practices-toggle">
			<label class="bp-label">
				<span class="bp-track" class:bp-track--active={bestPractices}>
					<span class="bp-thumb"></span>
				</span>
				<input type="checkbox" class="sr-only" checked={bestPractices} onchange={(e) => onBestPracticesChange((e.target as HTMLInputElement).checked)} />
				<span class="bp-text">{bestPractices ? 'Best practices' : 'Match existing'}</span>
			</label>
			<span class="bp-hint">
				{bestPractices ? 'Modern patterns (@use, type annotations)' : 'Matches your reference file conventions'}
			</span>
		</div>
	{/if}

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

		<div class="section-label">
			<span class="section-brand">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html iconFigma}
				Figma export
			</span>
			<span class="section-sub">Required: Light · Dark · Value</span>
		</div>

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
							<span class="file-warn" title={slot.warning}>⚠</span>
						{/if}
						{#if insight}
							<span class="file-insight">{insight.count} {insight.label}</span>
						{/if}
						<span class="file-loaded">
							<Check size={10} strokeWidth={2} />
							{slot.file!.name.length > 18 ? slot.file!.name.slice(0, 15) + '…' : slot.file!.name}
						</span>
						<button class="file-clear" onclick={(e) => onClearFile(dk, e)} aria-label="Remove">✕</button>
					{:else}
						<span class="file-cta" class:file-cta--drag={slot.dragging}>
							{slot.dragging ? 'Drop it' : slot.required ? 'Click or drag' : 'Optional'}
						</span>
					{/if}
				</div>
			</label>
		{/each}

		{#if visibleKeys.some((k) => refKeys.includes(k))}
			{@const activePlatform = platforms.find((p) => selectedPlatforms.includes(p.id))}
			<div class="section-label section-label--ref">
				<span class="section-brand">
					{#if activePlatform}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<span class="section-platform-icon" style="color: {activePlatform.color}">{@html activePlatform.icon}</span>
					{/if}
					Reference files
				</span>
				<span class="section-sub">Optional</span>
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
					ondragenter={(e) => onDragEnter(key, e)}
					ondragover={(e) => onDragOver(key, e)}
					ondragleave={() => onDragLeave(key)}
					ondrop={(e) => onDrop(key, e)}
				>
					<input type="file" accept={slot.accept} class="sr-only" onchange={(e) => onFileInput(key, e)} />
					<span class="ext-dot" style="background-color: {extColor(slot.ext)}" title=".{slot.ext}"></span>
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
									<span class="restored-icon">↺</span>
								{:else}
									<Check size={10} strokeWidth={2} />
								{/if}
								{slot.file!.name.length > 18 ? slot.file!.name.slice(0, 15) + '…' : slot.file!.name}
							</span>
							<button class="file-clear" onclick={(e) => onClearFile(key, e)} aria-label="Remove">✕</button>
						{:else}
							<span class="file-cta">Optional</span>
						{/if}
					</div>
				</label>
			{/each}
		{/if}

		{#if figmaConnected}
			<div class="section-label">
				<span class="section-brand">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html iconFigma} Figma API
				</span>
				<button class="figma-fetch-btn" onclick={onFigmaFetch} disabled={figmaFetching}>
					{figmaFetching ? 'Fetching…' : 'Fetch tokens'}
				</button>
			</div>
		{/if}
	</div>

	<div class="generate-area">
		{#if errorMsg}
			<div class="error-row">
				<span class="error-prefix">Error</span>
				{errorMsg}
			</div>
		{/if}

		<div class="generate-footer">
			<span class="gen-hint">{visibleFilled} of {visibleKeys.length} files loaded</span>
		</div>
	</div>
</div>

<style>
	.import-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.panel-eyebrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px 8px;
		font-family: 'JetBrains Mono', var(--fontStack-monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--fgColor-disabled);
		text-transform: uppercase;
	}

	.panel-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.action-link {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}

	.action-link:hover {
		color: var(--fgColor-muted);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		clip: rect(0 0 0 0);
		overflow: hidden;
	}

	/* ─── Best Practices Toggle ──────────────────── */
	.best-practices-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		margin: 0 10px 6px;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: 6px;
	}

	.bp-label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
	}

	.bp-track {
		position: relative;
		display: inline-block;
		width: 28px;
		height: 16px;
		background: var(--borderColor-muted);
		border-radius: 8px;
		transition: background 0.2s ease;
		flex-shrink: 0;
	}

	.bp-track--active {
		background: var(--brand-color);
	}

	.bp-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
	}

	.bp-track--active .bp-thumb {
		transform: translateX(12px);
	}

	.bp-text {
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.bp-hint {
		font-size: 10px;
		color: var(--fgColor-disabled);
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

	.figma-fetch-btn {
		margin-left: auto;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		background: var(--button-primary-bgColor-rest);
		color: var(--button-primary-fgColor-rest);
		border: 1px solid var(--button-primary-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		cursor: pointer;
	}

	.figma-fetch-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.file-row--dragging {
		background: var(--control-bgColor-hover);
		outline: 1px dashed var(--borderColor-default);
		outline-offset: -2px;
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

	/* ─── Generate Area ──────────────────────────── */
	.generate-area {
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
		margin-bottom: 8px;
	}

	.error-prefix {
		font-weight: 700;
		flex-shrink: 0;
	}

	.generate-footer {
		text-align: center;
	}

	.gen-hint {
		font-size: 10px;
		color: var(--fgColor-disabled);
	}

	/* ─── Responsive: small ──────────────────────── */
	@media (max-width: 767px) {
		.import-panel {
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}

		.generate-area {
			position: sticky;
			bottom: 0;
			background: var(--bgColor-inset);
			border-top: 1px solid var(--borderColor-muted);
			z-index: 5;
		}
	}
</style>
