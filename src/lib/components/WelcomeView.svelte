<script lang="ts">
	import { browser } from '$app/environment';
	import { Check, Upload, X, Sparkles, Info } from 'lucide-svelte';
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
		bestPractices: boolean;
		onBestPracticesChange: (val: boolean) => void;
		canGenerate: boolean;
		loading: boolean;
		onGenerate: () => void;
		onOpenImportPanel: () => void;
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
		refKeys, visibleKeys, slots, fileInsights, hasRefFiles, bestPractices,
		onBestPracticesChange, canGenerate, loading, onGenerate, onOpenImportPanel,
		onDragEnter, onDragOver, onDragLeave, onDrop, onFileInput, onClearFile,
		requiredFilled
	}: Props = $props();

	const activeRefKeys = $derived(visibleKeys.filter((k) => refKeys.includes(k)));

	const platformOutputMap: Record<Platform, string> = {
		web: 'SCSS, TypeScript, CSS',
		android: 'Kotlin',
		ios: 'Swift'
	};

	function extColor(ext: string): string {
		if (ext === 'scss') return '#F06090';
		if (ext === 'ts') return '#4D9EFF';
		if (ext === 'swift') return '#FF8040';
		if (ext === 'kt') return '#B060FF';
		if (ext === 'css') return '#2196F3';
		return '#F5A623';
	}

	let showOnboarding = $state(false);

	if (browser) {
		showOnboarding = !localStorage.getItem('tokensmith:onboarded');
	}

	function dismissOnboarding() {
		showOnboarding = false;
		if (browser) localStorage.setItem('tokensmith:onboarded', '1');
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
	<div class="welcome-content">
		{#if showOnboarding}
			<div class="onboarding" style="animation-delay: 0ms">
				<div class="onboarding-header">
					<Sparkles size={14} strokeWidth={2} />
					<span class="onboarding-title">Welcome to Tokensmith</span>
					<button class="onboarding-dismiss" onclick={dismissOnboarding} aria-label="Dismiss">
						<X size={12} strokeWidth={2} />
					</button>
				</div>
				<ol class="onboarding-steps">
					<li><strong>Pick a platform</strong> — choose Web, Android, or iOS</li>
					<li><strong>Load tokens</strong> — they're pulled automatically from the design tokens repo, or drag-and-drop JSON files</li>
					<li><strong>Generate</strong> — get production-ready code files instantly</li>
				</ol>
			</div>
		{/if}

		<!-- Step 1: Platform cards -->
		<section class="welcome-section welcome-section--platforms" style="animation-delay: {showOnboarding ? 100 : 0}ms">
			<h2 class="welcome-heading">Select your platforms</h2>
			<div class="platform-cards">
				{#each platforms as p, i (p.id)}
					<button
						class="platform-card"
						class:platform-card--active={selectedPlatforms.includes(p.id)}
						style="--card-color: {p.color}; animation-delay: {i * 75}ms"
						onclick={() => onSelectPlatform(p.id)}
					>
					<span class="card-radio" class:card-radio--active={selectedPlatforms.includes(p.id)}></span>
					<span class="card-icons">
						{#each p.techIcons as tech (tech.label)}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<span class="tech-icon" style="color: {tech.color}" title={tech.label}>{@html tech.svg}</span>
						{/each}
					</span>
					<span class="card-label">{p.label}</span>
					<span class="card-output">{platformOutputMap[p.id]}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Step 2: Reference files -->
		{#if activeRefKeys.length > 0}
			<section class="welcome-section welcome-section--ref" style="animation-delay: 150ms">
				<h2 class="welcome-heading">
					Reference files
					<span class="welcome-heading-sub">optional</span>
				</h2>
				<p class="welcome-hint">Drop your current code files to match naming and formatting conventions</p>

				<div class="ref-slots">
					{#each activeRefKeys as key (key)}
						{@const slot = slots[key]}
						{@const filled = !!slot.file}
						{@const insight = fileInsights[key]}
					<label
						class="ref-slot"
						class:ref-slot--filled={filled}
						class:ref-slot--empty={!filled}
						class:ref-slot--dragging={slot.dragging}
						ondragenter={(e) => onDragEnter(key, e)}
						ondragover={(e) => onDragOver(key, e)}
						ondragleave={() => onDragLeave(key)}
						ondrop={(e) => onDrop(key, e)}
					>
						<input type="file" accept={slot.accept} class="sr-only" onchange={(e) => onFileInput(key, e)} />
						{#if filled}
							<span class="ref-dot" style="background: {extColor(slot.ext)}"></span>
							<span class="ref-label">{slot.label}</span>
							<span class="ref-check"><Check size={10} strokeWidth={2.5} /></span>
							{#if insight}
								<span class="ref-insight">{insight.count} {insight.label}</span>
							{/if}
							<button class="ref-clear" onclick={(e) => onClearFile(key, e)} aria-label="Remove"><X size={10} strokeWidth={2} /></button>
						{:else}
							<span class="ref-upload-icon"><Upload size={12} strokeWidth={1.5} /></span>
							<span class="ref-label">{slot.label}</span>
							<span class="ref-upload-cta">{slot.dragging ? 'Drop' : 'Click or drag'}</span>
						{/if}
					</label>
					{/each}
				</div>

		{#if hasRefFiles}
			<div class="bp-wrapper">
				<div class="bp-row" role="radiogroup" aria-label="Output convention">
					<button
						class="bp-option"
						class:bp-option--active={!bestPractices}
						role="radio"
						aria-checked={!bestPractices}
						onclick={() => onBestPracticesChange(false)}
					>Match existing</button>
					<button
						class="bp-option"
						class:bp-option--active={bestPractices}
						role="radio"
						aria-checked={bestPractices}
						onclick={() => onBestPracticesChange(true)}
					>Best practices</button>
				</div>
				<span class="bp-info-wrap">
					<button class="bp-info-btn" aria-label="Best practices info">
						<Info size={13} strokeWidth={2} />
					</button>
					<div class="bp-tooltip">
						<span class="bp-tooltip-title">{bestPractices ? 'Best practices' : 'Match existing'}</span>
						{#if bestPractices}
							<ul class="bp-tooltip-list">
								{#if selectedPlatforms.includes('web')}
									<li><strong>Web</strong> — CSS custom properties, camelCase tokens, $-prefixed SCSS, typed TS consts</li>
								{/if}
								{#if selectedPlatforms.includes('android')}
									<li><strong>Android</strong> — Compose Color(), camelCase naming, MaterialTheme-ready</li>
								{/if}
								{#if selectedPlatforms.includes('ios')}
									<li><strong>iOS</strong> — SwiftUI Color, camelCase, dynamic light/dark</li>
								{/if}
							</ul>
						{:else}
							<p class="bp-tooltip-desc">Output will mirror the naming, formatting, and structure from your uploaded reference files.</p>
						{/if}
					</div>
				</span>
			</div>
		{/if}
			</section>
		{/if}

		<!-- Step 3: Generate -->
		<section class="welcome-section welcome-section--generate" style="animation-delay: 250ms">
			<button
				class="welcome-generate"
				class:welcome-generate--ready={canGenerate && !loading}
				disabled={!canGenerate}
				onclick={onGenerate}
			>
				{#if loading}
					<span class="gen-spinner"></span>
					Generating…
				{:else}
					Generate
				{/if}
			</button>
		</section>

		<!-- Token source status -->
		<footer class="welcome-footer" style="animation-delay: 350ms">
			{#if storedTokenVersion != null}
				<span class="footer-status">
					v{storedTokenVersion}
					{#if swatchCount > 0} · {swatchCount} colors{/if}
					{#if storedTokenPushedAt} · {formatTokenDate(storedTokenPushedAt)}{/if}
				</span>
			{:else if requiredFilled === 3}
				<span class="footer-status">Token files loaded</span>
			{:else}
				<span class="footer-status">{requiredFilled}/3 token files loaded</span>
			{/if}
			<button class="footer-link" onclick={onOpenImportPanel}>
				<Upload size={12} strokeWidth={2} />
				Upload tokens manually
			</button>
		</footer>
	</div>
</div>

<style>
	.welcome {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
		padding: 32px 24px;
		overflow-y: auto;
	}

	.welcome-content {
		display: flex;
		flex-direction: column;
		gap: 32px;
		width: 100%;
		max-width: 560px;
	}

	/* ─── Onboarding ───────────────────────── */
	.onboarding {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 30%, var(--bgColor-inset));
		border: 1px solid var(--borderColor-accent-muted);
		border-radius: var(--borderRadius-medium);
		padding: 14px 16px;
		animation: welcome-fade-in 400ms ease both;
	}

	.onboarding-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		color: var(--fgColor-accent);
	}

	.onboarding-title {
		font-size: var(--base-text-size-sm);
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.onboarding-dismiss {
		margin-left: auto;
		display: flex;
		align-items: center;
		background: none;
		border: none;
		color: var(--fgColor-muted);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--borderRadius-small);
		transition: color 100ms ease, background 100ms ease;
	}

	.onboarding-dismiss:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.onboarding-steps {
		list-style: none;
		counter-reset: step;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0;
		margin: 0;
	}

	.onboarding-steps li {
		counter-increment: step;
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 12px;
		color: var(--fgColor-muted);
		line-height: 1.5;
	}

	.onboarding-steps li::before {
		content: counter(step);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		background: var(--bgColor-accent-muted);
		color: var(--fgColor-accent);
		font-size: 10px;
		font-weight: 700;
		border-radius: 50%;
	}

	.onboarding-steps li strong {
		color: var(--fgColor-default);
		font-weight: 600;
	}

	/* ─── Sections ──────────────────────────── */
	.welcome-section {
		animation: welcome-fade-in 400ms ease both;
	}

	@keyframes welcome-fade-in {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.welcome-heading {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: 600;
		color: var(--fgColor-default);
		margin-bottom: 12px;
	}

	.welcome-heading-sub {
		font-weight: 400;
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		margin-left: 6px;
	}

	.welcome-hint {
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-muted);
		margin-bottom: 12px;
	}

	/* ─── Platform Cards ────────────────────── */
	.platform-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.platform-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 20px 16px;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			box-shadow 150ms ease,
			transform 100ms ease;
		animation: welcome-fade-in 400ms ease both;
	}

	.platform-card:hover {
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	.platform-card:active {
		transform: scale(0.97);
	}

	.platform-card--active {
		background: color-mix(in srgb, var(--card-color) 8%, var(--bgColor-default));
		border-color: var(--card-color);
		box-shadow: 0 0 0 1px var(--card-color);
	}

	.platform-card--active:hover {
		background: color-mix(in srgb, var(--card-color) 12%, var(--bgColor-default));
	}

	.card-icons {
		display: flex;
		align-items: center;
		gap: 6px;
		opacity: 0.5;
		transition: opacity 150ms ease;
	}

	.platform-card--active .card-icons {
		opacity: 1;
	}

	.tech-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
	}

	.tech-icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.card-label {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: 600;
		color: var(--fgColor-muted);
		transition: color 150ms ease;
	}

	.platform-card--active .card-label {
		color: var(--fgColor-default);
	}

	.card-output {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
	}

	.card-radio {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 16px;
		height: 16px;
		border: 2px solid var(--borderColor-default);
		border-radius: 50%;
		transition: border-color 150ms ease, background 150ms ease;
	}

	.card-radio--active {
		border-color: var(--card-color);
		background: var(--card-color);
		box-shadow: inset 0 0 0 3px var(--bgColor-default);
	}

	/* ─── Reference Slots ───────────────────── */
	.ref-slots {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.ref-slot {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		cursor: pointer;
		transition: background 100ms ease, border-color 100ms ease;
	}

	.ref-slot--empty {
		border-style: dashed;
		background: color-mix(in srgb, var(--bgColor-inset) 50%, transparent);
	}

	.ref-slot:hover {
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	.ref-slot--empty:hover {
		border-color: var(--fgColor-accent);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 20%, var(--bgColor-inset));
	}

	.ref-slot--empty:hover .ref-upload-icon,
	.ref-slot--empty:hover .ref-upload-cta {
		color: var(--fgColor-accent);
	}

	.ref-slot--dragging {
		border-color: var(--borderColor-accent-emphasis);
		background: var(--bgColor-accent-muted);
		border-style: solid;
	}

	.ref-slot--filled {
		background: var(--bgColor-default);
		border-color: var(--borderColor-default);
	}

	.ref-upload-icon {
		display: flex;
		align-items: center;
		color: var(--fgColor-disabled);
		transition: color 100ms ease;
	}

	.ref-upload-cta {
		font-size: 10px;
		color: var(--fgColor-disabled);
		transition: color 100ms ease;
	}

	.ref-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.ref-label {
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-muted);
	}

	.ref-slot--filled .ref-label {
		color: var(--fgColor-default);
	}

	.ref-check {
		color: var(--fgColor-success);
		display: flex;
		align-items: center;
	}

	.ref-insight {
		font-size: 10px;
		color: var(--fgColor-disabled);
	}

	.ref-clear {
		display: flex;
		align-items: center;
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		padding: 2px;
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

	/* ─── Output Convention Segmented ──────── */
	.bp-row {
		display: inline-flex;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-medium);
		padding: 2px;
		gap: 1px;
	}

	.bp-option {
		padding: 4px 12px;
		border: none;
		background: transparent;
		border-radius: calc(var(--borderRadius-medium) - 2px);
		font-family: var(--fontStack-sansSerif);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-muted);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
	}

	.bp-option:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.bp-option--active {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-default);
		box-shadow: var(--shadow-floating-small);
		font-weight: 600;
	}

	.bp-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}

	.bp-info-wrap {
		position: relative;
	}

	.bp-info-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		border-radius: 50%;
		transition: color 100ms ease, background 100ms ease;
	}

	.bp-info-btn:hover {
		color: var(--fgColor-accent);
		background: var(--bgColor-accent-muted);
	}

	.bp-tooltip {
		display: none;
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		width: 280px;
		background: var(--overlay-bgColor);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 12px;
		box-shadow: var(--shadow-floating-large);
		z-index: 100;
	}

	.bp-info-wrap:hover .bp-tooltip,
	.bp-info-btn:focus-visible + .bp-tooltip {
		display: block;
	}

	.bp-tooltip-title {
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-default);
		display: block;
		margin-bottom: 6px;
	}

	.bp-tooltip-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bp-tooltip-list li {
		font-size: 11px;
		color: var(--fgColor-muted);
		line-height: 1.4;
	}

	.bp-tooltip-list li strong {
		color: var(--fgColor-default);
		font-weight: 600;
	}

	.bp-tooltip-desc {
		font-size: 11px;
		color: var(--fgColor-muted);
		line-height: 1.4;
		margin: 0;
	}

	/* ─── Generate CTA ──────────────────────── */
	.welcome-section--generate {
		display: flex;
		justify-content: center;
	}

	.welcome-generate {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 40px;
		background: var(--brand-color);
		color: var(--fgColor-onEmphasis);
		border: none;
		border-radius: var(--borderRadius-medium);
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms ease, box-shadow 200ms ease, transform 100ms ease;
	}

	.welcome-generate:hover:not(:disabled) {
		background: color-mix(in srgb, var(--brand-color) 85%, white);
		box-shadow: 0 0 24px color-mix(in srgb, var(--brand-color) 30%, transparent);
		transform: scale(1.02);
	}

	.welcome-generate:active:not(:disabled) {
		transform: scale(0.98);
	}

	.welcome-generate--ready {
		animation: gen-glow 2s ease-in-out infinite;
	}

	.welcome-generate:disabled {
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		color: var(--fgColor-disabled);
		cursor: not-allowed;
		animation: none;
	}

	@keyframes gen-glow {
		0%, 100% { box-shadow: 0 0 8px color-mix(in srgb, var(--brand-color) 20%, transparent); }
		50% { box-shadow: 0 0 24px color-mix(in srgb, var(--brand-color) 40%, transparent); }
	}

	.gen-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid color-mix(in srgb, var(--fgColor-onEmphasis) 30%, transparent);
		border-top-color: var(--fgColor-onEmphasis);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* ─── Footer ────────────────────────────── */
	.welcome-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding-top: 8px;
		border-top: 1px solid var(--borderColor-muted);
		animation: welcome-fade-in 400ms ease both;
	}

	.footer-status {
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		color: var(--fgColor-disabled);
	}

	.footer-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--fgColor-accent);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: color 100ms ease;
	}

	.footer-link:hover {
		color: var(--fgColor-default);
		text-decoration: underline;
	}

	/* ─── Reduced motion ────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.welcome-section,
		.platform-card,
		.welcome-footer {
			animation-duration: 0.01ms !important;
		}
		.welcome-generate--ready {
			animation: none;
		}
	}

	/* ─── Responsive ────────────────────────── */
	@media (max-width: 767px) {
		.welcome {
			padding: 24px 16px;
		}

		.welcome-content {
			gap: 24px;
		}

		.platform-cards {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.platform-card {
			flex-direction: row;
			padding: 12px 16px;
			gap: 12px;
		}

		.tech-icon {
			width: 18px;
			height: 18px;
		}

		.card-output {
			margin-left: auto;
		}

		.welcome-generate {
			width: 100%;
			justify-content: center;
		}
	}
</style>
