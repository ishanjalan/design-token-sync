<script lang="ts">
	import { browser } from '$app/environment';
	import { Upload, Settings, Loader2, ArrowRight, Check, X, Info, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-svelte';
	import type { Platform, DropZoneKey, FileSlot, OutputCategory } from '$lib/types.js';
	import type { FileInsight } from '$lib/file-validation.js';
	import type { ValidationSummary } from '$lib/pre-validation.js';
	import { aggregateValidation } from '$lib/pre-validation.js';

	interface TechIcon {
		svg: string;
		color: string;
		label: string;
	}

	interface PlatformOption {
		id: Platform;
		label: string;
		sublabel: string;
		color: string;
		icon: string;
		techIcons: TechIcon[];
	}

	interface Props {
		platforms: PlatformOption[];
		selectedPlatforms: Platform[];
		onSelectPlatform: (id: Platform) => void;
		swatchCount: number;
		storedTokenVersion: number | null;
		storedTokenPushedAt: string | null;
		refKeys: DropZoneKey[];
		visibleKeys: DropZoneKey[];
		slots: Record<DropZoneKey, FileSlot>;
		fileInsights: Partial<Record<DropZoneKey, FileInsight>>;
		conventionHints: Partial<Record<DropZoneKey, string[]>>;
		validations: Partial<Record<DropZoneKey, ValidationSummary>>;
		hasRefFiles: boolean;
		selectedOutputs: OutputCategory[];
		onToggleOutput: (cat: OutputCategory) => void;
		tokensInitialLoading: boolean;
		canGenerate: boolean;
		loading: boolean;
		onGenerate: () => void;
		onOpenImportPanel: () => void;
		onOpenSettings: () => void;
		onDragEnter: (key: DropZoneKey, e: DragEvent) => void;
		onDragOver: (key: DropZoneKey, e: DragEvent) => void;
		onDragLeave: (key: DropZoneKey) => void;
		onDrop: (key: DropZoneKey, e: DragEvent) => void;
		onFileInput: (key: DropZoneKey, e: Event) => void;
		onClearFile: (key: DropZoneKey, e: MouseEvent) => void;
		requiredFilled: number;
	}

	let {
		platforms, selectedPlatforms, onSelectPlatform,
		swatchCount, storedTokenVersion, storedTokenPushedAt,
		refKeys, visibleKeys, slots, fileInsights, conventionHints, validations, hasRefFiles,
		selectedOutputs, onToggleOutput,
		tokensInitialLoading, canGenerate, loading, onGenerate, onOpenImportPanel, onOpenSettings,
		onDragEnter, onDragOver, onDragLeave, onDrop, onFileInput, onClearFile,
		requiredFilled
	}: Props = $props();

	const activeRefKeys = $derived(visibleKeys.filter((k) => refKeys.includes(k)));
	const tokensReady = $derived(requiredFilled === 3);
	const validationAgg = $derived(aggregateValidation(validations));

	function extColor(ext: string): string {
		if (ext === 'scss') return '#F06090';
		if (ext === 'ts') return '#4D9EFF';
		if (ext === 'swift') return '#FF8040';
		if (ext === 'kt') return '#B060FF';
		if (ext === 'css') return '#2196F3';
		return '#F5A623';
	}

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

	let showHelp = $state(false);
	if (browser) {
		showHelp = !localStorage.getItem('tokensmith:onboarded');
	}
	function dismissHelp() {
		showHelp = false;
		if (browser) localStorage.setItem('tokensmith:onboarded', '1');
	}
</script>

<div class="welcome">
	<div class="welcome-card">
		<!-- ─── Step 1: Tokens ──────────────────────────────────── -->
		<div class="step" style="animation-delay: 0ms">
			<div class="step-header">
				<span class="step-num">1</span>
				<span class="step-title">Design tokens</span>
				{#if tokensInitialLoading}
					<span class="token-badge token-badge--loading">
						<Loader2 size={11} strokeWidth={2} />
						Loading…
					</span>
				{:else if tokensReady}
					<span class="token-badge token-badge--ok">
						{#if storedTokenVersion != null}v{storedTokenVersion}{:else}Loaded{/if}
						{#if swatchCount > 0} · {swatchCount} colors{/if}
						{#if storedTokenPushedAt} · {formatTokenDate(storedTokenPushedAt)}{/if}
					</span>
				{:else}
					<span class="token-badge token-badge--empty">{requiredFilled}/3 files</span>
				{/if}
			</div>
			{#if !tokensReady && !tokensInitialLoading}
				<p class="step-hint">
					Tokens are pulled automatically from the design-tokens repo.
					<button class="inline-link" onclick={onOpenImportPanel}>Upload manually</button>
				</p>
			{/if}
		</div>

		<!-- ─── Step 2: Platform ────────────────────────────────── -->
		<div class="step" style="animation-delay: 60ms">
			<div class="step-header">
				<span class="step-num">2</span>
				<span class="step-title">Platform</span>
			</div>
			<div class="platform-row">
				{#each platforms as p (p.id)}
					<button
						class="plat-btn"
						class:plat-btn--active={selectedPlatforms.includes(p.id)}
						style="--p-color: {p.color}"
						onclick={() => onSelectPlatform(p.id)}
					>
						<span class="plat-icons">
							{#each p.techIcons as tech (tech.label)}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								<span class="plat-tech" style="color: {tech.color}" title={tech.label}>{@html tech.svg}</span>
							{/each}
						</span>
						<span class="plat-label">{p.label}</span>
						<span class="plat-sub">{p.sublabel}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- ─── Step 3: Output ──────────────────────────────────── -->
		<div class="step" style="animation-delay: 120ms">
			<div class="step-header">
				<span class="step-num">3</span>
				<span class="step-title">Output</span>
			</div>
			<div class="output-row">
				<button
					class="out-chip"
					class:out-chip--active={selectedOutputs.includes('colors')}
					onclick={() => onToggleOutput('colors')}
				>
					<span class="out-dot" style="background: var(--fgColor-accent)"></span>
					Colors
				</button>
				<button
					class="out-chip"
					class:out-chip--active={selectedOutputs.includes('typography')}
					onclick={() => onToggleOutput('typography')}
				>
					<span class="out-dot" style="background: #F5A623"></span>
					Typography
				</button>
			</div>
			{#if selectedOutputs.length === 0}
				<p class="out-warn">Select at least one</p>
			{/if}
		</div>

		<!-- ─── Step 4: Reference files ─────────────────────────── -->
		{#if activeRefKeys.length > 0}
			<div class="step" style="animation-delay: 160ms">
				<div class="step-header">
					<span class="step-num step-num--optional">4</span>
					<span class="step-title">Reference files</span>
					<span class="step-optional">optional</span>
				</div>
				<p class="step-hint">Drop your existing code files so generated output matches your architecture, naming, and patterns — ready for drop-in replacement</p>
				<div class="ref-grid">
					{#each activeRefKeys as key (key)}
						{@const slot = slots[key]}
						{@const filled = !!slot.file}
						{@const insight = fileInsights[key]}
						{@const hints = conventionHints[key]}
						{@const fileCount = slot.files.length}
						<label
							class="ref-slot"
							class:ref-slot--filled={filled}
							class:ref-slot--dragging={slot.dragging}
							ondragenter={(e) => onDragEnter(key, e)}
							ondragover={(e) => onDragOver(key, e)}
							ondragleave={() => onDragLeave(key)}
							ondrop={(e) => onDrop(key, e)}
						>
							<input type="file" accept={slot.accept} class="sr-only" multiple={slot.multiFile} onchange={(e) => onFileInput(key, e)} />
							{#if filled}
								<span class="ref-dot" style="background: {extColor(slot.ext)}"></span>
								<span class="ref-info">
									<span class="ref-name">
										{#if fileCount > 1}
											{slot.label} ({fileCount} files)
										{:else}
											{slot.file?.name ?? slot.label}
										{/if}
									</span>
									{#if hints && hints.length > 0}
										<span class="ref-hints">
											{#each hints as hint (hint)}
												<span class="ref-hint-tag">{hint}</span>
											{/each}
										</span>
									{/if}
								</span>
								{#if insight}
									<span class="ref-meta">{insight.count} {insight.label}</span>
								{/if}
								<Check size={10} strokeWidth={2.5} class="ref-check-icon" />
								<button class="ref-clear" onclick={(e) => onClearFile(key, e)} aria-label="Remove">
									<X size={9} strokeWidth={2} />
								</button>
							{:else}
								<Upload size={11} strokeWidth={1.5} />
								<span class="ref-name">{slot.label}</span>
								<span class="ref-cta">{slot.dragging ? 'Drop' : slot.multiFile ? 'Click or drag files' : 'Click or drag'}</span>
							{/if}
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ─── Generate ────────────────────────────────────────── -->
		<div class="step step--cta" style="animation-delay: {activeRefKeys.length > 0 ? 220 : 180}ms">
			<span class="mode-indicator" class:mode-indicator--match={hasRefFiles}>
				{#if hasRefFiles}
					<CheckCircle2 size={12} strokeWidth={2} />
					Matching your existing conventions — drop-in replacement
				{:else}
					<Sparkles size={12} strokeWidth={2} />
					Using best practices — modern, opinionated output
				{/if}
			</span>
			{#if hasRefFiles && (validationAgg.totalRenames > 0 || validationAgg.totalBugs > 0)}
				<div class="validation-badges">
					{#if validationAgg.totalRenames > 0}
						<span class="val-badge val-badge--rename" title="Figma name changes detected — migration comments will be added">
							<ArrowRight size={10} strokeWidth={2} />
							{validationAgg.totalRenames} rename{validationAgg.totalRenames !== 1 ? 's' : ''} detected
						</span>
					{/if}
					{#if validationAgg.totalBugs > 0}
						<span class="val-badge val-badge--bug" title={validationAgg.bugMessages.join('\n')}>
							<AlertTriangle size={10} strokeWidth={2} />
							{validationAgg.totalBugs} known issue{validationAgg.totalBugs !== 1 ? 's' : ''} in reference
						</span>
					{/if}
				</div>
			{/if}
			<button
				class="gen-btn"
				class:gen-btn--ready={canGenerate && !loading}
				disabled={!canGenerate}
				onclick={onGenerate}
			>
				{#if loading}
					<span class="gen-spinner"></span>
					Generating…
				{:else if selectedOutputs.length === 0}
					Select an output
				{:else}
					Generate{hasRefFiles ? ' (match existing)' : ' (best practices)'}
					<ArrowRight size={14} strokeWidth={2} />
				{/if}
			</button>
		</div>

		<!-- ─── Secondary actions ───────────────────────────────── -->
		<div class="step step--footer" style="animation-delay: {activeRefKeys.length > 0 ? 280 : 240}ms">
			<button class="footer-action" onclick={onOpenImportPanel}>
				<Upload size={12} strokeWidth={1.5} />
				Import panel
			</button>
			<button class="footer-action" onclick={onOpenSettings}>
				<Settings size={12} strokeWidth={1.5} />
				Settings
			</button>
		</div>
	</div>

	{#if showHelp}
		<button class="help-tip" onclick={dismissHelp} style="animation-delay: 300ms">
			Tip: tokens load automatically from your design-tokens repo. Just pick a platform and hit Generate. <span class="help-dismiss">Dismiss</span>
		</button>
	{/if}
</div>

<style>
	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
		padding: 32px 24px;
		overflow-y: auto;
		gap: 16px;
	}

	/* ─── Card container ───────────────────── */
	.welcome-card {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 480px;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: 12px;
		overflow: hidden;
	}

	/* ─── Steps ─────────────────────────────── */
	.step {
		padding: 16px 20px;
		border-bottom: 1px solid var(--borderColor-muted);
		animation: step-in 350ms ease both;
	}

	.step:last-child {
		border-bottom: none;
	}

	@keyframes step-in {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.step-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.step-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		background: var(--bgColor-accent-muted);
		color: var(--fgColor-accent);
		font-size: 10px;
		font-weight: 700;
		border-radius: 50%;
	}

	.step-title {
		font-family: var(--fontStack-sansSerif);
		font-size: 13px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.step-hint {
		font-size: 12px;
		color: var(--fgColor-muted);
		margin: 8px 0 0 30px;
		line-height: 1.5;
	}

	.inline-link {
		background: none;
		border: none;
		padding: 0;
		color: var(--fgColor-accent);
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 2px;
	}

	.inline-link:hover {
		color: var(--fgColor-default);
	}

	/* ─── Token badge ──────────────────────── */
	.token-badge {
		margin-left: auto;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 10px;
		white-space: nowrap;
	}

	.token-badge--ok {
		background: color-mix(in srgb, var(--fgColor-success) 12%, transparent);
		color: var(--fgColor-success);
	}

	.token-badge--empty {
		background: color-mix(in srgb, var(--fgColor-attention) 12%, transparent);
		color: var(--fgColor-attention);
	}

	.token-badge--loading {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: color-mix(in srgb, var(--fgColor-accent) 10%, transparent);
		color: var(--fgColor-accent);
	}

	.token-badge--loading :global(svg) {
		animation: spin 1s linear infinite;
	}

	/* ─── Platform row ─────────────────────── */
	.platform-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-top: 12px;
	}

	.plat-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 8px 10px;
		background: var(--bgColor-default);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
	}

	.plat-btn:hover {
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	.plat-btn--active {
		background: color-mix(in srgb, var(--p-color) 8%, var(--bgColor-default));
		border-color: var(--p-color);
		box-shadow: 0 0 0 1px var(--p-color);
	}

	.plat-btn--active:hover {
		background: color-mix(in srgb, var(--p-color) 12%, var(--bgColor-default));
	}

	.plat-icons {
		display: flex;
		gap: 4px;
		opacity: 0.5;
		transition: opacity 120ms ease;
	}

	.plat-btn--active .plat-icons {
		opacity: 1;
	}

	.plat-tech {
		display: flex;
		width: 18px;
		height: 18px;
	}

	.plat-tech :global(svg) {
		width: 100%;
		height: 100%;
	}

	.plat-label {
		font-family: var(--fontStack-sansSerif);
		font-size: 12px;
		font-weight: 600;
		color: var(--fgColor-muted);
		transition: color 120ms ease;
	}

	.plat-btn--active .plat-label {
		color: var(--fgColor-default);
	}

	.plat-sub {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		color: var(--fgColor-disabled);
	}

	/* ─── Output row ───────────────────────── */
	.output-row {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}

	.out-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		background: var(--bgColor-default);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		font-family: var(--fontStack-sansSerif);
		font-size: 12px;
		font-weight: 500;
		color: var(--fgColor-muted);
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
	}

	.out-chip:hover {
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	.out-chip--active {
		background: var(--control-bgColor-rest);
		border-color: var(--borderColor-default);
		color: var(--fgColor-default);
		font-weight: 600;
		box-shadow: var(--shadow-floating-small);
	}

	.out-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		opacity: 0.35;
		transition: opacity 120ms ease;
	}

	.out-chip--active .out-dot {
		opacity: 1;
	}

	.out-warn {
		font-size: 11px;
		color: var(--fgColor-danger);
		margin: 6px 0 0 30px;
	}

	/* ─── Reference files ──────────────────── */
	.step-optional {
		font-size: 11px;
		font-weight: 400;
		color: var(--fgColor-disabled);
	}

	.step-num--optional {
		background: var(--bgColor-neutral-muted);
		color: var(--fgColor-muted);
	}

	.ref-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}

	.ref-slot {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		background: var(--bgColor-default);
		border: 1px dashed var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		font-size: 11px;
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
	}

	.ref-slot:hover {
		border-color: var(--fgColor-accent);
		color: var(--fgColor-accent);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 15%, var(--bgColor-default));
	}

	.ref-slot--filled {
		border-style: solid;
		border-color: var(--borderColor-default);
		color: var(--fgColor-default);
	}

	.ref-slot--filled:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-default);
		background: var(--control-bgColor-hover);
	}

	.ref-slot--dragging {
		border-color: var(--borderColor-accent-emphasis);
		border-style: solid;
		background: var(--bgColor-accent-muted);
	}

	.ref-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.ref-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.ref-name {
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		font-weight: 500;
	}

	.ref-hints {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.ref-hint-tag {
		font-size: 9px;
		font-family: var(--fontStack-monospace);
		padding: 1px 5px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--fgColor-accent) 8%, transparent);
		color: var(--fgColor-accent);
		white-space: nowrap;
	}

	.ref-meta {
		font-size: 10px;
		color: var(--fgColor-disabled);
		flex-shrink: 0;
	}

	.ref-slot :global(.ref-check-icon) {
		color: var(--fgColor-success);
		flex-shrink: 0;
	}

	.ref-cta {
		font-size: 10px;
		color: var(--fgColor-disabled);
		transition: color 100ms ease;
	}

	.ref-slot:hover .ref-cta {
		color: var(--fgColor-accent);
	}

	.ref-clear {
		display: flex;
		align-items: center;
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		padding: 1px;
		border-radius: 2px;
		transition: color 100ms ease;
	}

	.ref-clear:hover {
		color: var(--fgColor-danger);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		clip: rect(0 0 0 0);
		overflow: hidden;
	}

	/* ─── Generate CTA ─────────────────────── */
	.step--cta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 20px;
	}

	.mode-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--fgColor-muted);
		padding: 4px 12px;
		border-radius: var(--borderRadius-medium);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 20%, transparent);
		transition: background 150ms ease, color 150ms ease;
	}

	.mode-indicator--match {
		color: var(--fgColor-success);
		background: color-mix(in srgb, var(--fgColor-success) 8%, transparent);
	}

	.validation-badges {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.val-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-family: var(--fontStack-monospace);
		padding: 3px 8px;
		border-radius: var(--borderRadius-medium);
		white-space: nowrap;
		cursor: default;
	}

	.val-badge--rename {
		background: color-mix(in srgb, var(--fgColor-accent) 10%, transparent);
		color: var(--fgColor-accent);
	}

	.val-badge--bug {
		background: color-mix(in srgb, var(--fgColor-attention) 10%, transparent);
		color: var(--fgColor-attention);
	}

	.gen-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 36px;
		background: var(--brand-color);
		color: var(--fgColor-onEmphasis);
		border: none;
		border-radius: var(--borderRadius-medium);
		font-family: var(--fontStack-sansSerif);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms ease, box-shadow 200ms ease, transform 100ms ease;
	}

	.gen-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--brand-color) 85%, white);
		box-shadow: 0 0 20px color-mix(in srgb, var(--brand-color) 30%, transparent);
		transform: scale(1.02);
	}

	.gen-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.gen-btn--ready {
		animation: gen-glow 2s ease-in-out infinite;
	}

	.gen-btn:disabled {
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		color: var(--fgColor-disabled);
		cursor: not-allowed;
		animation: none;
	}

	@keyframes gen-glow {
		0%, 100% { box-shadow: 0 0 8px color-mix(in srgb, var(--brand-color) 20%, transparent); }
		50% { box-shadow: 0 0 20px color-mix(in srgb, var(--brand-color) 40%, transparent); }
	}

	.gen-spinner {
		display: inline-block;
		width: 13px;
		height: 13px;
		border: 2px solid color-mix(in srgb, var(--fgColor-onEmphasis) 30%, transparent);
		border-top-color: var(--fgColor-onEmphasis);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* ─── Footer links ─────────────────────── */
	.step--footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		flex-wrap: wrap;
		padding: 10px 20px;
		background: color-mix(in srgb, var(--bgColor-default) 40%, var(--bgColor-inset));
	}

	.footer-action {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		padding: 0;
		font-size: 11px;
		color: var(--fgColor-muted);
		cursor: pointer;
		transition: color 100ms ease;
	}

	.footer-action:hover {
		color: var(--fgColor-accent);
	}

	/* ─── Help tip ──────────────────────────── */
	.help-tip {
		max-width: 480px;
		width: 100%;
		font-size: 12px;
		color: var(--fgColor-muted);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 25%, var(--bgColor-inset));
		border: 1px solid var(--borderColor-accent-muted);
		border-radius: var(--borderRadius-medium);
		padding: 10px 16px;
		line-height: 1.5;
		cursor: pointer;
		text-align: left;
		transition: opacity 150ms ease;
		animation: step-in 350ms ease both;
	}

	.help-tip:hover {
		opacity: 0.7;
	}

	.help-dismiss {
		color: var(--fgColor-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* ─── Motion ────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.step, .help-tip {
			animation-duration: 0.01ms !important;
		}
		.gen-btn--ready {
			animation: none;
		}
	}

	/* ─── Mobile ────────────────────────────── */
	@media (max-width: 767px) {
		.welcome {
			padding: 16px;
		}

		.welcome-card {
			max-width: 100%;
		}

		.platform-row {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.plat-btn {
			flex-direction: row;
			padding: 10px 12px;
			gap: 10px;
		}

		.plat-sub {
			margin-left: auto;
		}

		.gen-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
