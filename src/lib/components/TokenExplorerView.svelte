<script lang="ts">
	import { ArrowRight, Copy, Check, Sun, Moon, Type, Hash, Ruler } from 'lucide-svelte';
	import type { ColorFamily, ColorEntry, TypographyEntry, ValueEntry } from '$lib/token-explorer.js';
	import { contrastColor, pathToLabel } from '$lib/token-explorer.js';

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

	// ── Typography grouping ──────────────────────────────────────────────────────

	// Group tokens by their `group` field, preserving insertion order (already sorted by group)
	const typoGroups = $derived(() => {
		const map = new Map<string, TypographyEntry[]>();
		for (const t of typographyTokens) {
			const g = t.group || 'Other';
			if (!map.has(g)) map.set(g, []);
			map.get(g)!.push(t);
		}
		return [...map.entries()].map(([group, entries]) => ({ group, entries }));
	});

	// ── Color sub-family grouping ────────────────────────────────────────────────

	function subFamilyGroups(tokens: ColorEntry[]): { label: string | undefined; tokens: ColorEntry[] }[] {
		const map = new Map<string | undefined, ColorEntry[]>();
		for (const t of tokens) {
			const key = t.subFamily ?? undefined;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(t);
		}
		return [...map.entries()].map(([label, toks]) => ({ label, tokens: toks }));
	}

	// ── Value grouping ───────────────────────────────────────────────────────────

	const valueGroups = $derived(() => {
		const map = new Map<string, ValueEntry[]>();
		for (const v of valueTokens) {
			if (!map.has(v.category)) map.set(v.category, []);
			map.get(v.category)!.push(v);
		}
		return [...map.entries()].map(([category, entries]) => ({ category, entries }));
	});

	const maxValuePerCategory = $derived(() => {
		const m = new Map<string, number>();
		for (const v of valueTokens) {
			m.set(v.category, Math.max(m.get(v.category) ?? 0, v.value));
		}
		return m;
	});

	// ── Actions ──────────────────────────────────────────────────────────────────

	async function copyText(text: string, key: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedKey = key;
			setTimeout(() => { copiedKey = null; }, 1500);
		} catch { /* clipboard may not be available */ }
	}

	function getDisplayHex(token: ColorEntry): string {
		if (colorMode === 'dark' && token.darkHex) return token.darkHex;
		return token.lightHex;
	}

	// ── Formatters ───────────────────────────────────────────────────────────────

	function fmtLineHeight(lh: number | string | undefined): string {
		if (lh === undefined || lh === null) return '';
		if (typeof lh === 'number') {
			if (lh < 5) return `×${parseFloat(lh.toFixed(2))}`;
			return `${Math.round(lh)}px`;
		}
		return String(lh);
	}

	function fmtLetterSpacing(ls: number | string | undefined): string {
		if (ls === undefined || ls === null) return '';
		if (typeof ls === 'number') {
			if (Math.abs(ls) < 0.005) return '';
			return `${parseFloat(ls.toFixed(2))}px`;
		}
		return String(ls);
	}

	function fmtWeight(w: number | string): string {
		const n = typeof w === 'string' ? parseInt(w, 10) : w;
		if (isNaN(n)) return String(w);
		const names: Record<number, string> = {
			100: 'Thin', 200: 'ExtraLight', 300: 'Light',
			400: 'Regular', 500: 'Medium', 600: 'SemiBold',
			700: 'Bold', 800: 'ExtraBold', 900: 'Black'
		};
		return names[n] ? `${n} ${names[n]}` : String(n);
	}

	function isSpacingCat(cat: string): boolean {
		const c = cat.toLowerCase();
		return c.includes('spac') || c.includes('gap') || c.includes('padding') || c.includes('margin') || c.includes('size');
	}

	function isRadiusCat(cat: string): boolean {
		const c = cat.toLowerCase();
		return c.includes('radius') || c.includes('rounded') || c.includes('corner');
	}
</script>

<div class="explorer">

	<!-- ── Tab bar ── -->
	<div class="explorer-header">
		<div class="explorer-tabs">
			<button class="tab" class:tab--active={activeTab === 'colors'} onclick={() => (activeTab = 'colors')}>
				<Hash size={12} strokeWidth={2.5} />
				Colors
				{#if totalColors > 0}<span class="tab-pill">{totalColors}</span>{/if}
			</button>
			<button class="tab" class:tab--active={activeTab === 'typography'} onclick={() => (activeTab = 'typography')}>
				<Type size={12} strokeWidth={2.5} />
				Typography
				{#if typographyTokens.length > 0}<span class="tab-pill">{typographyTokens.length}</span>{/if}
			</button>
			<button class="tab" class:tab--active={activeTab === 'values'} onclick={() => (activeTab = 'values')}>
				<Ruler size={12} strokeWidth={2.5} />
				Values
				{#if valueTokens.length > 0}<span class="tab-pill">{valueTokens.length}</span>{/if}
			</button>
		</div>

		{#if activeTab === 'colors' && hasDark}
			<div class="mode-switcher">
				<button class="mode-btn" class:mode-btn--on={colorMode === 'light'} onclick={() => (colorMode = 'light')}>
					<Sun size={11} strokeWidth={2} /> Light
				</button>
				<button class="mode-btn" class:mode-btn--on={colorMode === 'dark'} onclick={() => (colorMode = 'dark')}>
					<Moon size={11} strokeWidth={2} /> Dark
				</button>
			</div>
		{/if}
	</div>

	<!-- ── Body ── -->
	<div class="explorer-body">

		<!-- ════ COLORS ════ -->
		{#if activeTab === 'colors'}
			{#if colorFamilies.length === 0}
				<div class="empty">
					<Hash size={28} strokeWidth={1.25} />
					<p>No color tokens loaded</p>
					<small>Upload light.tokens.json to see your palette</small>
				</div>
			{:else}
				<div class="color-layout">
					<!-- Sidebar nav -->
					<nav class="color-nav">
						{#each colorFamilies as f (f.family)}
							<a href="#{f.family.toLowerCase().replace(/[\s/]+/g, '-')}" class="color-nav-item">
								<span class="color-nav-dot" style="background:{f.tokens[0]?.lightHex ?? 'var(--fgColor-muted)'}"></span>
								{f.family}
								<span class="color-nav-count">{f.count}</span>
							</a>
						{/each}
					</nav>

					<!-- Families -->
					<div class="color-families">
						{#each colorFamilies as family (family.family)}
							{@const familyId = family.family.toLowerCase().replace(/[\s/]+/g, '-')}
							{@const groups = subFamilyGroups(family.tokens)}
							<section class="family" id={familyId}>
								<div class="family-header">
									<h2 class="family-title">{family.family}</h2>
									<span class="family-count">{family.count}</span>
								</div>

								{#each groups as grp (grp.label ?? '__root')}
									{#if grp.label}
										<div class="subfamily-label">{pathToLabel(grp.label)}</div>
									{/if}
									<div class="chip-grid">
										{#each grp.tokens as token (token.fullPath)}
											{@const hex = getDisplayHex(token)}
											{@const on = contrastColor(hex)}
											{@const ck = `${token.fullPath}-${colorMode}`}
											<div class="chip" class:chip--semantic={!token.isPrimitive}>
												<!-- svelte-ignore a11y_click_events_have_key_events -->
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													class="chip-swatch"
													style="background:{hex};box-shadow:inset 0 0 0 1px rgba(0,0,0,0.1)"
													onclick={() => copyText(hex, ck)}
												>
													<span class="chip-copy" style="color:{on}">
														{#if copiedKey === ck}<Check size={11} strokeWidth={2.5} />{:else}<Copy size={11} strokeWidth={1.75} />{/if}
													</span>
												</div>
												<div class="chip-info">
													<button class="chip-name" onclick={() => copyText(token.name, `n-${token.fullPath}`)} title={token.fullPath}>
														{#if copiedKey === `n-${token.fullPath}`}<Check size={9} strokeWidth={2.5} />{/if}
														{token.name}
													</button>
													<span class="chip-hex">{hex}</span>
													{#if !token.isPrimitive && token.alias}
														<span class="chip-alias">
															<ArrowRight size={8} strokeWidth={2} />
															{token.alias.split('/').pop()}
														</span>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/each}
							</section>
						{/each}
					</div>
				</div>
			{/if}

		<!-- ════ TYPOGRAPHY ════ -->
		{:else if activeTab === 'typography'}
			{#if typographyTokens.length === 0}
				<div class="empty">
					<Type size={28} strokeWidth={1.25} />
					<p>No typography tokens loaded</p>
					<small>Upload typography.tokens.json to see your type scale</small>
				</div>
			{:else}
				<div class="typo-layout">
					{#each typoGroups() as { group, entries } (group)}
						<section class="typo-group">
							<div class="typo-group-header">
								<span class="typo-breadcrumb">{pathToLabel(group)}</span>
								<span class="typo-group-count">{entries.length}</span>
							</div>
							<div class="typo-rows">
								{#each entries as entry (entry.fullPath)}
									<div class="typo-row">
										<!-- Left: meta -->
										<div class="typo-meta">
											<button
												class="typo-name"
												onclick={() => copyText(entry.fullPath, `t-${entry.fullPath}`)}
												title={entry.fullPath}
											>
												{#if copiedKey === `t-${entry.fullPath}`}<Check size={9} strokeWidth={2.5} />{/if}
												{entry.name}
											</button>
											<div class="typo-specs">
												<span class="spec">{entry.fontSize}px</span>
												<span class="dot">·</span>
												<span class="spec">{fmtWeight(entry.fontWeight)}</span>
												{#if fmtLineHeight(entry.lineHeight)}
													<span class="dot">·</span>
													<span class="spec">lh {fmtLineHeight(entry.lineHeight)}</span>
												{/if}
												{#if fmtLetterSpacing(entry.letterSpacing)}
													<span class="dot">·</span>
													<span class="spec">ls {fmtLetterSpacing(entry.letterSpacing)}</span>
												{/if}
											</div>
											{#if entry.fontFamily}
												<span class="typo-font">{entry.fontFamily}</span>
											{/if}
										</div>
										<!-- Right: live specimen, capped height -->
										<div class="typo-specimen-clip">
											<p
												class="typo-specimen"
												style="
													font-size: {Math.min(entry.fontSize, 30)}px;
													font-weight: {entry.fontWeight};
													line-height: 1;
													letter-spacing: {typeof entry.letterSpacing === 'number' ? `${parseFloat(entry.letterSpacing.toFixed(2))}px` : '0'};
												"
											>
												The quick brown fox jumps
											</p>
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}

		<!-- ════ VALUES ════ -->
		{:else if activeTab === 'values'}
			{#if valueTokens.length === 0}
				<div class="empty">
					<Ruler size={28} strokeWidth={1.25} />
					<p>No value tokens loaded</p>
					<small>Upload values.tokens.json to see your spacing and radius scale</small>
				</div>
			{:else}
				<div class="values-layout">
					{#each valueGroups() as { category, entries } (category)}
						{@const catMax = maxValuePerCategory().get(category) ?? 100}
						<section class="val-group">
							<div class="val-group-header">
								<h2 class="val-group-name">{pathToLabel(category)}</h2>
								<span class="val-group-count">{entries.length} token{entries.length !== 1 ? 's' : ''}</span>
							</div>
							<div class="val-list">
								{#each entries as entry (entry.fullPath)}
									<div class="val-row">
										<button
											class="val-name"
											onclick={() => copyText(entry.fullPath, `v-${entry.fullPath}`)}
											title={entry.fullPath}
										>
											{#if copiedKey === `v-${entry.fullPath}`}<Check size={9} strokeWidth={2.5} />{/if}
											{entry.name}
										</button>
										<div class="val-viz">
											{#if isRadiusCat(category)}
												<div class="val-radius" style="border-radius:{Math.min(entry.value, 9999)}px"></div>
											{:else}
												{@const pct = catMax > 0 ? Math.min((entry.value / catMax) * 100, 100) : 0}
												<div class="val-bar">
													<div class="val-bar-fill" style="width:{pct}%"></div>
												</div>
											{/if}
										</div>
										<span class="val-num">{entry.value}px</span>
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
	/* ── Shell ── */
	.explorer {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		font-family: var(--font-display);
		background: var(--bgColor-default);
		color: var(--fgColor-default);
	}

	/* ── Header ── */
	.explorer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 0 20px;
		height: 44px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.explorer-tabs { display: flex; align-items: center; gap: 2px; }

	.tab {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border: none;
		background: transparent;
		color: var(--fgColor-muted);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		border-radius: var(--radius-md);
		letter-spacing: 0.01em;
		transition: color var(--transition-fast), background var(--transition-fast);
		white-space: nowrap;
	}
	.tab:hover { color: var(--fgColor-default); background: var(--control-bgColor-hover); }
	.tab--active { color: var(--fgColor-default); background: var(--control-bgColor-hover); }

	.tab-pill {
		font-size: 10px;
		font-weight: 600;
		line-height: 1.4;
		padding: 1px 6px;
		border-radius: 100px;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		color: var(--fgColor-muted);
		font-variant-numeric: tabular-nums;
	}
	.tab--active .tab-pill {
		color: var(--brand-color);
		background: color-mix(in srgb, var(--brand-color) 10%, transparent);
		border-color: color-mix(in srgb, var(--brand-color) 25%, transparent);
	}

	/* ── Mode switcher ── */
	.mode-switcher {
		display: flex;
		gap: 1px;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-md);
		padding: 2px;
	}
	.mode-btn {
		display: flex; align-items: center; gap: 4px;
		padding: 3px 8px;
		border: none; background: transparent;
		color: var(--fgColor-muted);
		font-family: var(--font-display); font-size: 11px; font-weight: 500;
		cursor: pointer;
		border-radius: calc(var(--radius-md) - 2px);
		transition: all var(--transition-fast);
	}
	.mode-btn--on {
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		box-shadow: 0 1px 3px rgba(0,0,0,.15);
	}

	/* ── Scroll body ── */
	.explorer-body {
		flex: 1; overflow-y: auto; overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,.06) transparent;
	}

	/* ── Empty ── */
	.empty {
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 8px; min-height: 320px;
		color: var(--fgColor-muted); text-align: center; padding: 48px 24px;
	}
	.empty p { font-size: 13px; font-weight: 500; color: var(--fgColor-default); margin: 0; }
	.empty small { font-size: 11px; max-width: 240px; line-height: 1.5; opacity: .6; }

	/* ════════════════════════════════════════
	   COLORS
	════════════════════════════════════════ */

	.color-layout { display: flex; min-height: 100%; }

	/* Sidebar */
	.color-nav {
		width: 168px;
		flex-shrink: 0;
		border-right: 1px solid var(--borderColor-muted);
		padding: 12px 0;
		position: sticky;
		top: 0;
		align-self: flex-start;
		max-height: calc(100vh - 92px);
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.color-nav-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 14px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--fgColor-muted);
		text-decoration: none;
		transition: color var(--transition-fast), background var(--transition-fast);
	}
	.color-nav-item:hover { color: var(--fgColor-default); background: var(--control-bgColor-hover); }

	.color-nav-dot {
		width: 8px; height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgba(0,0,0,.15);
	}

	.color-nav-count {
		margin-left: auto;
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		opacity: .45;
	}

	/* Families area */
	.color-families {
		flex: 1;
		min-width: 0;
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 36px;
	}

	.family { display: flex; flex-direction: column; gap: 14px; }

	.family-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.family-title {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: -0.01em;
		margin: 0;
	}

	.family-count {
		font-size: 10px;
		color: var(--fgColor-muted);
		font-variant-numeric: tabular-nums;
	}

	/* Sub-family label */
	.subfamily-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fgColor-muted);
		margin-top: 4px;
		opacity: .6;
	}

	/* Chip grid */
	.chip-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 8px;
	}

	.chip {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--borderColor-muted);
		background: var(--bgColor-muted);
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}
	.chip:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.18); }
	.chip--semantic { border-style: dashed; opacity: .9; }

	.chip-swatch {
		height: 56px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity var(--transition-fast);
	}
	.chip-swatch:hover { opacity: .88; }

	.chip-copy {
		opacity: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity var(--transition-fast);
	}
	.chip-swatch:hover .chip-copy { opacity: .75; }

	.chip-info {
		padding: 7px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.chip-name {
		font-family: var(--font-code);
		font-size: 9.5px;
		font-weight: 500;
		color: var(--fgColor-default);
		background: transparent; border: none; padding: 0;
		cursor: pointer; text-align: left;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		display: flex; align-items: center; gap: 3px;
		transition: color var(--transition-fast);
	}
	.chip-name:hover { color: var(--brand-color); }

	.chip-hex {
		font-family: var(--font-code);
		font-size: 9.5px;
		color: var(--fgColor-muted);
		letter-spacing: .02em;
	}

	.chip-alias {
		font-family: var(--font-code);
		font-size: 9px;
		color: var(--fgColor-muted);
		display: flex; align-items: center; gap: 2px;
		opacity: .6;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}

	/* ════════════════════════════════════════
	   TYPOGRAPHY
	════════════════════════════════════════ */

	.typo-layout {
		padding: 20px 28px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.typo-group { display: flex; flex-direction: column; gap: 0; }

	.typo-group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px 8px 0;
		margin-bottom: 2px;
	}

	.typo-breadcrumb {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--fgColor-muted);
	}

	.typo-group-count {
		font-size: 10px;
		color: var(--fgColor-muted);
		opacity: .5;
		font-variant-numeric: tabular-nums;
	}

	.typo-rows {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.typo-row {
		display: grid;
		grid-template-columns: 220px 1fr;
		align-items: center;
		gap: 0;
		height: 56px;
		border-bottom: 1px solid var(--borderColor-muted);
		overflow: hidden;
		transition: background var(--transition-fast);
	}
	.typo-row:last-child { border-bottom: none; }
	.typo-row:hover { background: var(--control-bgColor-hover); }

	.typo-meta {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		padding: 0 16px 0 20px;
		height: 100%;
		border-right: 1px solid var(--borderColor-muted);
		flex-shrink: 0;
	}

	.typo-name {
		font-family: var(--font-code);
		font-size: 11px;
		font-weight: 600;
		color: var(--brand-color);
		background: transparent; border: none; padding: 0;
		cursor: pointer; text-align: left;
		display: flex; align-items: center; gap: 4px;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		transition: opacity var(--transition-fast);
	}
	.typo-name:hover { opacity: .7; }

	.typo-specs {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 3px;
		overflow: hidden;
	}

	.spec {
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		color: var(--fgColor-muted);
		white-space: nowrap;
	}

	.dot {
		font-size: 10px;
		color: var(--borderColor-default);
		flex-shrink: 0;
	}

	.typo-font {
		font-size: 10px;
		color: var(--fgColor-muted);
		opacity: .5;
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Specimen column: fixed height, clips overflow */
	.typo-specimen-clip {
		height: 56px;
		overflow: hidden;
		display: flex;
		align-items: center;
		padding: 0 20px;
	}

	.typo-specimen {
		margin: 0;
		white-space: nowrap;
		color: var(--fgColor-default);
		/* deliberately let text flow — overflow hidden clips it cleanly */
	}

	/* ════════════════════════════════════════
	   VALUES
	════════════════════════════════════════ */

	.values-layout {
		padding: 20px 28px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.val-group { display: flex; flex-direction: column; gap: 10px; }

	.val-group-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.val-group-name {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: .06em;
		text-transform: uppercase;
		color: var(--fgColor-muted);
		margin: 0;
	}

	.val-group-count {
		font-size: 10px;
		color: var(--fgColor-muted);
		opacity: .5;
	}

	.val-list { display: flex; flex-direction: column; gap: 4px; }

	.val-row {
		display: grid;
		grid-template-columns: 156px 1fr 60px;
		align-items: center;
		gap: 14px;
		padding: 7px 12px;
		border-radius: var(--radius-md);
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		transition: background var(--transition-fast);
	}
	.val-row:hover { background: var(--control-bgColor-hover); }

	.val-name {
		font-family: var(--font-code);
		font-size: 11px; font-weight: 500;
		color: var(--fgColor-default);
		background: transparent; border: none; padding: 0;
		cursor: pointer; text-align: left;
		display: flex; align-items: center; gap: 4px;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		transition: color var(--transition-fast);
	}
	.val-name:hover { color: var(--brand-color); }

	.val-viz { display: flex; align-items: center; }

	.val-bar {
		height: 5px; width: 100%;
		background: var(--bgColor-default);
		border-radius: 100px;
		border: 1px solid var(--borderColor-muted);
		overflow: hidden;
	}

	.val-bar-fill {
		height: 100%;
		background: var(--brand-color);
		border-radius: 100px;
		opacity: .65;
		min-width: 3px;
	}

	.val-radius {
		width: 28px; height: 28px;
		background: color-mix(in srgb, var(--brand-color) 18%, transparent);
		border: 1.5px solid color-mix(in srgb, var(--brand-color) 45%, transparent);
		flex-shrink: 0;
	}

	.val-num {
		font-family: var(--font-code);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--fgColor-muted);
		text-align: right;
	}

	/* ── Responsive ── */
	@media (max-width: 900px) {
		.color-nav { display: none; }
		.color-layout { display: block; }
		.color-families { padding: 16px; }
		.typo-layout, .values-layout { padding: 16px; }
		.typo-row { grid-template-columns: 180px 1fr; }
	}

	@media (max-width: 640px) {
		.explorer-header { padding: 0 12px; }
		.typo-row { height: auto; min-height: 0; grid-template-columns: 1fr; }
		.typo-meta { height: auto; padding: 10px 14px 6px; border-right: none; border-bottom: 1px solid var(--borderColor-muted); }
		.typo-specimen-clip { height: 44px; padding: 0 14px; }
		.val-row { grid-template-columns: 110px 1fr 48px; }
	}
</style>
