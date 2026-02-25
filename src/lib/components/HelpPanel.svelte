<script lang="ts">
	import { ExternalLink, Upload, Cpu, FileCode, ArrowRightLeft, ToggleLeft } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose: _onClose }: Props = $props();
</script>

<div class="help-panel">
	<div class="help-header">
		<h2 class="help-title">Quick Start</h2>
	</div>

	<div class="help-body">
		<section class="help-section">
			<h3 class="help-section-title">
				<Upload size={14} strokeWidth={2} />
				1. Load design tokens
			</h3>
			<p class="help-text">Tokens are pulled automatically from the design tokens GitHub repo. You can also:</p>
			<ul class="help-list">
				<li>Drag-and-drop JSON files directly into the Import panel</li>
				<li>Browse and restore previous token versions from the repo</li>
			</ul>
		</section>

		<section class="help-section">
			<h3 class="help-section-title">
				<Cpu size={14} strokeWidth={2} />
				2. Choose what to generate
			</h3>
			<p class="help-text">Pick your target platform (Web, Android, or iOS), then use the <strong>output toggles</strong> to generate Colors, Typography, or both. Click <strong>Generate</strong> to create production-ready code files instantly.</p>
		</section>

		<section class="help-section">
			<h3 class="help-section-title">
				<FileCode size={14} strokeWidth={2} />
				3. Review &amp; export
			</h3>
			<p class="help-text">Browse generated files in the code viewer. Copy individual files, download as ZIP, or send a PR directly to GitHub.</p>
		</section>

		<section class="help-section">
			<h3 class="help-section-title">
				<ToggleLeft size={14} strokeWidth={2} />
				Output toggles
			</h3>
			<p class="help-text">Use the <strong>Colors</strong> and <strong>Typography</strong> toggles to control which file categories are generated. Both are on by default. Deselect one to skip it entirely.</p>
		</section>

		<section class="help-section">
			<h3 class="help-section-title">
				<ArrowRightLeft size={14} strokeWidth={2} />
				Reference files
			</h3>
			<p class="help-text">Upload your existing code files (e.g. <code>Colors.swift</code>, <code>Primitives.scss</code>) to match your current naming conventions. Use <strong>"Match existing"</strong> mode to preserve your team's style.</p>
			<p class="help-text"><strong>"Best practices"</strong> mode applies recommended conventions for each platform (camelCase, SwiftUI Color, Compose Color, etc.).</p>
		</section>

		<section class="help-section">
			<h3 class="help-section-title">Generated files per platform</h3>
			<dl class="help-files">
				<dt class="help-platform">Web — Colors</dt>
				<dd><code>Primitives.scss</code>, <code>Colors.scss</code>, <code>Primitives.ts</code>, <code>Colors.ts</code>, <code>Colors.css</code>, <code>Spacing.scss</code>, <code>Spacing.ts</code></dd>
				<dt class="help-platform">Web — Typography</dt>
				<dd><code>Typography.scss</code>, <code>Typography.ts</code></dd>
				<dt class="help-platform">Android — Colors</dt>
				<dd><code>Colors.kt</code></dd>
				<dt class="help-platform">Android — Typography</dt>
				<dd><code>Typography.kt</code></dd>
				<dt class="help-platform">iOS — Colors</dt>
				<dd><code>Colors.swift</code></dd>
				<dt class="help-platform">iOS — Typography</dt>
				<dd><code>Typography.swift</code></dd>
			</dl>
			<p class="help-text help-text--muted">Shadow, border, and opacity files are auto-generated when those tokens are present in the values export.</p>
		</section>

		<div class="help-links">
			<a href="https://github.com/AdobeDesign/tokensmith" target="_blank" rel="noopener noreferrer" class="help-link">
				GitHub Repository
				<ExternalLink size={11} strokeWidth={2} />
			</a>
			<a href="https://www.figma.com/community/plugin/tokensmith" target="_blank" rel="noopener noreferrer" class="help-link">
				Figma Plugin
				<ExternalLink size={11} strokeWidth={2} />
			</a>
		</div>
	</div>
</div>

<style>
	.help-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.help-header {
		padding: 14px 16px;
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.help-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.help-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.help-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.help-section-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.help-section-title :global(svg) {
		color: var(--fgColor-accent);
		flex-shrink: 0;
	}

	/* Step numbers (first 3 sections): gradient circle, hide icon */
	.help-section:nth-child(-n+3) .help-section-title::before {
		content: counter(help-step, decimal);
		counter-increment: help-step;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		min-width: 22px;
		background: linear-gradient(135deg, var(--brand-color), #818CF8);
		border-radius: 100px;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: white;
	}

	.help-section:nth-child(-n+3) .help-section-title :global(svg) {
		display: none;
	}

	.help-body {
		counter-reset: help-step;
	}

	.help-text {
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-muted);
		line-height: 1.5;
		margin: 0;
	}

	.help-text--muted {
		font-size: 11px;
		color: var(--fgColor-disabled);
		font-style: italic;
	}

	.help-text code {
		font-family: var(--font-code);
		font-size: 11px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		color: var(--fgColor-default);
	}

	.help-text strong {
		color: var(--fgColor-default);
		font-weight: 600;
	}

	.help-list {
		padding-left: 20px;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.help-list li {
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-muted);
		line-height: 1.4;
	}

	.help-files {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 12px;
		margin: 0;
	}

	.help-platform {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--fgColor-default);
	}

	.help-files dd {
		font-family: var(--font-code);
		font-size: 11px;
		color: var(--fgColor-muted);
		margin: 0;
	}

	.help-files dd code {
		font-family: var(--font-code);
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
	}

	.help-links {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 16px;
		margin-top: 4px;
		border-top: 1px solid var(--borderColor-muted);
	}

	.help-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-accent);
		text-decoration: none;
	}

	.help-link:hover {
		text-decoration: underline;
	}
</style>
