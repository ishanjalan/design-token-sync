<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { GenerateWarning, Platform } from '$lib/types.js';
	import type { BestPracticeAdvice } from '$lib/best-practices-advisor.js';
	import {
		ShieldCheck,
		AlertTriangle,
		CheckCircle2,
		ChevronDown,
		ChevronRight,
		Lightbulb,
		RefreshCw
	} from 'lucide-svelte';

	type QualitySection = 'cycles' | 'advice';

	interface Props {
		warnings: GenerateWarning[];
		advice: BestPracticeAdvice[];
		platforms: Platform[];
		onClose: () => void;
		onRerun?: () => void;
	}

	let { warnings, advice, platforms, onClose, onRerun }: Props = $props();

	const expandedSections = new SvelteSet<QualitySection>(['cycles', 'advice']);

	const cycleWarnings = $derived(warnings.filter((w) => w.type === 'cycle'));

	const totalIssues = $derived(cycleWarnings.length);

	const scorePercent = $derived(Math.max(0, 100 - totalIssues * 15));
	const scoreColor = $derived(
		scorePercent >= 80 ? 'var(--fgColor-success)' :
		scorePercent >= 50 ? 'var(--fgColor-attention)' :
		'var(--fgColor-danger)'
	);

	function toggle(section: QualitySection) {
		if (expandedSections.has(section)) expandedSections.delete(section);
		else expandedSections.add(section);
	}

	function severityIcon(severity: string) {
		if (severity === 'error' || severity === 'recommended') return 'error';
		if (severity === 'warning' || severity === 'suggestion') return 'warn';
		return 'info';
	}

	function platformLabel(p: string) {
		return p === 'web' ? 'Web' : p === 'ios' ? 'iOS' : p === 'android' ? 'Android' : p;
	}
</script>

<div class="quality-panel">
	<div class="panel-header">
		<div class="header-left">
			<ShieldCheck size={14} strokeWidth={2} />
			<span class="header-title">Quality</span>
		</div>
		<button class="close-btn" onclick={onClose}>&times;</button>
	</div>

	<div class="score-card">
		<div class="score-ring" style="--score-color: {scoreColor}">
			<svg viewBox="0 0 36 36" class="score-svg">
				<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--borderColor-muted)" stroke-width="2.5" />
				<circle
					cx="18" cy="18" r="15.9"
					fill="none"
					stroke={scoreColor}
					stroke-width="2.5"
					stroke-dasharray="{scorePercent}, 100"
					stroke-linecap="round"
					transform="rotate(-90 18 18)"
				/>
			</svg>
			<span class="score-value" style="color: {scoreColor}">{scorePercent}</span>
		</div>
		<div class="score-meta">
			<span class="score-label">Quality Score</span>
			<span class="score-detail">
				{#if totalIssues === 0}
					All checks passed
				{:else}
					{totalIssues} issue{totalIssues > 1 ? 's' : ''} found
				{/if}
			</span>
			{#if onRerun}
				<button class="rerun-btn" onclick={onRerun}>
					<RefreshCw size={10} strokeWidth={2} />
					Re-analyze
				</button>
			{/if}
		</div>
	</div>

	<div class="sections">
		<!-- Alias Cycles -->
		<div class="section" class:section--empty={cycleWarnings.length === 0}>
			<button class="section-header" onclick={() => toggle('cycles')}>
				<span class="section-icon">
					{#if expandedSections.has('cycles')}
						<ChevronDown size={12} />
					{:else}
						<ChevronRight size={12} />
					{/if}
				</span>
				<RefreshCw size={12} strokeWidth={2} />
				<span class="section-title">Alias Cycles</span>
				{#if cycleWarnings.length > 0}
					<span class="badge badge--error">{cycleWarnings.length}</span>
				{:else}
					<span class="badge badge--pass"><CheckCircle2 size={10} /></span>
				{/if}
			</button>
			{#if expandedSections.has('cycles')}
				<div class="section-body">
					{#if cycleWarnings.length === 0}
						<p class="empty-msg">No circular alias references detected.</p>
					{:else}
						{#each cycleWarnings as w (w.message)}
							<div class="issue-row issue-row--error">
								<AlertTriangle size={11} />
								<span class="issue-text">{w.message}</span>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Best Practices Advice -->
		<div class="section" class:section--empty={advice.length === 0}>
			<button class="section-header" onclick={() => toggle('advice')}>
				<span class="section-icon">
					{#if expandedSections.has('advice')}
						<ChevronDown size={12} />
					{:else}
						<ChevronRight size={12} />
					{/if}
				</span>
				<Lightbulb size={12} strokeWidth={2} />
				<span class="section-title">Best Practices</span>
				{#if advice.length > 0}
					<span class="badge badge--info">{advice.length}</span>
				{/if}
				{#if advice.length === 0}
					<span class="badge badge--pass"><CheckCircle2 size={10} /></span>
				{/if}
			</button>
			{#if expandedSections.has('advice')}
				<div class="section-body">
					{#if advice.length === 0}
						<p class="empty-msg">
							{#if platforms.length === 0}
								Generate tokens to see best practice suggestions.
							{:else}
								Reference files follow current best practices.
							{/if}
						</p>
					{:else}
						{#each advice as a (a.id)}
							<div class="advice-card advice-card--{severityIcon(a.severity)}">
								<div class="advice-header">
									<span class="advice-platform">{platformLabel(a.platform)}</span>
									<span class="advice-severity advice-severity--{a.severity}">{a.severity}</span>
								</div>
								<p class="advice-title">{a.title}</p>
								<p class="advice-desc">{a.description}</p>
								{#if a.learnMoreUrl}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a class="advice-link" href={a.learnMoreUrl} target="_blank" rel="noopener">Learn more →</a>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.quality-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--fgColor-default);
	}

	.header-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--fgColor-muted);
		font-size: 16px;
		cursor: pointer;
		line-height: 1;
		padding: 0 2px;
		transition: color var(--transition-fast);
	}

	.close-btn:hover {
		color: var(--fgColor-default);
	}

	/* ─── Score Card ─────────────────────────── */

	.score-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px;
		margin: 12px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-lg);
		border-bottom: none;
		margin-bottom: 0;
		flex-shrink: 0;
	}

	.score-ring {
		position: relative;
		width: 50px;
		height: 50px;
		flex-shrink: 0;
	}

	.score-svg {
		width: 100%;
		height: 100%;
	}

	.score-value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-code);
		font-size: 13px;
		font-weight: 700;
	}

	.score-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.score-label {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.score-detail {
		font-family: var(--font-display);
		font-size: 10px;
		color: var(--fgColor-muted);
	}

	.rerun-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
		padding: 2px 8px;
		background: var(--control-bgColor-rest);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-sm);
		color: var(--fgColor-muted);
		font-family: var(--font-code);
		font-size: 9px;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.rerun-btn:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-default);
	}

	/* ─── Sections ───────────────────────────── */

	.sections {
		flex: 1;
		overflow-y: auto;
		padding: 0 12px 16px;
	}

	.section {
		border-bottom: 1px solid var(--borderColor-muted);
		padding: 4px 0;
	}

	.section:last-child {
		border-bottom: none;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 10px 12px;
		background: none;
		border: none;
		color: var(--fgColor-default);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		transition: background var(--transition-fast);
	}

	.section-header:hover {
		background: var(--control-bgColor-hover);
	}

	.section-icon {
		display: flex;
		align-items: center;
		color: var(--fgColor-muted);
		flex-shrink: 0;
	}

	.section-title {
		flex: 1;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 100px;
		font-family: var(--font-code);
		font-size: 9px;
		font-weight: 600;
		line-height: 1;
	}

	.badge--error {
		background: var(--bgColor-danger-muted, rgba(248, 81, 73, 0.15));
		color: var(--fgColor-danger);
	}

	.badge--warn {
		background: var(--bgColor-attention-muted, rgba(210, 153, 34, 0.15));
		color: var(--fgColor-attention);
	}

	.badge--info {
		background: var(--bgColor-accent-muted, rgba(56, 139, 253, 0.15));
		color: var(--fgColor-accent);
	}

	.badge--pass {
		color: var(--fgColor-success);
	}

	.section-body {
		padding: 4px 12px 12px 30px;
	}

	.empty-msg {
		margin: 0;
		font-family: var(--font-display);
		font-size: 13px;
		color: var(--fgColor-muted);
		font-style: italic;
	}

	/* ─── Issue Rows ─────────────────────────── */

	.issue-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 3px 0;
		font-family: var(--font-display);
		font-size: 11px;
		line-height: 1.4;
	}

	.issue-row :global(svg) {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.issue-row--error :global(svg) {
		color: var(--fgColor-danger);
	}

	.issue-row--warn :global(svg) {
		color: var(--fgColor-attention);
	}

	.issue-token {
		font-family: var(--font-code);
		font-size: 10px;
		background: var(--bgColor-inset);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
		color: var(--fgColor-default);
	}

	.issue-text {
		color: var(--fgColor-muted);
		word-break: break-word;
	}

	.issue-detail {
		display: block;
		font-size: 10px;
		color: var(--fgColor-disabled);
		margin-top: 2px;
	}

	.overflow-note {
		margin: 4px 0 0;
		font-size: 10px;
		color: var(--fgColor-disabled);
		font-style: italic;
	}

	/* ─── Advice Cards ───────────────────────── */

	.advice-card {
		padding: 10px 12px;
		margin: 6px 0;
		border-radius: var(--radius-md);
		border: 1px solid var(--surface-glass-border);
		background: var(--surface-glass);
		border-left: 3px solid var(--fgColor-accent);
	}

	.advice-card--error {
		border-left-color: var(--fgColor-danger);
	}

	.advice-card--warn {
		border-left-color: var(--fgColor-attention);
	}

	.advice-card--info {
		border-left-color: var(--fgColor-accent);
	}

	.advice-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.advice-platform {
		font-family: var(--font-display);
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--fgColor-muted);
		background: var(--bgColor-muted);
		padding: 1px 5px;
		border-radius: 100px;
	}

	.advice-severity {
		font-family: var(--font-display);
		font-size: 9px;
		font-weight: 600;
		padding: 1px 5px;
		border-radius: 100px;
	}

	.advice-severity--recommended {
		background: var(--bgColor-danger-muted, rgba(248, 81, 73, 0.15));
		color: var(--fgColor-danger);
	}

	.advice-severity--suggestion {
		background: var(--bgColor-attention-muted, rgba(210, 153, 34, 0.15));
		color: var(--fgColor-attention);
	}

	.advice-severity--info {
		background: var(--bgColor-accent-muted, rgba(56, 139, 253, 0.15));
		color: var(--fgColor-accent);
	}

	.advice-title {
		margin: 0 0 2px;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.advice-desc {
		margin: 0;
		font-family: var(--font-display);
		font-size: 10px;
		color: var(--fgColor-muted);
		line-height: 1.5;
	}

	.advice-link {
		display: inline-block;
		margin-top: 4px;
		font-family: var(--font-display);
		font-size: 10px;
		color: var(--fgColor-accent);
		text-decoration: none;
	}

	.advice-link:hover {
		text-decoration: underline;
	}
</style>
