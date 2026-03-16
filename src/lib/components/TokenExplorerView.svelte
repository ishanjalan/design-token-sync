<script lang="ts">
	import { ArrowUpRight, Copy, Check, Sun, Moon, Type, Hash, Ruler } from 'lucide-svelte';
	import type { ColorFamily, ColorEntry, TypographyEntry, ValueEntry } from '$lib/token-explorer.js';
	import { contrastColor } from '$lib/token-explorer.js';

	interface Props {
		colorFamilies?: ColorFamily[];
		typographyTokens?: TypographyEntry[];
		valueTokens?: ValueEntry[];
	}

	let {
		colorFamilies = [],
		typographyTokens = [],
		valueTokens = []
	}: Props = $props();

	type ExplorerTab = 'colors' | 'typography' | 'values';

	let activeTab = $state<ExplorerTab>('colors');
	let colorMode = $state<'light' | 'dark'>('light');
	let copiedKey = $state<string | null>(null);

	const totalColors = $derived(colorFamilies.reduce((s, f) => s + f.count, 0));
	const hasDark = $derived(colorFamilies.some((f) => f.tokens.some((t) => t.darkHex)));

	// Group typography by group name
	const typoGroups = $derived(() => {
		const map = new Map<string, TypographyEntry[]>();
		for (const t of typographyTokens) {
			const g = t.group || 'Other';
			if (!map.has(g)) map.set(g, []);
			map.get(g)!.push(t);
		}
		return [...map.entries()].map(([group, entries]) => ({ group, entries }));
	});

	// Group values by category
	const valueGroups = $derived(() => {
		const map = new Map<string, ValueEntry[]>();
		for (const v of valueTokens) {
			if (!map.has(v.category)) map.set(v.category, []);
			map.get(v.category)!.push(v);
		}
		return [...map.entries()].map(([category, entries]) => ({ category, entries }));
	});

	const maxSpacingValue = $derived(
		valueTokens
			.filter((v) => v.category.toLowerCase().includes('spac') || v.category.toLowerCase().includes('size'))
			.reduce((m, v) => Math.max(m, v.value), 0)
	);

	async function copyText(text: string, key: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedKey = key;
			setTimeout(() => {
				copiedKey = null;
			}, 1500);
		} catch {
			/* clipboard may not be available */
		}
	}

	function getDisplayHex(token: ColorEntry): string {
		if (colorMode === 'dark' && token.darkHex) return token.darkHex;
		return token.lightHex;
	}

	function formatLineHeight(lh: number | string | undefined): string {
		if (lh === undefined || lh === null) return '—';
		if (typeof lh === 'number') return lh < 5 ? `×${lh.toFixed(1)}` : `${lh}px`;
		return String(lh);
	}

	function formatLetterSpacing(ls: number | string | undefined): string {
		if (ls === undefined || ls === null) return '—';
		if (typeof ls === 'number') {
			if (ls === 0) return '0';
			return `${ls}px`;
		}
		return String(ls);
	}

	function formatWeight(w: number | string): string {
		const num = typeof w === 'string' ? parseInt(w, 10) : w;
		if (isNaN(num)) return String(w);
		const names: Record<number, string> = {
			100: '100 Thin', 200: '200 ExtraLight', 300: '300 Light',
			400: '400 Regular', 500: '500 Medium', 600: '600 SemiBold',
			700: '700 Bold', 800: '800 ExtraBold', 900: '900 Black'
		};
		return names[num] ?? String(num);
	}

	function isSpacingCategory(cat: string): boolean {
		const c = cat.toLowerCase();
		return c.includes('spac') || c.includes('gap') || c.includes('padding') || c.includes('margin') || c.includes('size');
	}

	function isRadiusCategory(cat: string): boolean {
		const c = cat.toLowerCase();
		return c.includes('radius') || c.includes('rounded') || c.includes('corner');
	}
</script>

<div class="explorer">
	<!-- Top nav -->
	<div class="explorer-header">
		<div class="explorer-tabs">
			<button
				class="explorer-tab"
				class:explorer-tab--active={activeTab === 'colors'}
				onclick={() => (activeTab = 'colors')}
			>
				<Hash size={13} strokeWidth={2} />
				Colors
				{#if totalColors > 0}
					<span class="tab-count">{totalColors}</span>
				{/if}
			</button>
			<button
				class="explorer-tab"
				class:explorer-tab--active={activeTab === 'typography'}
				onclick={() => (activeTab = 'typography')}
			>
				<Type size={13} strokeWidth={2} />
				Typography
				{#if typographyTokens.length > 0}
					<span class="tab-count">{typographyTokens.length}</span>
				{/if}
			</button>
			<button
				class="explorer-tab"
				class:explorer-tab--active={activeTab === 'values'}
				onclick={() => (activeTab = 'values')}
			>
				<Ruler size={13} strokeWidth={2} />
				Values
				{#if valueTokens.length > 0}
					<span class="tab-count">{valueTokens.length}</span>
				{/if}
			</button>
		</div>

		{#if activeTab === 'colors' && hasDark}
			<div class="mode-toggle">
				<button
					class="mode-btn"
					class:mode-btn--active={colorMode === 'light'}
					onclick={() => (colorMode = 'light')}
					title="Light mode"
				>
					<Sun size={13} strokeWidth={2} />
					<span>Light</span>
				</button>
				<button
					class="mode-btn"
					class:mode-btn--active={colorMode === 'dark'}
					onclick={() => (colorMode = 'dark')}
					title="Dark mode"
				>
					<Moon size={13} strokeWidth={2} />
					<span>Dark</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="explorer-body">

		<!-- COLORS TAB -->
		{#if activeTab === 'colors'}
			{#if colorFamilies.length === 0}
				<div class="empty-state">
					<Hash size={32} strokeWidth={1.25} />
					<p>No color tokens found</p>
					<small>Upload a light.tokens.json from Figma Variables to see your palette</small>
				</div>
			{:else}
				<div class="color-content">
					<!-- Family jump nav -->
					<nav class="family-nav" aria-label="Color families">
						{#each colorFamilies as family (family.family)}
							<a href="#{family.family.toLowerCase().replace(/\s+/g, '-')}" class="family-nav-link">
								{family.family}
								<span class="family-nav-count">{family.count}</span>
							</a>
						{/each}
					</nav>

					<!-- Families grid -->
					<div class="families">
						{#each colorFamilies as family (family.family)}
							{@const familyId = family.family.toLowerCase().replace(/\s+/g, '-')}
							<section class="family-section" id={familyId}>
								<div class="family-heading">
									<h2 class="family-name">{family.family}</h2>
									<span class="family-meta">{family.count} token{family.count !== 1 ? 's' : ''}</span>
								</div>
								<div class="color-grid">
									{#each family.tokens as token (token.fullPath)}
										{@const hex = getDisplayHex(token)}
										{@const textColor = contrastColor(hex)}
										{@const copyKey = `${token.fullPath}-${colorMode}`}
										<div
											class="color-card"
											class:color-card--semantic={!token.isPrimitive}
										>
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="color-swatch"
												style="background: {hex};"
												onclick={() => copyText(hex, copyKey)}
												title="Click to copy {hex}"
											>
												<span class="swatch-copy-hint" style="color: {textColor}">
													{#if copiedKey === copyKey}
														<Check size={12} strokeWidth={2.5} />
													{:else}
														<Copy size={12} strokeWidth={2} />
													{/if}
												</span>
											</div>
											<div class="color-meta">
												<button
													class="color-name"
													onclick={() => copyText(token.name, `name-${token.fullPath}`)}
													title={token.fullPath}
												>
													{#if copiedKey === `name-${token.fullPath}`}
														<Check size={10} strokeWidth={2.5} />
													{/if}
													{token.name}
												</button>
												<span class="color-hex">{hex}</span>
												{#if !token.isPrimitive && token.alias}
													<span class="color-alias" title={token.alias}>
														<ArrowUpRight size={9} strokeWidth={2} />
														{token.alias.split('/').pop()}
													</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</section>
						{/each}
					</div>
				</div>
			{/if}

		<!-- TYPOGRAPHY TAB -->
		{:else if activeTab === 'typography'}
			{#if typographyTokens.length === 0}
				<div class="empty-state">
					<Type size={32} strokeWidth={1.25} />
					<p>No typography tokens found</p>
					<small>Upload a typography.tokens.json from Figma to see your type scale</small>
				</div>
			{:else}
				<div class="typo-content">
					{#each typoGroups() as { group, entries } (group)}
						<section class="typo-group">
							<h2 class="typo-group-name">{group}</h2>
							<div class="typo-table">
								{#each entries as entry (entry.fullPath)}
									<div class="typo-row">
										<div class="typo-row-meta">
											<button
												class="typo-token-name"
												onclick={() => copyText(entry.fullPath, `typo-${entry.fullPath}`)}
												title="Copy token path"
											>
												{#if copiedKey === `typo-${entry.fullPath}`}
													<Check size={10} strokeWidth={2.5} />
												{/if}
												{entry.name || entry.fullPath}
											</button>
											<div class="typo-specs">
												<span class="typo-spec">{entry.fontSize}px</span>
												<span class="typo-spec-sep">·</span>
												<span class="typo-spec">{formatWeight(entry.fontWeight)}</span>
												{#if entry.lineHeight !== undefined}
													<span class="typo-spec-sep">·</span>
													<span class="typo-spec">lh {formatLineHeight(entry.lineHeight)}</span>
												{/if}
												{#if entry.letterSpacing !== undefined && entry.letterSpacing !== 0}
													<span class="typo-spec-sep">·</span>
													<span class="typo-spec">ls {formatLetterSpacing(entry.letterSpacing)}</span>
												{/if}
											</div>
											{#if entry.fontFamily}
												<span class="typo-font-family">{entry.fontFamily}</span>
											{/if}
										</div>
										<div class="typo-specimen-wrap">
											<p
												class="typo-specimen"
												style="
													font-size: {Math.min(entry.fontSize, 72)}px;
													font-weight: {entry.fontWeight};
													line-height: {typeof entry.lineHeight === 'number' && entry.lineHeight < 5 ? entry.lineHeight : 1.2};
													letter-spacing: {typeof entry.letterSpacing === 'number' ? `${entry.letterSpacing}px` : '0'};
												"
											>
												The quick brown fox
											</p>
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}

		<!-- VALUES TAB -->
		{:else if activeTab === 'values'}
			{#if valueTokens.length === 0}
				<div class="empty-state">
					<Ruler size={32} strokeWidth={1.25} />
					<p>No value tokens found</p>
					<small>Upload a values.tokens.json from Figma to see your spacing and radius scale</small>
				</div>
			{:else}
				<div class="values-content">
					{#each valueGroups() as { category, entries } (category)}
						<section class="value-group">
							<h2 class="value-group-name">{category}</h2>
							<div class="value-list">
								{#each entries as entry (entry.fullPath)}
									<div class="value-row">
										<button
											class="value-name"
											onclick={() => copyText(entry.fullPath, `val-${entry.fullPath}`)}
											title="Copy token path"
										>
											{#if copiedKey === `val-${entry.fullPath}`}
												<Check size={10} strokeWidth={2.5} />
											{/if}
											{entry.name}
										</button>
										<div class="value-viz">
											{#if isRadiusCategory(category)}
												<div
													class="value-radius-box"
													style="border-radius: {Math.min(entry.value, 9999)}px"
													title="{entry.value}px"
												></div>
											{:else if isSpacingCategory(category)}
												{@const pct = maxSpacingValue > 0 ? Math.min((entry.value / maxSpacingValue) * 100, 100) : 0}
												<div class="value-bar-track">
													<div class="value-bar-fill" style="width: {pct}%"></div>
												</div>
											{:else}
												<div class="value-bar-track">
													<div class="value-bar-fill" style="width: {Math.min(entry.value, 400) / 4}%"></div>
												</div>
											{/if}
										</div>
										<span class="value-num">{entry.value}px</span>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		{/if}

	</div>
</div>

<style>
	/* ── Shell ─────────────────────────────────────────────────────────────────── */
	.explorer {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		font-family: var(--font-display);
	}

	/* ── Header / Tabs ─────────────────────────────────────────────────────────── */
	.explorer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 0 20px;
		height: 44px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--borderColor-muted);
		background: var(--bgColor-default);
	}

	.explorer-tabs {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.explorer-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.01em;
		cursor: pointer;
		border-radius: var(--radius-md);
		transition: color var(--transition-fast), background var(--transition-fast);
		white-space: nowrap;
	}

	.explorer-tab:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.explorer-tab--active {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.tab-count {
		font-size: 10px;
		font-weight: 600;
		color: var(--fgColor-muted);
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: 100px;
		padding: 1px 6px;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	.explorer-tab--active .tab-count {
		color: var(--brand-color);
		border-color: color-mix(in srgb, var(--brand-color) 30%, transparent);
		background: color-mix(in srgb, var(--brand-color) 10%, transparent);
	}

	/* ── Mode toggle ───────────────────────────────────────────────────────────── */
	.mode-toggle {
		display: flex;
		align-items: center;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-md);
		padding: 2px;
		gap: 1px;
	}

	.mode-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 9px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		border-radius: calc(var(--radius-md) - 2px);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.mode-btn--active {
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	/* ── Scrollable body ───────────────────────────────────────────────────────── */
	.explorer-body {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
	}

	/* ── Empty state ───────────────────────────────────────────────────────────── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		height: 100%;
		min-height: 320px;
		color: var(--fgColor-muted);
		text-align: center;
		padding: 40px 24px;
	}

	.empty-state p {
		font-size: 14px;
		font-weight: 500;
		margin: 0;
		color: var(--fgColor-default);
	}

	.empty-state small {
		font-size: 12px;
		max-width: 260px;
		line-height: 1.5;
		opacity: 0.7;
	}

	/* ── COLORS ────────────────────────────────────────────────────────────────── */
	.color-content {
		display: flex;
		min-height: 100%;
	}

	.family-nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 16px 0;
		width: 180px;
		flex-shrink: 0;
		border-right: 1px solid var(--borderColor-muted);
		position: sticky;
		top: 0;
		align-self: flex-start;
		max-height: calc(100vh - 112px);
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.family-nav-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 5px 16px;
		font-size: 12px;
		font-weight: 500;
		color: var(--fgColor-muted);
		text-decoration: none;
		transition: color var(--transition-fast), background var(--transition-fast);
		border-radius: 0;
	}

	.family-nav-link:hover {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
	}

	.family-nav-count {
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		opacity: 0.5;
	}

	.families {
		flex: 1;
		min-width: 0;
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 40px;
	}

	.family-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.family-heading {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.family-name {
		font-size: 14px;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.family-meta {
		font-size: 11px;
		color: var(--fgColor-muted);
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 10px;
	}

	.color-card {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--borderColor-muted);
		background: var(--bgColor-muted);
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.color-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.color-card--semantic {
		border-style: dashed;
	}

	.color-swatch {
		height: 60px;
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity var(--transition-fast);
	}

	.color-swatch:hover {
		opacity: 0.92;
	}

	.swatch-copy-hint {
		opacity: 0;
		transition: opacity var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.color-swatch:hover .swatch-copy-hint {
		opacity: 0.8;
	}

	.color-meta {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.color-name {
		font-family: var(--font-code);
		font-size: 10px;
		font-weight: 500;
		color: var(--fgColor-default);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: center;
		gap: 3px;
		transition: color var(--transition-fast);
	}

	.color-name:hover {
		color: var(--brand-color);
	}

	.color-hex {
		font-family: var(--font-code);
		font-size: 10px;
		color: var(--fgColor-muted);
		letter-spacing: 0.03em;
	}

	.color-alias {
		font-family: var(--font-code);
		font-size: 9px;
		color: var(--fgColor-muted);
		display: flex;
		align-items: center;
		gap: 2px;
		opacity: 0.7;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── TYPOGRAPHY ────────────────────────────────────────────────────────────── */
	.typo-content {
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 40px;
	}

	.typo-group {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.typo-group-name {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fgColor-muted);
		margin: 0 0 12px;
	}

	.typo-table {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.typo-row {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--borderColor-muted);
		min-height: 80px;
		transition: background var(--transition-fast);
	}

	.typo-row:last-child {
		border-bottom: none;
	}

	.typo-row:hover {
		background: var(--control-bgColor-hover);
	}

	.typo-row-meta {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 200px;
		flex-shrink: 0;
	}

	.typo-token-name {
		font-family: var(--font-code);
		font-size: 11px;
		font-weight: 600;
		color: var(--brand-color);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 4px;
		transition: opacity var(--transition-fast);
	}

	.typo-token-name:hover {
		opacity: 0.7;
	}

	.typo-specs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 3px;
	}

	.typo-spec {
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		color: var(--fgColor-muted);
	}

	.typo-spec-sep {
		font-size: 10px;
		color: var(--borderColor-default);
	}

	.typo-font-family {
		font-size: 10px;
		color: var(--fgColor-muted);
		opacity: 0.6;
		font-style: italic;
	}

	.typo-specimen-wrap {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.typo-specimen {
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--fgColor-default);
	}

	/* ── VALUES ────────────────────────────────────────────────────────────────── */
	.values-content {
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 36px;
	}

	.value-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.value-group-name {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fgColor-muted);
		margin: 0;
	}

	.value-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.value-row {
		display: grid;
		grid-template-columns: 160px 1fr 64px;
		align-items: center;
		gap: 16px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		transition: background var(--transition-fast);
	}

	.value-row:hover {
		background: var(--control-bgColor-hover);
	}

	.value-name {
		font-family: var(--font-code);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-default);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--transition-fast);
	}

	.value-name:hover {
		color: var(--brand-color);
	}

	.value-viz {
		display: flex;
		align-items: center;
	}

	.value-bar-track {
		height: 6px;
		width: 100%;
		background: var(--bgColor-default);
		border-radius: 100px;
		border: 1px solid var(--borderColor-muted);
		overflow: hidden;
	}

	.value-bar-fill {
		height: 100%;
		background: var(--brand-color);
		border-radius: 100px;
		opacity: 0.7;
		min-width: 4px;
		transition: width var(--transition-slow);
	}

	.value-radius-box {
		width: 32px;
		height: 32px;
		background: color-mix(in srgb, var(--brand-color) 20%, transparent);
		border: 2px solid color-mix(in srgb, var(--brand-color) 50%, transparent);
		flex-shrink: 0;
	}

	.value-num {
		font-family: var(--font-code);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--fgColor-muted);
		text-align: right;
	}

	/* ── Responsive ────────────────────────────────────────────────────────────── */
	@media (max-width: 900px) {
		.family-nav { display: none; }
		.color-content { display: block; }
		.families { padding: 16px; }
		.typo-content, .values-content { padding: 16px; }
		.typo-row-meta { width: 140px; }
	}

	@media (max-width: 640px) {
		.explorer-header { padding: 0 12px; }
		.explorer-tab span { display: none; }
		.typo-row { flex-direction: column; align-items: flex-start; min-height: 0; }
		.typo-row-meta { width: 100%; }
		.typo-specimen { font-size: 18px !important; }
		.value-row { grid-template-columns: 120px 1fr 48px; }
	}
</style>
