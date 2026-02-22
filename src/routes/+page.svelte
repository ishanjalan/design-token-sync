<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Toaster, toast } from 'svelte-sonner';
	import {
		saveRefFile,
		loadRefFile,
		clearRefFile,
		saveResult,
		loadResult,
		savePlatforms,
		loadPlatforms,
		clearAllStorage,
		saveToHistory,
		loadHistory,
		saveNotifyUrl,
		loadNotifyUrl,
		saveGithubPat,
		loadGithubPat,
		saveGithubRepos,
		loadGithubRepos,
		saveFigmaWebhookPasscode,
		loadFigmaWebhookPasscode,
		saveFigmaFileKey,
		loadFigmaFileKey,
		saveFigmaPat,
		loadFigmaPat,
		saveBestPractices,
		loadBestPractices
	} from '$lib/storage.js';
	import type {
		Platform,
		HistoryEntry,
		GithubConfigs,
		GeneratedFile,
		GenerateResponse,
		DropZoneKey,
		FileSlot,
		PrResult
	} from '$lib/types.js';
	import {
		type DiffLine,
		type ViewMode,
		type TokenModification,
		type RenameEntry,
		type FamilyRename,
		type TokenCoverageResult,
		type PlatformMismatch,
		type ImpactEntry,
		type ChangelogContext,
		enrichWordDiffs,
		diffStats,
		extractModifiedTokens,
		extractDeprecations,
		diffChangeIndices,
		filterDiffLines,
		generateChangelog,
		computeBlameMap,
		type BlameStatus
	} from '$lib/diff-utils.js';
	import {
		type DependencyEntry,
		computeTokenCoverage,
		validateCrossPlatform,
		buildDependencyMap,
		computeImpact,
		detectRenames,
		detectFamilyRenames
	} from '$lib/token-analysis.js';
	import {
		type Swatch,
		type SwatchComparison,
		parseSwatches,
		computeSwatchComparison
	} from '$lib/swatch-utils.js';
	import { buildSearchHighlight } from '$lib/search-utils.js';
	import { type FileInsight, validateFigmaJson, computeInsight } from '$lib/file-validation.js';

	import AppShell from '$lib/components/AppShell.svelte';
	import ActivityRail from '$lib/components/ActivityRail.svelte';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import HeaderBar from '$lib/components/HeaderBar.svelte';
	import ImportPanel from '$lib/components/ImportPanel.svelte';
	import ExplorerPanel from '$lib/components/ExplorerPanel.svelte';
	import EditorPane from '$lib/components/EditorPane.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import HistoryPanel from '$lib/components/HistoryPanel.svelte';

	// ─── Icons ───────────────────────────────────────────────────────────────────

	const ICON_WEB = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
	const ICON_ANDROID = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341A7.022 7.022 0 0 0 19 11c0-3.866-3.134-7-7-7s-7 3.134-7 7a7.022 7.022 0 0 0 1.477 4.341l-1.33 2.309a.5.5 0 0 0 .433.75H7v1.1a1.4 1.4 0 1 0 2.8 0v-1.1h4.4v1.1a1.4 1.4 0 1 0 2.8 0v-1.1h.42a.5.5 0 0 0 .433-.75l-1.33-2.309zM9.5 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/><path d="M15.657 4.344l.848-1.468a.5.5 0 0 0-.866-.5l-.883 1.528A6.965 6.965 0 0 0 12 3.5c-.963 0-1.88.196-2.756.404L8.361 2.376a.5.5 0 0 0-.866.5l.848 1.468A6.994 6.994 0 0 0 5 9h14a6.994 6.994 0 0 0-3.343-4.656z"/></svg>`;
	const ICON_IOS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`;
	const ICON_FIGMA = `<svg width="12" height="14" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true"><path d="M6 28c2.21 0 4-1.79 4-4v-4H6c-2.21 0-4 1.79-4 4s1.79 4 4 4z"/><path d="M2 16c0-2.21 1.79-4 4-4h4v8H6c-2.21 0-4-1.79-4-4z"/><path d="M2 8c0-2.21 1.79-4 4-4h4v8H6C3.79 12 2 10.21 2 8z"/><path d="M10 4h4c2.21 0 4 1.79 4 4s-1.79 4-4 4h-4V4z"/><path d="M22 16c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4z"/></svg>`;

	const PLATFORMS: { id: Platform; label: string; sublabel: string; color: string; icon: string }[] = [
		{ id: 'web', label: 'Web', sublabel: 'SCSS · TS', color: 'var(--fgColor-accent)', icon: ICON_WEB },
		{ id: 'android', label: 'Android', sublabel: 'Kotlin', color: '#3DDC84', icon: ICON_ANDROID },
		{ id: 'ios', label: 'iOS', sublabel: 'Swift', color: '#007AFF', icon: ICON_IOS }
	];

	const IDLE_GRID = Array.from({ length: 80 }, () => {
		const r = Math.random();
		return r > 0.85 ? (Math.random() > 0.5 ? '1' : '0') : '·';
	});

	// ─── Platform toggle ─────────────────────────────────────────────────────────

	let selectedPlatforms = $state<Platform[]>(['web']);
	let bestPractices = $state(true);
	let prevPlatforms = $state<string>(JSON.stringify(['web']));
	let needsRegeneration = $state(false);

	function selectPlatform(id: Platform) {
		selectedPlatforms = [id];
		if (browser) savePlatforms([id]);
	}

	$effect(() => {
		const key = JSON.stringify(selectedPlatforms);
		if (key !== prevPlatforms) {
			prevPlatforms = key;
			if (result && canGenerate) {
				needsRegeneration = true;
			}
			if (visibleFiles.length && !visibleFiles.some((f) => f.filename === activeTab)) {
				activeTab = visibleFiles[0].filename;
			}
		}
	});

	// ─── File slots ──────────────────────────────────────────────────────────────

	const ALL_KEYS: DropZoneKey[] = [
		'lightColors', 'darkColors', 'values', 'typography',
		'referencePrimitivesScss', 'referenceColorsScss',
		'referencePrimitivesTs', 'referenceColorsTs',
		'referenceColorsSwift', 'referenceColorsKotlin'
	];

	const REF_KEYS: DropZoneKey[] = [
		'referencePrimitivesScss', 'referenceColorsScss',
		'referencePrimitivesTs', 'referenceColorsTs',
		'referenceColorsSwift', 'referenceColorsKotlin'
	];

	const visibleKeys = $derived<DropZoneKey[]>([
		'lightColors', 'darkColors', 'values', 'typography',
		...(selectedPlatforms.includes('web') ? (['referencePrimitivesScss', 'referenceColorsScss', 'referencePrimitivesTs', 'referenceColorsTs'] as DropZoneKey[]) : []),
		...(selectedPlatforms.includes('ios') ? (['referenceColorsSwift'] as DropZoneKey[]) : []),
		...(selectedPlatforms.includes('android') ? (['referenceColorsKotlin'] as DropZoneKey[]) : [])
	]);

	const slots = $state<Record<DropZoneKey, FileSlot>>({
		lightColors: { label: 'Light.tokens.json', accept: 'application/json,.json', hint: 'Figma › Variables › Export JSON — light mode', ext: 'json', platforms: ['web', 'android', 'ios'], required: true, file: null, dragging: false, restored: false, warning: null },
		darkColors: { label: 'Dark.tokens.json', accept: 'application/json,.json', hint: 'Figma › Variables › Export JSON — dark mode', ext: 'json', platforms: ['web', 'android', 'ios'], required: true, file: null, dragging: false, restored: false, warning: null },
		values: { label: 'Value.tokens.json', accept: 'application/json,.json', hint: 'Figma spacing & integer scale', ext: 'json', platforms: ['web', 'android', 'ios'], required: true, file: null, dragging: false, restored: false, warning: null },
		referencePrimitivesScss: { label: 'Primitives.scss', accept: '.scss,text/plain', hint: 'Current file — primitive color variables', ext: 'scss', platforms: ['web'], required: false, file: null, dragging: false, restored: false, warning: null },
		referenceColorsScss: { label: 'Colors.scss', accept: '.scss,text/plain', hint: 'Current file — semantic color variables', ext: 'scss', platforms: ['web'], required: false, file: null, dragging: false, restored: false, warning: null },
		referencePrimitivesTs: { label: 'Primitives.ts', accept: '.ts,text/plain', hint: 'Current file — primitive color constants', ext: 'ts', platforms: ['web'], required: false, file: null, dragging: false, restored: false, warning: null },
		referenceColorsTs: { label: 'Colors.ts', accept: '.ts,text/plain', hint: 'Current file — semantic color constants', ext: 'ts', platforms: ['web'], required: false, file: null, dragging: false, restored: false, warning: null },
		referenceColorsSwift: { label: 'Colors.swift', accept: '.swift,text/plain', hint: 'Current file — matches existing naming conventions', ext: 'swift', platforms: ['ios'], required: false, file: null, dragging: false, restored: false, warning: null },
		referenceColorsKotlin: { label: 'Colors.kt', accept: '.kt,text/plain', hint: 'Current file — matches existing naming conventions', ext: 'kt', platforms: ['android'], required: false, file: null, dragging: false, restored: false, warning: null },
		typography: { label: 'typography.tokens.json', accept: 'application/json,.json', hint: 'Figma text styles — prefix with ios/ or droid/ for platform output', ext: 'json', platforms: ['web', 'android', 'ios'], required: false, file: null, dragging: false, restored: false, warning: null }
	});

	const requiredFilled = $derived((['lightColors', 'darkColors', 'values'] as DropZoneKey[]).filter((k) => !!slots[k].file).length);
	let loading = $state(false);
	const canGenerate = $derived(requiredFilled === 3 && !loading);
	const visibleFilled = $derived(visibleKeys.filter((k) => !!slots[k].file).length);
	const hasRefFiles = $derived(REF_KEYS.some((k) => !!slots[k].file));

	// ─── Lifecycle ───────────────────────────────────────────────────────────────

	onMount(() => {
		if (!browser) return;
		const storedPlatforms = loadPlatforms();
		if (storedPlatforms?.length) selectedPlatforms = storedPlatforms;
		bestPractices = loadBestPractices();

		for (const key of REF_KEYS) {
			const stored = loadRefFile(key);
			if (!stored) continue;
			const synthetic = new File([stored.content], stored.name, { type: 'text/plain' });
			slots[key].file = synthetic;
			slots[key].restored = true;
		}

		const storedResult = loadResult();
		if (storedResult) {
			result = storedResult.data as GenerateResponse;
			lastGeneratedAt = new Date(storedResult.savedAt);
			if (result?.files?.length) activeTab = result.files[0].filename;
		}

		history = loadHistory();
		chatWebhookUrl = loadNotifyUrl();
		githubPat = loadGithubPat();
		githubRepos = loadGithubRepos();
		figmaWebhookPasscode = loadFigmaWebhookPasscode();
		figmaFileKey = loadFigmaFileKey();
		figmaPat = loadFigmaPat();

		const storedTheme = localStorage.getItem('tokensmith:theme') as ThemeId | null;
		if (storedTheme && THEMES.some((t) => t.id === storedTheme)) selectedTheme = storedTheme;

		const storedWidth = localStorage.getItem('tokensmith:panel-width');
		if (storedWidth) panelWidth = Math.max(120, Math.min(480, parseInt(storedWidth, 10)));
	});

	// ─── State ───────────────────────────────────────────────────────────────────

	let result = $state<GenerateResponse | null>(null);
	let errorMsg = $state<string | null>(null);
	let activeTab = $state<string>('');
	let lastGeneratedAt = $state<Date | null>(null);
	let viewModes = $state<Record<string, ViewMode>>({});
	let highlights = $state<Record<string, string>>({});
	let diffs = $state<Record<string, DiffLine[]>>({});
	let deprecations = $state<Record<string, string[]>>({});
	let modifications = $state<Record<string, TokenModification[]>>({});
	let renames = $state<Record<string, RenameEntry[]>>({});
	let familyRenames = $state<Record<string, FamilyRename[]>>({});
	let tokenCoverage = $state<Record<string, TokenCoverageResult>>({});

	const visibleFiles = $derived(result?.files?.filter((f) => selectedPlatforms.includes(f.platform as Platform)) ?? []);
	const activeFile = $derived(visibleFiles.find((f) => f.filename === activeTab));

	let diffTotals = $derived.by(() => {
		let added = 0, removed = 0, modified = 0;
		for (const f of visibleFiles) {
			const lines = diffs[f.filename];
			if (!lines) continue;
			const s = diffStats(lines, modifications[f.filename]);
			added += s.added; removed += s.removed; modified += s.modified;
		}
		return { added, removed, modified };
	});

	let platformMismatches = $state<PlatformMismatch[]>([]);
	let dependencyMap = $state<DependencyEntry[]>([]);
	let impactedTokens = $state<ImpactEntry[]>([]);

	// ─── Themes ──────────────────────────────────────────────────────────────────

	const THEMES = [
		{ id: 'github-dark-dimmed', label: 'Dimmed', bg: '#22272e', mode: 'dark' as const },
		{ id: 'github-dark', label: 'Dark', bg: '#24292e', mode: 'dark' as const },
		{ id: 'one-dark-pro', label: 'Midnight', bg: '#282c34', mode: 'dark' as const },
		{ id: 'dracula', label: 'Dracula', bg: '#282A36', mode: 'dark' as const },
		{ id: 'catppuccin-mocha', label: 'Mocha', bg: '#1e1e2e', mode: 'dark' as const },
		{ id: 'night-owl', label: 'Deep Blue', bg: '#011627', mode: 'dark' as const },
		{ id: 'github-light', label: 'Light', bg: '#ffffff', mode: 'light' as const },
		{ id: 'catppuccin-latte', label: 'Latte', bg: '#eff1f5', mode: 'light' as const },
		{ id: 'min-light', label: 'Minimal', bg: '#ffffff', mode: 'light' as const }
	] as const;
	type ThemeId = (typeof THEMES)[number]['id'];

	const THEME_PAIRS: Record<string, ThemeId> = {
		'github-dark-dimmed': 'github-light', 'github-dark': 'github-light',
		'github-light': 'github-dark', 'one-dark-pro': 'min-light',
		'min-light': 'one-dark-pro', 'dracula': 'github-light',
		'catppuccin-mocha': 'catppuccin-latte', 'catppuccin-latte': 'catppuccin-mocha',
		'night-owl': 'github-light'
	};

	let selectedTheme = $state<ThemeId>('github-dark-dimmed');
	let showThemePicker = $state(false);
	let appColorMode = $state<'dark' | 'light'>('dark');

	function detectAppColorMode(): 'dark' | 'light' {
		if (!browser) return 'dark';
		const mode = document.documentElement.getAttribute('data-color-mode');
		if (mode === 'light') return 'light';
		if (mode === 'auto') return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
		return 'dark';
	}

	if (browser) {
		appColorMode = detectAppColorMode();
		const observer = new MutationObserver(() => {
			const prev = appColorMode;
			appColorMode = detectAppColorMode();
			if (prev !== appColorMode) {
				const currentTheme = THEMES.find((t) => t.id === selectedTheme);
				if (currentTheme && currentTheme.mode !== appColorMode) {
					const paired = THEME_PAIRS[selectedTheme];
					if (paired) selectedTheme = paired;
					else { const fallback = THEMES.find((t) => t.mode === appColorMode); if (fallback) selectedTheme = fallback.id; }
				}
			}
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode'] });
	}

	let swatches = $state<Swatch[]>([]);
	let showSwatches = $state(false);
	let fileInsights = $state<Partial<Record<DropZoneKey, FileInsight>>>({});
	let searchQuery = $state('');
	let searchInputEl = $state<HTMLInputElement | null>(null);
	const isMac = browser && /Mac|iPhone|iPad/.test(navigator.userAgent);
	const searchShortcutHint = isMac ? '⌘F' : 'Ctrl+F';
	let showHistory = $state(false);
	let history = $state<HistoryEntry[]>([]);
	let showSettings = $state(false);
	let chatWebhookUrl = $state('');
	let githubPat = $state('');
	let githubRepos = $state<GithubConfigs>({});
	let sendingPrs = $state(false);
	let prResults = $state<PrResult[]>([]);
	let bulkDropActive = $state(false);
	let figmaFileKey = $state('');
	let figmaPat = $state('');
	let figmaFetching = $state(false);
	let figmaConnected = $derived(!!figmaFileKey && !!figmaPat);
	let figmaWebhookPasscode = $state('');
	let figmaWebhookEvent = $state<{ file_name: string; timestamp: string; receivedAt: string } | null>(null);
	let figmaWebhookSeen = $state(true);
	let showChangeSummary = $state<Record<string, boolean>>({});
	let highlightedLines = $state<{ start: number; end: number } | null>(null);
	let wrapLines = $state(false);
	let showSectionNav = $state(false);
	let collapsedSections = $state<Set<number>>(new Set());
	let swatchComparisons = $state<SwatchComparison[]>([]);
	let swatchTab = $state<'all' | 'changes'>('all');
	let diffNavIndex = $state<Record<string, number>>({});
	let codeScrollTop = $state(0);
	let codeScrollHeight = $state(0);
	let codeClientHeight = $state(0);
	let codeScrollEl: HTMLElement | null = $state(null);
	let currentBreadcrumb = $state('');

	// ─── AppShell state ──────────────────────────────────────────────────────────

	type SidePanelId = 'import' | 'files' | 'history' | 'settings' | null;
	let activePanel = $state<SidePanelId>('import');
	let panelWidth = $state(280);

	function handleRailSelect(id: 'import' | 'files' | 'history' | 'settings') {
		activePanel = activePanel === id ? null : id;
	}

	// ─── Fold Logic ──────────────────────────────────────────────────────────────

	function toggleFold(lineNum: number) {
		const next = new Set(collapsedSections);
		if (next.has(lineNum)) next.delete(lineNum);
		else next.add(lineNum);
		collapsedSections = next;
	}

	function computeFoldRanges(content: string): { start: number; end: number; label: string }[] {
		const sections = extractSections(content);
		const ranges: { start: number; end: number; label: string }[] = [];
		const totalLines = content.split('\n').length;
		for (let i = 0; i < sections.length; i++) {
			const start = sections[i].line;
			const end = i + 1 < sections.length ? sections[i + 1].line - 1 : totalLines;
			ranges.push({ start, end, label: sections[i].label });
		}
		return ranges;
	}

	$effect(() => {
		if (!highlights || !result?.files) return;
		const file = result.files.find((f) => f.filename === activeTab);
		if (!file) return;
		const ranges = computeFoldRanges(file.content);
		requestAnimationFrame(() => {
			const wrap = document.querySelector('.shiki-wrap code') ?? document.querySelector('.code-pre code');
			if (!wrap) return;
			const lines = wrap.querySelectorAll(':scope > .line');
			wrap.querySelectorAll('.fold-toggle').forEach((el) => el.remove());
			wrap.querySelectorAll('.fold-placeholder').forEach((el) => el.remove());

			for (const range of ranges) {
				const lineEl = lines[range.start - 1] as HTMLElement | undefined;
				if (!lineEl) continue;
				const isCollapsed = collapsedSections.has(range.start);
				const hiddenCount = range.end - range.start;
				const toggle = document.createElement('span');
				toggle.className = `fold-toggle ${isCollapsed ? 'fold-toggle--collapsed' : ''}`;
				toggle.textContent = isCollapsed ? '▶' : '▼';
				toggle.title = isCollapsed ? `Expand ${hiddenCount} lines` : 'Collapse section';
				toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleFold(range.start); });
				lineEl.prepend(toggle);

				if (isCollapsed) {
					for (let l = range.start; l < range.end; l++) {
						const el = lines[l] as HTMLElement | undefined;
						if (el) el.style.display = 'none';
					}
					const placeholder = document.createElement('div');
					placeholder.className = 'fold-placeholder';
					placeholder.textContent = `··· ${hiddenCount} lines hidden (${range.label}) ···`;
					placeholder.addEventListener('click', () => toggleFold(range.start));
					lineEl.after(placeholder);
				} else {
					for (let l = range.start; l < range.end; l++) {
						const el = lines[l] as HTMLElement | undefined;
						if (el) el.style.display = '';
					}
				}
			}

			const diffLines = diffs[file.filename];
			wrap.querySelectorAll('.blame-mark').forEach((el) => el.remove());
			if (diffLines && diffLines.length > 0) {
				const blame = computeBlameMap(diffLines);
				for (let i = 0; i < Math.min(blame.length, lines.length); i++) {
					if (blame[i] === 'unchanged') continue;
					const lineEl = lines[i] as HTMLElement;
					const mark = document.createElement('span');
					mark.className = `blame-mark blame-mark--${blame[i]}`;
					mark.title = blame[i] === 'new' ? 'New line' : 'Modified line';
					lineEl.prepend(mark);
				}
			}
		});
	});

	function handleCodeScroll(e: Event) {
		const el = e.target as HTMLElement;
		codeScrollTop = el.scrollTop;
		codeScrollHeight = el.scrollHeight;
		codeClientHeight = el.clientHeight;
		updateBreadcrumb(el);
	}

	function updateBreadcrumb(scrollEl: HTMLElement) {
		if (!result?.files.length) return;
		const file = result.files.find((f) => f.filename === activeTab);
		if (!file) return;
		const sections = extractSections(file.content);
		if (sections.length === 0) { currentBreadcrumb = ''; return; }
		const lineH = 22.5;
		const currentLine = Math.floor(scrollEl.scrollTop / lineH) + 1;
		let active = sections[0];
		for (const sec of sections) {
			if (sec.line <= currentLine) active = sec;
			else break;
		}
		currentBreadcrumb = active ? active.label : '';
	}

	function seekMinimap(fraction: number) {
		if (codeScrollEl) {
			const maxScroll = codeScrollEl.scrollHeight - codeScrollEl.clientHeight;
			codeScrollEl.scrollTop = fraction * maxScroll;
		}
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────────

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	function langLabel(format: string): string {
		switch (format) {
			case 'scss': return 'SCSS';
			case 'typescript': return 'TypeScript';
			case 'swift': return 'Swift';
			case 'kotlin': return 'Kotlin';
			case 'css': return 'CSS';
			default: return format;
		}
	}

	function platformColor(platform: Platform): string {
		return PLATFORMS.find((p) => p.id === platform)?.color ?? 'var(--fgColor-disabled)';
	}

	function formatTime(d: Date): string {
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function timeAgo(d: Date): string {
		const secs = Math.floor((Date.now() - d.getTime()) / 1000);
		if (secs < 60) return `${secs}s ago`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		return `${Math.floor(secs / 3600)}h ago`;
	}

	function buildChangelogCtx(): ChangelogContext {
		return { files: result?.files ?? [], platforms: result?.platforms ?? [], platformLabels: PLATFORMS, diffs, deprecations, modifications, renames, familyRenames, tokenCoverage, platformMismatches, impactedTokens };
	}

	// ─── Drag & drop ─────────────────────────────────────────────────────────────

	const dragCounters: Partial<Record<DropZoneKey, number>> = {};

	function handleDragEnter(key: DropZoneKey, e: DragEvent) { e.preventDefault(); dragCounters[key] = (dragCounters[key] ?? 0) + 1; slots[key].dragging = true; }
	function handleDragOver(key: DropZoneKey, e: DragEvent) { e.preventDefault(); }
	function handleDragLeave(key: DropZoneKey) { dragCounters[key] = (dragCounters[key] ?? 1) - 1; if ((dragCounters[key] ?? 0) <= 0) { dragCounters[key] = 0; slots[key].dragging = false; } }
	function handleDrop(key: DropZoneKey, e: DragEvent) { e.preventDefault(); dragCounters[key] = 0; slots[key].dragging = false; const file = e.dataTransfer?.files[0]; if (file) assignFile(key, file); }
	function handleFileInput(key: DropZoneKey, e: Event) { const input = e.target as HTMLInputElement; if (input.files?.[0]) assignFile(key, input.files[0]); }

	async function assignFile(key: DropZoneKey, file: File) {
		if (REF_KEYS.includes(key)) {
			const expectedExt = `.${slots[key].ext}`;
			const fileExt = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
			if (fileExt && fileExt !== expectedExt && fileExt !== '.txt') {
				toast.error(`Expected a ${expectedExt} file for ${slots[key].label}, got "${file.name}"`);
				return;
			}
		}
		let content: string;
		try { content = await file.text(); } catch { toast.error(`Could not read ${file.name}`); slots[key].file = null; return; }
		slots[key].file = file;
		slots[key].restored = false;
		slots[key].warning = validateFigmaJson(key, content);
		fileInsights[key] = computeInsight(key, content);
		if (REF_KEYS.includes(key)) saveRefFile(key, file.name, content);
		if (key === 'lightColors') {
			try { const parsed = JSON.parse(content); swatches = parseSwatches(parsed); dependencyMap = buildDependencyMap(parsed); }
			catch { swatches = []; dependencyMap = []; }
		}
	}

	function clearFile(key: DropZoneKey, e: MouseEvent) {
		e.stopPropagation(); e.preventDefault();
		slots[key].file = null; slots[key].restored = false; slots[key].warning = null;
		if (REF_KEYS.includes(key)) clearRefFile(key);
	}

	function clearAll() {
		for (const key of ALL_KEYS) { slots[key].file = null; slots[key].restored = false; slots[key].warning = null; }
		clearAllStorage(); result = null; lastGeneratedAt = null; highlights = {}; diffs = {}; viewModes = {};
		swatches = []; fileInsights = {}; showSwatches = false; searchQuery = ''; showHistory = false; history = [];
		prResults = []; modifications = {}; renames = {}; familyRenames = {}; tokenCoverage = {};
		platformMismatches = []; dependencyMap = []; impactedTokens = []; diffNavIndex = {};
		toast.success('All files cleared');
	}

	async function autoDetectSlot(file: File): Promise<DropZoneKey | null> {
		const name = file.name.toLowerCase();
		if (name.includes('light')) return 'lightColors';
		if (name.includes('dark')) return 'darkColors';
		if (name.includes('value') || name.includes('spacing')) return 'values';
		if (name.includes('typography') || name.includes('typo')) return 'typography';
		try {
			const preview = await file.slice(0, 4096).text();
			const json = JSON.parse(preview) as Record<string, unknown>;
			function hasType(obj: unknown, t: string): boolean { if (!obj || typeof obj !== 'object') return false; const o = obj as Record<string, unknown>; if (o.$type === t) return true; return Object.entries(o).some(([k, v]) => !k.startsWith('$') && hasType(v, t)); }
			if (json['typography'] || hasType(json, 'typography')) return 'typography';
			if (hasType(json, 'number')) return 'values';
			if (hasType(json, 'color')) { const topKeys = Object.keys(json).join(' ').toLowerCase(); if (topKeys.includes('dark')) return 'darkColors'; return 'lightColors'; }
		} catch { /* not JSON */ }
		return null;
	}

	async function handleBulkDrop(e: DragEvent) {
		e.preventDefault(); bulkDropActive = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.name.endsWith('.json'));
		if (!files.length) { toast.error('No .json files found in the drop'); return; }
		let assigned = 0; const unmatched: string[] = [];
		for (const file of files) { const slot = await autoDetectSlot(file); if (slot) { await assignFile(slot, file); assigned++; } else { unmatched.push(file.name); } }
		if (assigned) toast.success(`${assigned} file${assigned > 1 ? 's' : ''} auto-assigned`);
		if (unmatched.length) toast.error(`Could not assign: ${unmatched.join(', ')}`);
	}

	// ─── Generate ────────────────────────────────────────────────────────────────

	async function generate() {
		if (!canGenerate) return;
		loading = true; errorMsg = null; result = null; highlights = {}; diffs = {}; viewModes = {}; needsRegeneration = false;
		try {
			const fd = new FormData();
			fd.append('lightColors', slots.lightColors.file!);
			fd.append('darkColors', slots.darkColors.file!);
			fd.append('values', slots.values.file!);
			fd.append('platforms', JSON.stringify(selectedPlatforms));
			fd.append('bestPractices', String(bestPractices));
			const optionalKeys: DropZoneKey[] = ['typography', 'referencePrimitivesScss', 'referenceColorsScss', 'referencePrimitivesTs', 'referenceColorsTs', 'referenceColorsSwift', 'referenceColorsKotlin'];
			for (const key of optionalKeys) { if (slots[key].file) fd.append(key, slots[key].file!); }
			const res = await fetch('/api/generate', { method: 'POST', body: fd });
			if (!res.ok) { const text = await res.text(); throw new Error(text || `HTTP ${res.status}`); }
			let parsed: GenerateResponse;
			try { parsed = await res.json(); } catch { throw new Error('Server returned invalid JSON'); }
			if (!parsed?.files?.length) throw new Error('No files were generated');
			result = parsed; lastGeneratedAt = new Date(); activeTab = parsed.files[0].filename;
			searchQuery = ''; showHistory = false; saveResult(parsed);
			const entry: HistoryEntry = { id: Date.now().toString(), generatedAt: new Date().toISOString(), platforms: parsed.platforms, stats: parsed.stats, files: parsed.files };
			saveToHistory(entry); history = loadHistory();
			toast.success(`${parsed.files.length} files generated`);
			if (chatWebhookUrl) notifyGoogleChat(parsed).catch(() => {});
			activePanel = 'files';
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Generation failed';
			toast.error(errorMsg ?? 'Generation failed');
		} finally { loading = false; }
	}

	// ─── Syntax Highlighting ─────────────────────────────────────────────────────

	$effect(() => { if (result?.files && browser) { highlightAll(result.files); computeAllDiffs(result.files); swatchComparisons = computeSwatchComparison(result.files); } });
	$effect(() => { if (selectedTheme && result?.files && browser) highlightAll(result.files); });

	$effect(() => {
		const _hl = highlightedLines;
		if (!browser) return;
		requestAnimationFrame(() => {
			const wrap = document.querySelector('.shiki-wrap code') ?? document.querySelector('.code-pre code');
			if (!wrap) return;
			const lines = wrap.querySelectorAll(':scope > .line');
			lines.forEach((el, i) => {
				const lineNum = i + 1;
				if (_hl && lineNum >= _hl.start && lineNum <= _hl.end) el.classList.add('line--highlighted');
				else el.classList.remove('line--highlighted');
			});
		});
	});

	function injectColorSwatches(html: string): string {
		const parts = html.split(/(<[^>]*>)/);
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].startsWith('<')) continue;
			parts[i] = parts[i].replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g, (match, hex) => {
				const full = hex.length === 3 ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : `#${hex.slice(0, 6)}`;
				return `<span class="code-color-dot" style="background:${full}" aria-hidden="true"></span>${match}`;
			});
			parts[i] = parts[i].replace(/0x([0-9a-fA-F]{6,8})(?![0-9a-fA-F])/gi, (match, hex) => {
				const rgb = hex.length === 8 ? hex.slice(2) : hex;
				return `<span class="code-color-dot" style="background:#${rgb.slice(0, 6)}" aria-hidden="true"></span>${match}`;
			});
		}
		return parts.join('');
	}

	async function highlightAll(files: GeneratedFile[]) {
		const { codeToHtml } = await import('shiki');
		const theme = THEMES.find((t) => t.id === selectedTheme) ?? THEMES[2];
		const langMap: Record<string, string> = { css: 'css', scss: 'scss', typescript: 'typescript', swift: 'swift', kotlin: 'kotlin' };
		const next: Record<string, string> = {};
		for (const file of files) {
			const lang = langMap[file.format] ?? 'text';
			try {
				const raw = await codeToHtml(file.content, { lang, theme: theme.id, colorReplacements: { [theme.bg]: 'transparent' } });
				next[file.filename] = injectColorSwatches(raw);
			} catch (err) {
				console.error('[shiki] highlight failed for', file.filename, err);
			}
		}
		highlights = next;
	}

	// ─── Diff ────────────────────────────────────────────────────────────────────

	async function computeAllDiffs(files: GeneratedFile[]) {
		const { diffLines: diffLinesFn, diffWords } = await import('diff');
		for (const file of files) {
			if (!file.referenceContent) continue;
			const changes = diffLinesFn(file.referenceContent, file.content);
			const lines: DiffLine[] = [];
			let oldLine = 1, newLine = 1;
			for (const change of changes) {
				const type = change.added ? 'add' : change.removed ? 'remove' : 'equal';
				const texts = change.value.replace(/\n$/, '').split('\n');
				for (const text of texts) {
					const dl: DiffLine = { type, text };
					if (type === 'equal') { dl.oldLineNum = oldLine++; dl.newLineNum = newLine++; }
					else if (type === 'remove') { dl.oldLineNum = oldLine++; }
					else { dl.newLineNum = newLine++; }
					lines.push(dl);
				}
			}
			enrichWordDiffs(lines, diffWords);
			diffs[file.filename] = lines;
		}
		deprecations = extractDeprecations(diffs);
		modifications = extractModifiedTokens(diffs);
		renames = detectRenames(diffs);
		familyRenames = detectFamilyRenames(renames);
		tokenCoverage = computeTokenCoverage(files);
		platformMismatches = files.length >= 2 ? validateCrossPlatform(files) : [];
		if (dependencyMap.length > 0) impactedTokens = computeImpact(dependencyMap, modifications, renames, deprecations);
	}

	// ─── Navigation ──────────────────────────────────────────────────────────────

	function handleTabKeydown(e: KeyboardEvent) {
		if (!visibleFiles.length) return;
		const filenames = visibleFiles.map((f) => f.filename);
		const idx = filenames.indexOf(activeTab);
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); activeTab = filenames[(idx + 1) % filenames.length]; }
		else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); activeTab = filenames[(idx - 1 + filenames.length) % filenames.length]; }
	}

	function navigateDiff(filename: string, direction: 'prev' | 'next') {
		const lines = diffs[filename]; if (!lines) return;
		const indices = diffChangeIndices(lines); if (!indices.length) return;
		const current = diffNavIndex[filename] ?? -1;
		let next: number;
		if (direction === 'next') next = current < indices.length - 1 ? current + 1 : 0;
		else next = current > 0 ? current - 1 : indices.length - 1;
		diffNavIndex[filename] = next;
		document.getElementById(`diff-line-${filename}-${indices[next]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function handleCodeKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); searchInputEl?.focus(); }
		if (e.key === 'Escape') highlightedLines = null;
		if (e.altKey && activeTab && diffs[activeTab]) {
			if (e.key === 'ArrowDown') { e.preventDefault(); navigateDiff(activeTab, 'next'); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); navigateDiff(activeTab, 'prev'); }
		}
	}

	function handleLineClick(lineNum: number, e: MouseEvent) {
		if (e.shiftKey && highlightedLines) {
			const start = Math.min(highlightedLines.start, lineNum);
			const end = Math.max(highlightedLines.start, lineNum);
			highlightedLines = { start, end };
		} else {
			highlightedLines = highlightedLines?.start === lineNum && highlightedLines?.end === lineNum ? null : { start: lineNum, end: lineNum };
		}
	}

	function extractSections(content: string): { label: string; line: number }[] {
		const sections: { label: string; line: number }[] = [];
		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const markMatch = line.match(/\/\/\s*MARK:\s*-?\s*(.+)/);
			if (markMatch) { sections.push({ label: markMatch[1].trim(), line: i + 1 }); continue; }
			const sectionMatch = line.match(/^\/\/\s*(Primitive|Semantic|Light|Dark|Material|Typography|Spacing|CSS custom|SCSS|@property|:root)\b.*$/i);
			if (sectionMatch) { sections.push({ label: line.replace(/^\/\/\s*/, '').slice(0, 50), line: i + 1 }); continue; }
			const objectMatch = line.match(/^(?:object|public extension|public struct|export interface|@mixin)\s+(\S+)/);
			if (objectMatch) sections.push({ label: objectMatch[0].slice(0, 50), line: i + 1 });
		}
		return sections;
	}

	function extractDiffColor(text: string): string | null {
		const m = text.match(/#([0-9a-fA-F]{6,8}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/) ?? text.match(/0x([0-9a-fA-F]{6,8})(?![0-9a-fA-F])/i);
		if (!m) return null;
		const raw = m[1];
		if (raw.length === 3) return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
		if (raw.length === 8 && text.includes('0x')) return `#${raw.slice(2, 8)}`;
		return `#${raw.slice(0, 6)}`;
	}

	function computeHunkHeaders(lines: DiffLine[]): Set<number> {
		const hunks = new Set<number>();
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].type === 'equal') continue;
			if (i === 0 || lines[i - 1].type === 'equal') hunks.add(i);
		}
		return hunks;
	}

	function nearestContext(lines: DiffLine[], idx: number): string {
		for (let i = idx - 1; i >= 0; i--) {
			const t = lines[i].text.trim();
			if (t.startsWith('//') && t.length > 3) return t;
			if (/^(export|object|public |@mixin|:root|\$\w)/.test(t)) return t.slice(0, 60);
		}
		return '';
	}

	function scrollToLine(lineNum: number) {
		showSectionNav = false;
		highlightedLines = { start: lineNum, end: lineNum };
		requestAnimationFrame(() => {
			const el = document.querySelector(`.shiki-wrap .line:nth-child(${lineNum})`) ?? document.querySelector(`.code-pre code .line:nth-child(${lineNum})`);
			el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	// ─── Download / Copy ─────────────────────────────────────────────────────────

	async function downloadZip() {
		if (!result?.files.length) return;
		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		for (const file of result.files) zip.file(file.filename, file.content);
		const blob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = `tokensmith-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
		URL.revokeObjectURL(url); toast.success('ZIP downloaded');
	}

	async function copyToClipboard(content: string) {
		try { await navigator.clipboard.writeText(content); toast.success('Copied to clipboard'); }
		catch { toast.error('Copy failed'); }
	}

	// ─── Config import/export ────────────────────────────────────────────────────

	async function exportConfig() {
		const refData: Record<string, { name: string; content: string }> = {};
		for (const key of REF_KEYS) { if (slots[key].file) { const content = await slots[key].file!.text(); refData[key] = { name: slots[key].file!.name, content }; } }
		const config = { version: 1, platforms: selectedPlatforms, referenceFiles: refData };
		const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = 'tokensmith-config.json'; a.click();
		URL.revokeObjectURL(url); toast.success('Config exported');
	}

	function importConfigFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0]; if (!file) return;
		file.text().then((text) => {
			try {
				const config = JSON.parse(text) as { version: number; platforms: Platform[]; referenceFiles: Record<string, { name: string; content: string }> };
				if (config.platforms?.length) { selectedPlatforms = config.platforms; if (browser) savePlatforms(selectedPlatforms); }
				for (const [key, data] of Object.entries(config.referenceFiles ?? {})) {
					if (!REF_KEYS.includes(key as DropZoneKey)) continue;
					const synthetic = new File([data.content], data.name, { type: 'text/plain' });
					slots[key as DropZoneKey].file = synthetic; slots[key as DropZoneKey].restored = true;
					saveRefFile(key, data.name, data.content);
					fileInsights[key as DropZoneKey] = computeInsight(key as DropZoneKey, data.content);
				}
				toast.success('Config imported');
			} catch { toast.error('Invalid config file'); }
		});
		input.value = '';
	}

	// ─── History ─────────────────────────────────────────────────────────────────

	function restoreHistory(entry: HistoryEntry) {
		result = { success: true, platforms: entry.platforms, stats: entry.stats, files: entry.files };
		lastGeneratedAt = new Date(entry.generatedAt);
		if (result.files.length) activeTab = result.files[0].filename;
		highlights = {}; diffs = {}; viewModes = {}; searchQuery = ''; showHistory = false;
		toast.success('Previous generation restored');
	}

	// ─── Google Chat ─────────────────────────────────────────────────────────────

	async function notifyGoogleChat(res: GenerateResponse) {
		try {
			const changelog = generateChangelog(buildChangelogCtx());
			const r = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhookUrl: chatWebhookUrl, platforms: res.platforms, stats: res.stats, filesCount: res.files.length, generatedAt: new Date().toISOString(), changelog }) });
			if (!r.ok) { const text = await r.text(); toast.error(`Google Chat: ${text}`); }
			else toast.success('Google Chat notified');
		} catch { toast.error('Google Chat notification failed'); }
	}

	// ─── GitHub PR ───────────────────────────────────────────────────────────────

	async function sendPRs() {
		if (!result?.files.length) return;
		if (!githubPat) { toast.error('Add your GitHub PAT in Settings first'); activePanel = 'settings'; return; }
		sendingPrs = true; prResults = [];
		try {
			const grouped = new Map<string, { platforms: string[]; owner: string; repo: string; baseBranch: string; targetDir: string; files: { filename: string; content: string }[] }>();
			for (const platform of result.platforms) {
				const cfg = githubRepos[platform]; if (!cfg?.owner || !cfg?.repo) continue;
				const repoKey = `${cfg.owner}/${cfg.repo}`;
				const existing = grouped.get(repoKey);
				const platFiles = result.files.filter((f) => f.platform === platform).map((f) => ({ filename: f.filename, content: f.content }));
				if (existing) {
					existing.platforms.push(platform);
					existing.files.push(...platFiles);
				} else {
					grouped.set(repoKey, { platforms: [platform], owner: cfg.owner, repo: cfg.repo, baseBranch: cfg.branch || 'main', targetDir: cfg.dir || '', files: platFiles });
				}
			}
			const repos = Array.from(grouped.values()).map((g) => ({ platform: g.platforms.join('+'), owner: g.owner, repo: g.repo, baseBranch: g.baseBranch, targetDir: g.targetDir, files: g.files }));
			if (repos.length === 0) { toast.error('Configure repo settings for at least one platform'); activePanel = 'settings'; return; }
			const changelog = generateChangelog(buildChangelogCtx());
			const res = await fetch('/api/github/pr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: githubPat, repos, description: changelog }) });
			if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(text || `HTTP ${res.status}`); }
			let data: { prs: { platform: string; url: string }[]; errors: string[] };
			try { data = await res.json(); } catch { throw new Error('Server returned invalid JSON'); }
			const successResults: PrResult[] = (data.prs ?? []).map((p) => ({ ...p, status: 'success' as const }));
			const failedResults: PrResult[] = (data.errors ?? []).map((errMsg) => { const platformMatch = errMsg.match(/^(\w+)\s*\(/); return { platform: platformMatch?.[1] ?? 'unknown', url: '', status: 'failed' as const, error: errMsg }; });
			prResults = [...successResults, ...failedResults];
			if (successResults.length > 0) {
				toast.success(`${successResults.length} PR${successResults.length > 1 ? 's' : ''} created`);
				storePrUrlsInHistory(successResults.map((p) => p.url));
			}
			if (failedResults.length > 0) toast.error(`${failedResults.length} PR${failedResults.length > 1 ? 's' : ''} failed`);
		} catch (e) { toast.error(`PR creation failed: ${e instanceof Error ? e.message : String(e)}`); }
		finally { sendingPrs = false; }
	}

	function storePrUrlsInHistory(urls: string[]) {
		if (!urls.length) return;
		const all = loadHistory();
		if (all.length > 0) {
			all[0].prUrls = [...(all[0].prUrls ?? []), ...urls];
			if (browser) localStorage.setItem('tokensmith:history', JSON.stringify(all));
			history = all;
		}
	}

	async function retryPr(platform: string) {
		if (!result?.files.length || !githubPat) return;
		const cfg = githubRepos[platform as Platform]; if (!cfg?.owner || !cfg?.repo) { toast.error(`No repo configured for ${platform}`); return; }
		const files = result.files.filter((f) => f.platform === platform).map((f) => ({ filename: f.filename, content: f.content }));
		if (!files.length) return;
		const idx = prResults.findIndex((p) => p.platform === platform);
		if (idx >= 0) prResults[idx] = { ...prResults[idx], status: 'success', error: undefined, url: '…' };
		try {
			const changelog = generateChangelog(buildChangelogCtx());
			const res = await fetch('/api/github/pr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: githubPat, repos: [{ platform, owner: cfg.owner, repo: cfg.repo, baseBranch: cfg.branch || 'main', targetDir: cfg.dir || '', files }], description: changelog }) });
			if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
			const data: { prs: { platform: string; url: string }[]; errors: string[] } = await res.json();
			if (data.prs?.length && idx >= 0) { prResults[idx] = { platform, url: data.prs[0].url, status: 'success' }; toast.success(`PR retried for ${platform}`); }
			else if (data.errors?.length) throw new Error(data.errors[0]);
		} catch (e) { if (idx >= 0) prResults[idx] = { platform, url: '', status: 'failed', error: e instanceof Error ? e.message : String(e) }; toast.error(`Retry failed for ${platform}`); }
	}

	// ─── Theme ───────────────────────────────────────────────────────────────────

	function changeTheme(id: string) { selectedTheme = id as ThemeId; showThemePicker = false; if (browser) localStorage.setItem('tokensmith:theme', id); }

	// ─── Settings persistence ────────────────────────────────────────────────────

	function onChatWebhookChange(e: Event) { chatWebhookUrl = (e.target as HTMLInputElement).value; if (browser) saveNotifyUrl(chatWebhookUrl); }
	function onGithubPatChange(e: Event) { githubPat = (e.target as HTMLInputElement).value; if (browser) saveGithubPat(githubPat); }
	function onGithubRepoChange(platform: Platform, field: keyof NonNullable<GithubConfigs[Platform]>, e: Event) {
		const val = (e.target as HTMLInputElement).value;
		githubRepos = { ...githubRepos, [platform]: { ...(githubRepos[platform] ?? { owner: '', repo: '', branch: 'main', dir: '' }), [field]: val } };
		if (browser) saveGithubRepos(githubRepos);
	}
	function onFigmaFileKeyChange(e: Event) { figmaFileKey = (e.target as HTMLInputElement).value; if (browser) saveFigmaFileKey(figmaFileKey); }
	function onFigmaPatChange(e: Event) { figmaPat = (e.target as HTMLInputElement).value; if (browser) saveFigmaPat(figmaPat); }
	function onFigmaPasscodeChange(e: Event) { figmaWebhookPasscode = (e.target as HTMLInputElement).value; if (browser) saveFigmaWebhookPasscode(figmaWebhookPasscode); }

	async function onFigmaFetch() {
		if (!figmaFileKey || !figmaPat || figmaFetching) return;
		figmaFetching = true;
		try {
			const res = await fetch('/api/figma/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileKey: figmaFileKey, pat: figmaPat }) });
			if (!res.ok) { toast.error(`Figma API error: ${await res.text()}`); return; }
			const data = await res.json();
			const slotEntries: { key: DropZoneKey; content: string; name: string }[] = [
				{ key: 'lightColors', content: JSON.stringify(data.lightColors, null, 2), name: 'Light.tokens.json' },
				{ key: 'darkColors', content: JSON.stringify(data.darkColors, null, 2), name: 'Dark.tokens.json' },
				{ key: 'values', content: JSON.stringify(data.values, null, 2), name: 'Value.tokens.json' }
			];
			if (data.typography && Object.keys(data.typography).length > 0) slotEntries.push({ key: 'typography', content: JSON.stringify(data.typography, null, 2), name: 'typography.tokens.json' });
			for (const entry of slotEntries) {
				const file = new File([entry.content], entry.name, { type: 'application/json' });
				slots[entry.key].file = file; slots[entry.key].restored = false;
				slots[entry.key].warning = validateFigmaJson(entry.key, entry.content);
				fileInsights[entry.key] = computeInsight(entry.key, entry.content);
			}
			try { const parsed = JSON.parse(slotEntries[0].content); swatches = parseSwatches(parsed); dependencyMap = buildDependencyMap(parsed); }
			catch { swatches = []; dependencyMap = []; }
			toast.success(`Fetched tokens from Figma`);
		} catch (err) { toast.error(`Failed to fetch from Figma: ${err instanceof Error ? err.message : 'Unknown error'}`); }
		finally { figmaFetching = false; }
	}

	// ─── Plugin sync ─────────────────────────────────────────────────────────────

	let pluginSyncAvailable = $state(false);
	let pluginSyncReceivedAt = $state('');
	let pluginAutoLoad = $state(true);

	async function checkPluginSync() {
		try {
			const res = await fetch('/api/figma/plugin-sync'); if (!res.ok) return;
			const data = await res.json();
			if (data.available && data.receivedAt !== pluginSyncReceivedAt) {
				pluginSyncReceivedAt = data.receivedAt;
				if (pluginAutoLoad) await applyPluginData(data);
				else pluginSyncAvailable = true;
			}
		} catch { /* silent */ }
	}

	async function applyPluginData(data: Record<string, unknown>) {
		const slotEntries: { key: DropZoneKey; content: string; name: string }[] = [
			{ key: 'lightColors', content: JSON.stringify(data.lightColors, null, 2), name: 'Light.tokens.json' },
			{ key: 'darkColors', content: JSON.stringify(data.darkColors, null, 2), name: 'Dark.tokens.json' },
			{ key: 'values', content: JSON.stringify(data.values, null, 2), name: 'Value.tokens.json' }
		];
		if (data.typography && typeof data.typography === 'object' && Object.keys(data.typography as object).length > 0) slotEntries.push({ key: 'typography', content: JSON.stringify({ typography: data.typography }, null, 2), name: 'typography.tokens.json' });
		for (const entry of slotEntries) {
			const file = new File([entry.content], entry.name, { type: 'application/json' });
			slots[entry.key].file = file; slots[entry.key].restored = false;
			slots[entry.key].warning = validateFigmaJson(entry.key, entry.content);
			fileInsights[entry.key] = computeInsight(entry.key, entry.content);
		}
		try { const parsed = JSON.parse(slotEntries[0].content); swatches = parseSwatches(parsed); dependencyMap = buildDependencyMap(parsed); }
		catch { swatches = []; dependencyMap = []; }
		pluginSyncAvailable = false; toast.success('Loaded tokens from Figma plugin');
	}

	async function loadPluginSync() {
		try {
			const res = await fetch('/api/figma/plugin-sync'); if (!res.ok) return;
			const data = await res.json();
			if (!data.available) { toast.error('No plugin data available'); return; }
			await applyPluginData(data);
		} catch (err) { toast.error(`Failed to load plugin data: ${err instanceof Error ? err.message : 'Unknown error'}`); }
	}

	$effect(() => { if (!browser) return; const interval = setInterval(checkPluginSync, 3_000); checkPluginSync(); return () => clearInterval(interval); });

	// ─── Figma Webhook polling ───────────────────────────────────────────────────

	async function pollFigmaWebhook() {
		if (!figmaWebhookPasscode) return;
		try {
			const res = await fetch(`/api/figma/webhook?passcode=${encodeURIComponent(figmaWebhookPasscode)}`);
			if (res.ok) {
				const data: { event: { file_name: string; timestamp: string; receivedAt: string } | null } = await res.json();
				if (data.event && data.event.receivedAt !== figmaWebhookEvent?.receivedAt) { figmaWebhookEvent = data.event; figmaWebhookSeen = false; }
			}
		} catch { /* silent */ }
	}

	$effect(() => { if (!browser || !figmaWebhookPasscode) return; const interval = setInterval(pollFigmaWebhook, 30_000); pollFigmaWebhook(); return () => clearInterval(interval); });

	// ─── Escape handler ──────────────────────────────────────────────────────────

	$effect(() => {
		if (!browser) return;
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				if (showThemePicker) showThemePicker = false;
				else if (showSectionNav) showSectionNav = false;
			}
		}
		function onClick(e: MouseEvent) {
			const target = e.target as Element | null;
			if (showThemePicker && !target?.closest('.theme-picker')) showThemePicker = false;
		}
		document.addEventListener('keydown', onKeydown);
		document.addEventListener('click', onClick);
		return () => { document.removeEventListener('keydown', onKeydown); document.removeEventListener('click', onClick); };
	});
</script>

<div aria-live="polite" aria-atomic="false" role="region" aria-label="Notifications">
	<Toaster theme="dark" position="bottom-right" richColors />
</div>

<AppShell {activePanel} bind:panelWidth={panelWidth} onClosePanel={() => (activePanel = null)}>
	{#snippet header()}
		<HeaderBar
			platforms={PLATFORMS}
			{selectedPlatforms}
			{canGenerate}
			{loading}
			{needsRegeneration}
			{requiredFilled}
			{appColorMode}
			{pluginSyncAvailable}
			{pluginAutoLoad}
			{figmaWebhookEvent}
			{figmaWebhookSeen}
			onSelectPlatform={selectPlatform}
			onGenerate={generate}
			onThemeToggle={() => {
				const html = document.documentElement;
				const current = html.getAttribute('data-color-mode') ?? 'dark';
				const order = ['dark', 'light', 'auto'];
				const next = order[(order.indexOf(current) + 1) % order.length];
				html.setAttribute('data-color-mode', next === 'auto' ? 'auto' : next);
				localStorage.setItem('app-theme', next);
			}}
			onLoadPluginSync={loadPluginSync}
			onAutoLoadChange={(val) => (pluginAutoLoad = val)}
			onWebhookDismiss={() => (figmaWebhookSeen = true)}
		/>
	{/snippet}

	{#snippet rail()}
		<ActivityRail
			active={activePanel}
			hasOutput={!!result}
			historyCount={history.length}
			onSelect={handleRailSelect}
		/>
	{/snippet}

	{#snippet sidePanel()}
		{#if activePanel === 'import'}
			<ImportPanel
				{slots}
				{visibleKeys}
				refKeys={REF_KEYS}
				{fileInsights}
				platforms={PLATFORMS}
				{selectedPlatforms}
				{hasRefFiles}
				{bestPractices}
				{bulkDropActive}
				{canGenerate}
				{loading}
				{errorMsg}
				{requiredFilled}
				{visibleFilled}
				{figmaConnected}
				{figmaFetching}
				{showSettings}
				{chatWebhookUrl}
				{githubPat}
				{githubRepos}
				{figmaFileKey}
				{figmaPat}
				{figmaWebhookPasscode}
				iconFigma={ICON_FIGMA}
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				onFileInput={handleFileInput}
				onClearFile={clearFile}
				onBulkDragEnter={(e) => { e.preventDefault(); bulkDropActive = true; }}
				onBulkDragOver={(e) => { e.preventDefault(); }}
				onBulkDragLeave={(e) => { if (e.currentTarget === e.target || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) bulkDropActive = false; }}
				onBulkDrop={handleBulkDrop}
				onBestPracticesChange={(val) => { bestPractices = val; saveBestPractices(val); }}
				onExportConfig={exportConfig}
				onImportConfig={importConfigFile}
				onClearAll={clearAll}
				onGenerate={generate}
				onFigmaFetch={onFigmaFetch}
				onSettingsToggle={() => (showSettings = !showSettings)}
				{onChatWebhookChange}
				{onGithubPatChange}
				onGithubRepoChange={(platform, field, e) => onGithubRepoChange(platform, field as keyof NonNullable<GithubConfigs[Platform]>, e)}
				onFigmaFileKeyChange={onFigmaFileKeyChange}
				onFigmaPatChange={onFigmaPatChange}
				onFigmaPasscodeChange={onFigmaPasscodeChange}
			/>
		{:else if activePanel === 'files'}
			<ExplorerPanel
				files={visibleFiles}
				{activeTab}
				{diffs}
				{modifications}
				onTabSelect={(f) => (activeTab = f)}
				onTabKeydown={handleTabKeydown}
			/>
		{:else if activePanel === 'history'}
			<HistoryPanel
				{history}
				{platformColor}
				onRestore={restoreHistory}
				onClose={() => (activePanel = null)}
			/>
		{:else if activePanel === 'settings'}
			<SettingsPanel
				show={true}
				{selectedPlatforms}
				{chatWebhookUrl}
				{githubPat}
				{githubRepos}
				{figmaFileKey}
				{figmaPat}
				{figmaFetching}
				{figmaWebhookPasscode}
				{figmaWebhookEvent}
				{platformColor}
				onToggle={() => (activePanel = null)}
				{onChatWebhookChange}
				{onGithubPatChange}
				{onGithubRepoChange}
				onFigmaFileKeyChange={onFigmaFileKeyChange}
				onFigmaPatChange={onFigmaPatChange}
				{onFigmaFetch}
				{onFigmaPasscodeChange}
			/>
		{/if}
	{/snippet}

	{#snippet editor()}
		<EditorPane
			{result}
			{visibleFiles}
			{activeTab}
			{highlights}
			{diffs}
			{viewModes}
			{modifications}
			{renames}
			{familyRenames}
			{tokenCoverage}
			{deprecations}
			{impactedTokens}
			{searchQuery}
			{searchInputEl}
			{searchShortcutHint}
			{highlightedLines}
			{wrapLines}
			{showSectionNav}
			{showChangeSummary}
			{collapsedSections}
			{currentBreadcrumb}
			{codeScrollTop}
			{codeScrollHeight}
			{codeClientHeight}
			{codeScrollEl}
			{lastGeneratedAt}
			{sendingPrs}
			{diffTotals}
			{diffNavIndex}
			{swatches}
			{showSwatches}
			{swatchComparisons}
			{swatchTab}
			{showHistory}
			{history}
			{prResults}
			{platformMismatches}
			themes={THEMES}
			{selectedTheme}
			{showThemePicker}
			{selectedPlatforms}
			idleGrid={IDLE_GRID}
			{formatTime}
			{timeAgo}
			{platformColor}
			onTabSelect={(f) => (activeTab = f)}
			onTabKeydown={handleTabKeydown}
			onViewModeChange={(filename, mode) => (viewModes[filename] = mode)}
			onSearchChange={(q) => (searchQuery = q)}
			onSearchInputBind={(el) => (searchInputEl = el)}
			onCodeKeydown={handleCodeKeydown}
			onCodeScroll={handleCodeScroll}
			onCodeScrollBind={(el) => (codeScrollEl = el)}
			onLineClick={handleLineClick}
			onSectionNavToggle={() => (showSectionNav = !showSectionNav)}
			onScrollToLine={scrollToLine}
			onWrapToggle={() => (wrapLines = !wrapLines)}
			onChangeSummaryToggle={(f) => (showChangeSummary[f] = !showChangeSummary[f])}
			onNavigateDiff={navigateDiff}
			onSeekMinimap={seekMinimap}
			onDownloadZip={downloadZip}
			onCopyFile={() => { if (activeFile) copyToClipboard(activeFile.content); }}
			onSendPRs={sendPRs}
			onCopyChangelog={() => copyToClipboard(generateChangelog(buildChangelogCtx()))}
			onToggleSwatches={() => (showSwatches = !showSwatches)}
			onSwatchTabChange={(t) => (swatchTab = t)}
			onToggleHistory={() => (showHistory = !showHistory)}
			onRestoreHistory={restoreHistory}
			onDismissPrResults={() => (prResults = [])}
			onRetryPr={retryPr}
			onChangeTheme={changeTheme}
			onThemePickerToggle={() => (showThemePicker = !showThemePicker)}
			{extractSections}
			{extractDiffColor}
			{computeHunkHeaders}
			{nearestContext}
			{langLabel}
			{formatFileSize}
		/>
	{/snippet}

	{#snippet statusBar()}
		<StatusBar
			{activeFile}
			{diffs}
			{modifications}
			{diffTotals}
			warnings={result?.warnings ?? []}
			{lastGeneratedAt}
			{langLabel}
			{formatFileSize}
			{timeAgo}
		/>
	{/snippet}

	{#snippet bottomTab()}
		<BottomTabBar
			active={activePanel}
			hasOutput={!!result}
			historyCount={history.length}
			onSelect={handleRailSelect}
		/>
	{/snippet}
</AppShell>

<style>
	:global(:root) {
		--brand-color: #e83030;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: var(--fontStack-sansSerif);
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		-webkit-font-smoothing: antialiased;
		font-size: var(--base-text-size-sm);
		line-height: var(--base-text-lineHeight-normal);
		overflow: hidden;
	}

	:global(:focus-visible) {
		outline: 2px solid var(--focus-outlineColor);
		outline-offset: 2px;
	}

	/* ─── Shiki globals ────────────────────────────────────────────────────────── */
	:global(.numbered) { counter-reset: line-number; }
	:global(.numbered .line), :global(.numbered code .line) { counter-increment: line-number; }
	:global(.numbered .line::before), :global(.numbered code .line::before) {
		content: counter(line-number);
		display: inline-block;
		width: 3.5ch;
		margin-right: 24px;
		padding-right: 8px;
		text-align: right;
		color: var(--fgColor-disabled);
		border-right: 1px solid var(--borderColor-muted);
		user-select: none;
		font-size: 10.5px;
	}

	:global(.shiki-wrap pre) {
		background: transparent !important;
		padding: 16px 24px 16px 16px;
		font-family: 'IBM Plex Mono', var(--fontStack-monospace) !important;
		font-size: 12.5px !important;
		font-weight: 400 !important;
		line-height: 1.8 !important;
		tab-size: 2 !important;
		margin: 0;
	}

	:global(.shiki-wrap code) { font-family: inherit !important; font-size: inherit !important; }
	:global(.shiki-wrap .line) { min-height: 1.8em; cursor: pointer; border-radius: 2px; }
	:global(.shiki-wrap .line:hover) {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 15%, transparent);
		box-shadow: inset 0 0 80px color-mix(in srgb, var(--bgColor-accent-muted) 8%, transparent);
		transition: background 300ms ease, box-shadow 300ms ease;
	}
	:global(.shiki-wrap .line--highlighted) { background: color-mix(in srgb, var(--bgColor-attention-muted) 40%, transparent) !important; }
	:global(.shiki-wrap .line--highlighted::before) { color: var(--fgColor-attention) !important; border-right-color: var(--borderColor-attention-muted) !important; }
	:global(.shiki-wrap--wrap pre) { white-space: pre-wrap !important; word-break: break-all; }

	:global(.code-color-dot) {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 2px;
		vertical-align: middle;
		margin-right: 3px;
		margin-bottom: 1px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		flex-shrink: 0;
	}

	:global(.search-mark) {
		background: var(--bgColor-attention-muted);
		color: var(--fgColor-attention);
		border-radius: 2px;
		padding: 0 1px;
	}

	/* ─── Fold / Blame globals ─────────────────────────────────────────────────── */
	:global(.fold-toggle) {
		display: inline-block; width: 14px; font-size: 8px; text-align: center;
		cursor: pointer; color: var(--fgColor-disabled); user-select: none;
		margin-right: 2px; vertical-align: middle; opacity: 0;
		transition: opacity var(--base-duration-100) var(--base-easing-ease);
	}
	:global(.shiki-wrap .line:hover .fold-toggle), :global(.fold-toggle--collapsed) { opacity: 1; }
	:global(.fold-toggle:hover) { color: var(--fgColor-accent); }
	:global(.fold-placeholder) {
		padding: 2px 16px 2px 60px;
		font-family: var(--fontStack-monospace); font-size: 10.5px;
		color: var(--fgColor-disabled); background: var(--bgColor-inset);
		border-top: 1px dashed var(--borderColor-muted); border-bottom: 1px dashed var(--borderColor-muted);
		cursor: pointer; user-select: none; text-align: center;
	}
	:global(.fold-placeholder:hover) { color: var(--fgColor-accent); background: color-mix(in srgb, var(--bgColor-accent-muted) 20%, transparent); }
	:global(.blame-mark) { display: inline-block; width: 3px; height: 100%; min-height: 1em; margin-right: 3px; vertical-align: middle; border-radius: 1px; flex-shrink: 0; }
	:global(.blame-mark--new) { background: var(--bgColor-success-emphasis); opacity: 0.6; }
	:global(.blame-mark--modified) { background: var(--bgColor-attention-emphasis); opacity: 0.6; }

	/* ─── Swatch rows (shared by idle preview and swatch panel) ─────────────── */
	:global(.swatch-row) {
		display: flex; flex-wrap: wrap; gap: 6px;
	}
	:global(.swatch-item) {
		display: flex; flex-direction: column; align-items: center; gap: 3px;
	}
	:global(.swatch-color) {
		width: 32px; height: 24px; border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	:global(.swatch-hex) {
		font-family: var(--fontStack-monospace); font-size: 8px;
		color: var(--fgColor-disabled); white-space: nowrap;
	}
</style>
