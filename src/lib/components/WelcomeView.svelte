<script lang="ts">
	import { Upload, Loader2, ArrowRight, Check, X, AlertTriangle } from 'lucide-svelte';
	import type { Platform, DropZoneKey, FileSlot } from '$lib/types.js';
	import type { FileInsight } from '$lib/file-validation.js';

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
		hasRefFiles: boolean;
		tokensInitialLoading: boolean;
		canGenerate: boolean;
		loading: boolean;
		progressStatus?: string | null;
		errorMsg?: string | null;
		onGenerate: () => void;
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
		refKeys, visibleKeys, slots, fileInsights, hasRefFiles,
		tokensInitialLoading, canGenerate, loading, progressStatus = null, errorMsg = null, onGenerate,
		onDragEnter, onDragOver, onDragLeave, onDrop, onFileInput, onClearFile,
		requiredFilled
	}: Props = $props();

	const activeRefKeys = $derived(visibleKeys.filter((k) => refKeys.includes(k)));
	const tokensReady = $derived(requiredFilled === 3);

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
</script>

<div class="welcome">
	<!-- Ambient background -->
	<div class="ambient">
		<div class="orb orb--1"></div>
		<div class="orb orb--2"></div>
		<div class="orb orb--3"></div>
	</div>

	<div class="welcome-card">
		<!-- Step 1: Tokens -->
		<div class="step" style="animation-delay: 0ms">
			<div class="step-header">
				<span class="step-num" class:step-num--done={tokensReady}>
					{#if tokensReady}<Check size={11} strokeWidth={3} />{:else}1{/if}
				</span>
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
			{#each ['lightColors', 'darkColors', 'values'] as reqKey}
				{#if slots[reqKey as DropZoneKey].warning}
					<div class="step-warning">
						<AlertTriangle size={11} strokeWidth={2} />
						<span>{slots[reqKey as DropZoneKey].warning}</span>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Step 2: Platform -->
		<div class="step" style="animation-delay: 80ms">
			<div class="step-header">
				<span class="step-num" class:step-num--done={selectedPlatforms.length > 0}>
					{#if selectedPlatforms.length > 0}<Check size={11} strokeWidth={3} />{:else}2{/if}
				</span>
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

		<!-- Step 3: Reference files -->
		{#if activeRefKeys.length > 0}
			<div class="step" style="animation-delay: 160ms">
				<div class="step-header">
					<span class="step-num" class:step-num--done={hasRefFiles}>
						{#if hasRefFiles}<Check size={11} strokeWidth={3} />{:else}3{/if}
					</span>
					<span class="step-title">Reference files</span>
				</div>
				<p class="step-hint">Drop your existing code files so generated output matches your architecture, naming, and patterns</p>
				<div class="ref-grid">
					{#each activeRefKeys as key (key)}
						{@const slot = slots[key]}
						{@const filled = !!slot.file}
						{@const insight = fileInsights[key]}
						{@const fileCount = slot.files.length}
						<label
							class="ref-slot"
							class:ref-slot--filled={filled}
							class:ref-slot--multi={filled && fileCount > 1}
							class:ref-slot--dragging={slot.dragging}
							ondragenter={(e) => onDragEnter(key, e)}
							ondragover={(e) => onDragOver(key, e)}
							ondragleave={() => onDragLeave(key)}
							ondrop={(e) => onDrop(key, e)}
						>
							<input type="file" accept={slot.accept} class="sr-only" multiple={slot.multiFile} onchange={(e) => onFileInput(key, e)} />
							{#if filled}
								<div class="ref-top-row">
									<span class="ref-dot" style="background: {extColor(slot.ext)}"></span>
									<span class="ref-label">
										{#if fileCount > 1}
											{slot.label}
											<span class="ref-count">{fileCount} files</span>
										{:else}
											{slot.file?.name ?? slot.label}
										{/if}
									</span>
									{#if insight}
										<span class="ref-meta">{insight.count} {insight.label}</span>
									{/if}
									<Check size={10} strokeWidth={2.5} class="ref-check-icon" />
									<button class="ref-clear" onclick={(e) => onClearFile(key, e)} aria-label="Remove">
										<X size={9} strokeWidth={2} />
									</button>
								</div>
								{#if fileCount > 1}
									<ul class="ref-files-list">
										{#each slot.files as f (f.name)}
											<li>{f.name}</li>
										{/each}
									</ul>
								{/if}
							{:else}
								<Upload size={11} strokeWidth={1.5} />
								<span class="ref-label">{slot.label}</span>
								<span class="ref-cta">{slot.dragging ? 'Drop' : slot.multiFile ? 'Click or drag files' : 'Click or drag'}</span>
							{/if}
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Generate -->
		<div class="step step--cta" style="animation-delay: {activeRefKeys.length > 0 ? 220 : 160}ms">
			<div class="gen-wrapper" class:gen-wrapper--ready={canGenerate && !loading}>
				<button
					class="gen-btn"
					class:gen-btn--ready={canGenerate && !loading}
					disabled={!canGenerate}
					onclick={onGenerate}
				>
				{#if loading}
					<span class="gen-spinner"></span>
					{progressStatus ?? 'Generating…'}
				{:else if !canGenerate && !hasRefFiles}
					Upload reference files
				{:else}
					Generate
					<ArrowRight size={14} strokeWidth={2} />
				{/if}
				</button>
			</div>
			{#if errorMsg}
				<div class="gen-error">
					<AlertTriangle size={12} strokeWidth={2} />
					<span class="gen-error-text">{errorMsg}</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ─── Ambient background ──────────────────────────────────────────────── */

	.welcome {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
		padding: 48px 24px;
		overflow-y: auto;
		overflow-x: hidden;
		gap: 20px;
	}

	.ambient {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(100px);
		opacity: 0;
		animation: orb-fade 1.2s ease-out forwards;
	}

	.orb--1 {
		width: 500px;
		height: 500px;
		top: -20%;
		left: 20%;
		background: radial-gradient(circle, color-mix(in srgb, var(--brand-color) 10%, transparent), transparent 70%);
		animation-delay: 0ms;
	}

	.orb--2 {
		width: 400px;
		height: 400px;
		bottom: -20%;
		right: -10%;
		background: radial-gradient(circle, color-mix(in srgb, #818CF8 7%, transparent), transparent 70%);
		animation-delay: 200ms;
	}

	.orb--3 {
		width: 350px;
		height: 350px;
		top: 30%;
		left: -15%;
		background: radial-gradient(circle, color-mix(in srgb, #34D399 5%, transparent), transparent 70%);
		animation-delay: 400ms;
	}

	@keyframes orb-fade {
		from { opacity: 0; transform: scale(0.7); }
		to { opacity: 1; transform: scale(1); }
	}

	/* ─── Card ────────────────────────────────────────────────────────────── */

	.welcome-card {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 540px;
		background: var(--surface-glass);
		backdrop-filter: blur(32px) saturate(1.4);
		-webkit-backdrop-filter: blur(32px) saturate(1.4);
		border: 1px solid var(--surface-glass-border);
		border-radius: 16px;
		overflow: visible;
		box-shadow:
			0 0 0 1px var(--surface-glass-border),
			0 8px 40px rgba(0,0,0,0.25),
			inset 0 1px 0 rgba(255,255,255,0.06);
		z-index: 1;
		animation: card-in 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes card-in {
		from { opacity: 0; transform: translateY(24px) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* ─── Steps ──────────────────────────────────────────────────────────── */

	.step {
		position: relative;
		padding: 22px 28px;
		border-bottom: 1px solid var(--borderColor-muted);
		animation: step-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.step:last-child {
		border-bottom: none;
	}

	@keyframes step-in {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.step-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.step-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		background: linear-gradient(135deg, var(--brand-color), #818CF8);
		color: white;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		border-radius: 50%;
		box-shadow: 0 0 10px color-mix(in srgb, var(--brand-color) 20%, transparent);
		transition: background var(--transition-default), box-shadow var(--transition-default), transform var(--transition-fast);
	}

	.step-num--done {
		background: linear-gradient(135deg, #34D399, #10B981);
		box-shadow: 0 0 10px color-mix(in srgb, #34D399 25%, transparent);
		transform: scale(1.05);
	}

	.step-title {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		color: var(--fgColor-default);
		letter-spacing: -0.01em;
	}

	.step-hint {
		font-family: var(--font-display);
		font-size: 12px;
		line-height: 1.6;
		color: var(--fgColor-muted);
		margin: 8px 0 0 36px;
	}

	/* ─── Token badge ────────────────────────────────────────────────────── */

	.token-badge {
		margin-left: auto;
		font-family: var(--font-code);
		font-size: 10px;
		padding: 3px 10px;
		border-radius: 100px;
		white-space: nowrap;
		letter-spacing: 0.02em;
	}

	.token-badge--ok {
		background: color-mix(in srgb, var(--fgColor-success) 12%, transparent);
		color: var(--fgColor-success);
		box-shadow: 0 0 8px color-mix(in srgb, var(--fgColor-success) 10%, transparent);
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

	/* ─── Platform row ───────────────────────────────────────────────────── */

	.platform-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-top: 14px;
	}

	.plat-btn {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 20px 12px 14px;
		background: var(--bgColor-default);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-md);
		cursor: pointer;
		overflow: hidden;
		transition:
			background var(--transition-fast),
			border-color var(--transition-fast),
			box-shadow var(--transition-default),
			transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.plat-btn::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--p-color) 8%, transparent), transparent 70%);
		opacity: 0;
		transition: opacity var(--transition-default);
	}

	.plat-btn:hover::before {
		opacity: 1;
	}

	.plat-btn:hover {
		transform: translateY(-3px);
		border-color: color-mix(in srgb, var(--p-color) 30%, transparent);
		box-shadow:
			0 8px 32px color-mix(in srgb, var(--p-color) 12%, transparent),
			0 2px 8px rgba(0,0,0,0.15);
	}

	.plat-btn--active {
		border-color: var(--p-color);
		box-shadow:
			0 0 0 1px var(--p-color),
			0 0 24px color-mix(in srgb, var(--p-color) 20%, transparent),
			inset 0 1px 0 rgba(255,255,255,0.06);
	}

	.plat-btn--active::before {
		opacity: 1;
	}

	.plat-btn--active:hover {
		transform: translateY(-3px);
		box-shadow:
			0 0 0 1px var(--p-color),
			0 0 32px color-mix(in srgb, var(--p-color) 25%, transparent),
			inset 0 1px 0 rgba(255,255,255,0.06);
	}

	.plat-icons {
		display: flex;
		gap: 6px;
		opacity: 0.4;
		transition: opacity var(--transition-default), transform var(--transition-default);
	}

	.plat-btn--active .plat-icons {
		opacity: 1;
		transform: scale(1.1);
	}

	.plat-tech {
		display: flex;
		width: 20px;
		height: 20px;
	}

	.plat-tech :global(svg) {
		width: 100%;
		height: 100%;
	}

	.plat-label {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		color: var(--fgColor-muted);
		transition: color var(--transition-fast);
		position: relative;
	}

	.plat-btn--active .plat-label {
		color: var(--fgColor-default);
	}

	.plat-sub {
		font-family: var(--font-code);
		font-size: 9px;
		color: var(--fgColor-disabled);
		letter-spacing: 0.03em;
		position: relative;
	}

	/* ─── Reference files ────────────────────────────────────────────────── */

	.ref-grid {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 12px;
	}

	.ref-slot {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		background: var(--bgColor-default);
		border: 1px dashed var(--borderColor-default);
		border-radius: var(--radius-md);
		font-size: 11px;
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition:
			background var(--transition-fast),
			border-color var(--transition-fast),
			color var(--transition-fast),
			box-shadow var(--transition-fast),
			transform var(--transition-fast);
	}

	.ref-slot:hover {
		border-color: var(--brand-color);
		color: var(--brand-color);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--brand-color) 8%, transparent);
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

	.ref-slot--multi {
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
		padding: 12px 14px;
	}

	.ref-slot--dragging {
		border-color: var(--borderColor-accent-emphasis);
		border-style: solid;
		background: var(--bgColor-accent-muted);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--borderColor-accent-emphasis) 20%, transparent);
	}

	.ref-top-row {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
	}

	.ref-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 4px currentColor;
	}

	.ref-label {
		font-family: var(--font-code);
		font-size: 11px;
		font-weight: 500;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ref-count {
		font-weight: 400;
		color: var(--fgColor-muted);
		margin-left: 4px;
	}

	.ref-files-list {
		list-style: none;
		margin: 0;
		padding: 0 0 0 13px;
		max-height: 80px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.ref-files-list li {
		font-family: var(--font-code);
		font-size: 10px;
		line-height: 1.8;
		color: var(--fgColor-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ref-meta {
		font-size: 10px;
		color: var(--fgColor-disabled);
		flex-shrink: 0;
		margin-left: auto;
	}

	.ref-slot :global(.ref-check-icon) {
		color: var(--fgColor-success);
		flex-shrink: 0;
	}

	.ref-cta {
		font-size: 10px;
		color: var(--fgColor-disabled);
		transition: color var(--transition-fast);
	}

	.ref-slot:hover .ref-cta {
		color: var(--brand-color);
	}

	.ref-clear {
		display: flex;
		align-items: center;
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		padding: 2px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.ref-clear:hover {
		color: var(--fgColor-danger);
		background: color-mix(in srgb, var(--fgColor-danger) 10%, transparent);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		clip: rect(0 0 0 0);
		overflow: hidden;
	}

	/* ─── Generate CTA ───────────────────────────────────────────────────── */

	.step--cta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 24px 28px;
	}

	.gen-wrapper {
		position: relative;
		padding: 2px;
		border-radius: 14px;
		overflow: hidden;
	}

	.gen-wrapper--ready::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 200%;
		height: 200%;
		margin-left: -100%;
		margin-top: -100%;
		background: conic-gradient(
			from 0deg,
			var(--brand-color),
			#818CF8,
			#34D399,
			#FBBF24,
			var(--brand-color)
		);
		opacity: 0;
		animation: aurora-border 600ms ease forwards, aurora-spin 3s linear infinite;
	}

	@keyframes aurora-border {
		from { opacity: 0; }
		to { opacity: 0.7; }
	}

	@keyframes aurora-spin {
		to { transform: rotate(360deg); }
	}

	.gen-btn {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 14px 48px;
		background: linear-gradient(135deg, var(--brand-color) 0%, #E11D48 50%, #BE123C 100%);
		color: white;
		border: none;
		border-radius: 12px;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: -0.01em;
		cursor: pointer;
		box-shadow:
			0 1px 2px rgba(0,0,0,0.3),
			inset 0 1px 0 rgba(255,255,255,0.15);
		transition:
			box-shadow var(--transition-default),
			transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.gen-btn:hover:not(:disabled) {
		box-shadow:
			0 0 32px color-mix(in srgb, var(--brand-color) 40%, transparent),
			0 8px 20px rgba(0,0,0,0.2),
			inset 0 1px 0 rgba(255,255,255,0.15);
		transform: translateY(-2px) scale(1.02);
	}

	.gen-btn:active:not(:disabled) {
		transform: scale(0.97);
	}

	.gen-btn--ready {
		animation: gen-breathe 3s ease-in-out infinite;
	}

	.gen-btn:disabled {
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--borderColor-muted);
		color: var(--fgColor-disabled);
		cursor: not-allowed;
		box-shadow: none;
		animation: none;
	}

	@keyframes gen-breathe {
		0%, 100% {
			box-shadow:
				0 1px 2px rgba(0,0,0,0.3),
				0 0 12px color-mix(in srgb, var(--brand-color) 15%, transparent),
				inset 0 1px 0 rgba(255,255,255,0.15);
		}
		50% {
			box-shadow:
				0 1px 2px rgba(0,0,0,0.3),
				0 0 28px color-mix(in srgb, var(--brand-color) 30%, transparent),
				inset 0 1px 0 rgba(255,255,255,0.15);
		}
	}

	.gen-error {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-top: 4px;
		padding: 10px 14px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--bgColor-danger-muted) 40%, transparent);
		border: 1px solid var(--borderColor-danger-muted, #f8514940);
		color: var(--fgColor-danger);
		font-size: 12px;
		line-height: 1.5;
		max-width: 520px;
		text-align: left;
		animation: gen-error-in 200ms ease;
	}

	.gen-error-text {
		flex: 1;
		word-break: break-word;
	}

	@keyframes gen-error-in {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.gen-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* ─── Motion ──────────────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.step, .welcome-card, .orb { animation-duration: 0.01ms !important; }
		.gen-btn--ready, .gen-wrapper--ready::before { animation: none; }
	}

	/* ─── Mobile ──────────────────────────────────────────────────────────── */

	@media (max-width: 767px) {
		.welcome { padding: 24px 16px; }
		.welcome-card { max-width: 100%; }
		.step { padding: 18px 20px; }

		.platform-row {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.plat-btn {
			flex-direction: row;
			padding: 12px 14px;
			gap: 10px;
		}

		.plat-sub { margin-left: auto; }
		.gen-btn { width: 100%; justify-content: center; }
		.orb { display: none; }
	}

	/* ─── Warnings ────────────────────────────────────────────────────────── */

	.step-warning {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin: 8px 0 0 36px;
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--fgColor-attention) 8%, transparent);
		color: var(--fgColor-attention);
		font-size: 11px;
		line-height: 1.5;
	}

	.step-warning :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
	}
</style>
