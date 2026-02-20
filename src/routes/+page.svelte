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
		loadFigmaWebhookPasscode
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
		generateChangelog
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
	import PlatformConsistency from '$lib/components/PlatformConsistency.svelte';
	import HistoryPanel from '$lib/components/HistoryPanel.svelte';
	import PrResults from '$lib/components/PrResults.svelte';
	import SwatchPanel from '$lib/components/SwatchPanel.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';

	// ─── Static grid (pre-generated, no reactive Math.random) ────────────────────

	const IDLE_GRID = Array.from({ length: 80 }, () => {
		const r = Math.random();
		return r > 0.85 ? (Math.random() > 0.5 ? '1' : '0') : '·';
	});

	// ─── Platform toggle ──────────────────────────────────────────────────────────

	const ICON_WEB = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

	const ICON_ANDROID = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341A7.022 7.022 0 0 0 19 11c0-3.866-3.134-7-7-7s-7 3.134-7 7a7.022 7.022 0 0 0 1.477 4.341l-1.33 2.309a.5.5 0 0 0 .433.75H7v1.1a1.4 1.4 0 1 0 2.8 0v-1.1h4.4v1.1a1.4 1.4 0 1 0 2.8 0v-1.1h.42a.5.5 0 0 0 .433-.75l-1.33-2.309zM9.5 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/><path d="M15.657 4.344l.848-1.468a.5.5 0 0 0-.866-.5l-.883 1.528A6.965 6.965 0 0 0 12 3.5c-.963 0-1.88.196-2.756.404L8.361 2.376a.5.5 0 0 0-.866.5l.848 1.468A6.994 6.994 0 0 0 5 9h14a6.994 6.994 0 0 0-3.343-4.656z"/></svg>`;

	const ICON_IOS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`;

	const ICON_FIGMA = `<svg width="12" height="14" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true"><path d="M6 28c2.21 0 4-1.79 4-4v-4H6c-2.21 0-4 1.79-4 4s1.79 4 4 4z"/><path d="M2 16c0-2.21 1.79-4 4-4h4v8H6c-2.21 0-4-1.79-4-4z"/><path d="M2 8c0-2.21 1.79-4 4-4h4v8H6C3.79 12 2 10.21 2 8z"/><path d="M10 4h4c2.21 0 4 1.79 4 4s-1.79 4-4 4h-4V4z"/><path d="M22 16c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4z"/></svg>`;

	const PLATFORMS: {
		id: Platform;
		label: string;
		sublabel: string;
		color: string;
		icon: string;
	}[] = [
		{
			id: 'web',
			label: 'Web',
			sublabel: 'SCSS · TS',
			color: 'var(--fgColor-accent)',
			icon: ICON_WEB
		},
		{ id: 'android', label: 'Android', sublabel: 'Kotlin', color: '#3DDC84', icon: ICON_ANDROID },
		{ id: 'ios', label: 'iOS', sublabel: 'Swift', color: '#007AFF', icon: ICON_IOS }
	];

	let selectedPlatforms = $state<Platform[]>(['web']);

	function selectPlatform(id: Platform) {
		selectedPlatforms = [id];
		if (browser) savePlatforms([id]);
	}

	// ─── File slots ───────────────────────────────────────────────────────────────

	const ALL_KEYS: DropZoneKey[] = [
		'lightColors',
		'darkColors',
		'values',
		'typography',
		'referencePrimitivesScss',
		'referenceColorsScss',
		'referencePrimitivesTs',
		'referenceColorsTs',
		'referenceColorsSwift',
		'referenceColorsKotlin'
	];

	const REF_KEYS: DropZoneKey[] = [
		'referencePrimitivesScss',
		'referenceColorsScss',
		'referencePrimitivesTs',
		'referenceColorsTs',
		'referenceColorsSwift',
		'referenceColorsKotlin'
	];

	// Slots that are visible given the current platform selection
	const visibleKeys = $derived<DropZoneKey[]>([
		'lightColors',
		'darkColors',
		'values',
		'typography',
		...(selectedPlatforms.includes('web')
			? ([
					'referencePrimitivesScss',
					'referenceColorsScss',
					'referencePrimitivesTs',
					'referenceColorsTs'
				] as DropZoneKey[])
			: []),
		...(selectedPlatforms.includes('ios') ? (['referenceColorsSwift'] as DropZoneKey[]) : []),
		...(selectedPlatforms.includes('android') ? (['referenceColorsKotlin'] as DropZoneKey[]) : [])
	]);

	const slots = $state<Record<DropZoneKey, FileSlot>>({
		lightColors: {
			label: 'Light.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma › Variables › Export JSON — light mode',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: true,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		darkColors: {
			label: 'Dark.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma › Variables › Export JSON — dark mode',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: true,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		values: {
			label: 'Value.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma spacing & integer scale',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: true,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referencePrimitivesScss: {
			label: 'Primitives.scss',
			accept: '.scss,text/plain',
			hint: 'Current file — primitive color variables',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsScss: {
			label: 'Colors.scss',
			accept: '.scss,text/plain',
			hint: 'Current file — semantic color variables',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referencePrimitivesTs: {
			label: 'Primitives.ts',
			accept: '.ts,text/plain',
			hint: 'Current file — primitive color constants',
			ext: 'ts',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsTs: {
			label: 'Colors.ts',
			accept: '.ts,text/plain',
			hint: 'Current file — semantic color constants',
			ext: 'ts',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsSwift: {
			label: 'Colors.swift',
			accept: '.swift,text/plain',
			hint: 'Current file — matches existing naming conventions',
			ext: 'swift',
			platforms: ['ios'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsKotlin: {
			label: 'Colors.kt',
			accept: '.kt,text/plain',
			hint: 'Current file — matches existing naming conventions',
			ext: 'kt',
			platforms: ['android'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		typography: {
			label: 'typography.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma text styles export — generates Typography.scss/ts/swift/kt',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		}
	});

	// Required slots (Figma JSON) — always 3
	const requiredFilled = $derived(
		(['lightColors', 'darkColors', 'values'] as DropZoneKey[]).filter((k) => !!slots[k].file).length
	);

	// Declared early so canGenerate can reference it
	let loading = $state(false);

	const canGenerate = $derived(requiredFilled === 3 && !loading);

	// Count visible filled slots (for status display)
	const visibleFilled = $derived(visibleKeys.filter((k) => !!slots[k].file).length);

	// ─── Lifecycle: restore from localStorage ─────────────────────────────────────

	onMount(() => {
		if (!browser) return;

		// Restore platform selection
		const storedPlatforms = loadPlatforms();
		if (storedPlatforms?.length) selectedPlatforms = storedPlatforms;

		// Restore reference files from localStorage
		for (const key of REF_KEYS) {
			const stored = loadRefFile(key);
			if (!stored) continue;
			const synthetic = new File([stored.content], stored.name, { type: 'text/plain' });
			slots[key].file = synthetic;
			slots[key].restored = true;
		}

		// Restore last result
		const storedResult = loadResult();
		if (storedResult) {
			result = storedResult.data as GenerateResponse;
			lastGeneratedAt = new Date(storedResult.savedAt);
			if (result?.files?.length) activeTab = result.files[0].filename;
		}

		// Restore history
		history = loadHistory();

		// Restore settings
		chatWebhookUrl = loadNotifyUrl();
		githubPat = loadGithubPat();
		githubRepos = loadGithubRepos();
		figmaWebhookPasscode = loadFigmaWebhookPasscode();

		// Restore theme preference
		const storedTheme = localStorage.getItem('token-sync:theme') as ThemeId | null;
		if (storedTheme && THEMES.some((t) => t.id === storedTheme)) {
			selectedTheme = storedTheme;
		}
	});

	// ─── State ────────────────────────────────────────────────────────────────────

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
	let platformMismatches = $state<PlatformMismatch[]>([]);
	let dependencyMap = $state<DependencyEntry[]>([]);
	let impactedTokens = $state<ImpactEntry[]>([]);

	// ─── Themes ──────────────────────────────────────────────────────────────
	const THEMES = [
		{ id: 'github-dark-dimmed', label: 'GitHub Dimmed', bg: '#22272e', mode: 'dark' as const },
		{ id: 'github-dark', label: 'GitHub Dark', bg: '#24292e', mode: 'dark' as const },
		{ id: 'one-dark-pro', label: 'One Dark', bg: '#282c34', mode: 'dark' as const },
		{ id: 'dracula', label: 'Dracula', bg: '#282A36', mode: 'dark' as const },
		{ id: 'catppuccin-mocha', label: 'Catppuccin', bg: '#1e1e2e', mode: 'dark' as const },
		{ id: 'night-owl', label: 'Night Owl', bg: '#011627', mode: 'dark' as const },
		{ id: 'github-light', label: 'GitHub Light', bg: '#ffffff', mode: 'light' as const },
		{ id: 'catppuccin-latte', label: 'Catppuccin Latte', bg: '#eff1f5', mode: 'light' as const },
		{ id: 'min-light', label: 'Min Light', bg: '#ffffff', mode: 'light' as const }
	] as const;
	type ThemeId = (typeof THEMES)[number]['id'];

	let selectedTheme = $state<ThemeId>('one-dark-pro');
	let showThemePicker = $state(false);
	let appColorMode = $state<'dark' | 'light'>('dark');

	function detectAppColorMode(): 'dark' | 'light' {
		if (!browser) return 'dark';
		const mode = document.documentElement.getAttribute('data-color-mode');
		if (mode === 'light') return 'light';
		if (mode === 'auto') {
			return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
		}
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
					const fallback = THEMES.find((t) => t.mode === appColorMode);
					if (fallback) selectedTheme = fallback.id;
				}
			}
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode'] });
	}

	let swatches = $state<Swatch[]>([]);
	let showSwatches = $state(false);
	let fileInsights = $state<Partial<Record<DropZoneKey, FileInsight>>>({});

	// ─── Search ──────────────────────────────────────────────────────────────
	let searchQuery = $state('');
	let searchInputEl = $state<HTMLInputElement | null>(null);
	const isMac = browser && /Mac|iPhone|iPad/.test(navigator.userAgent);
	const searchShortcutHint = isMac ? '⌘F' : 'Ctrl+F';

	// ─── History ─────────────────────────────────────────────────────────────
	let showHistory = $state(false);
	let history = $state<HistoryEntry[]>([]);

	// ─── Settings ─────────────────────────────────────────────────────────────
	let showSettings = $state(false);

	// ─── Google Chat ─────────────────────────────────────────────────────────
	let chatWebhookUrl = $state('');

	// ─── GitHub PR ────────────────────────────────────────────────────────────
	let githubPat = $state('');
	let githubRepos = $state<GithubConfigs>({});
	let sendingPrs = $state(false);
	let prResults = $state<PrResult[]>([]);
	let bulkDropActive = $state(false);

	// ─── Figma Webhook ────────────────────────────────────────────────────────
	let figmaWebhookPasscode = $state('');
	let figmaWebhookEvent = $state<{
		file_name: string;
		timestamp: string;
		receivedAt: string;
	} | null>(null);
	let figmaWebhookSeen = $state(true);

	let showChangeSummary = $state<Record<string, boolean>>({});
	let highlightedLines = $state<{ start: number; end: number } | null>(null);
	let wrapLines = $state(false);
	let showSectionNav = $state(false);

	// ─── Helpers ──────────────────────────────────────────────────────────────────

	function extColor(ext: string): string {
		if (ext === 'scss') return '#F06090';
		if (ext === 'ts') return '#4D9EFF';
		if (ext === 'swift') return '#FF8040';
		if (ext === 'kt') return '#B060FF';
		return '#F5A623';
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
		return {
			files: result?.files ?? [],
			platforms: result?.platforms ?? [],
			platformLabels: PLATFORMS,
			diffs,
			deprecations,
			modifications,
			renames,
			familyRenames,
			tokenCoverage,
			platformMismatches,
			impactedTokens
		};
	}

	// ─── Drag & drop ─────────────────────────────────────────────────────────────

	const dragCounters: Partial<Record<DropZoneKey, number>> = {};

	function handleDragEnter(key: DropZoneKey, e: DragEvent) {
		e.preventDefault();
		dragCounters[key] = (dragCounters[key] ?? 0) + 1;
		slots[key].dragging = true;
	}
	function handleDragOver(key: DropZoneKey, e: DragEvent) {
		e.preventDefault();
	}
	function handleDragLeave(key: DropZoneKey) {
		dragCounters[key] = (dragCounters[key] ?? 1) - 1;
		if ((dragCounters[key] ?? 0) <= 0) {
			dragCounters[key] = 0;
			slots[key].dragging = false;
		}
	}
	function handleDrop(key: DropZoneKey, e: DragEvent) {
		e.preventDefault();
		dragCounters[key] = 0;
		slots[key].dragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) assignFile(key, file);
	}
	function handleFileInput(key: DropZoneKey, e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) assignFile(key, input.files[0]);
	}

	async function assignFile(key: DropZoneKey, file: File) {
		let content: string;
		try {
			content = await file.text();
		} catch {
			toast.error(`Could not read ${file.name} — is it a valid text file?`);
			slots[key].file = null;
			return;
		}
		slots[key].file = file;
		slots[key].restored = false;
		slots[key].warning = validateFigmaJson(key, content);
		fileInsights[key] = computeInsight(key, content);
		if (REF_KEYS.includes(key)) {
			saveRefFile(key, file.name, content);
		}
		if (key === 'lightColors') {
			try {
				const parsed = JSON.parse(content);
				swatches = parseSwatches(parsed);
				dependencyMap = buildDependencyMap(parsed);
			} catch {
				swatches = [];
				dependencyMap = [];
			}
		}
	}

	function clearFile(key: DropZoneKey, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		slots[key].file = null;
		slots[key].restored = false;
		slots[key].warning = null;
		if (REF_KEYS.includes(key)) clearRefFile(key);
	}

	function clearAll() {
		for (const key of ALL_KEYS) {
			slots[key].file = null;
			slots[key].restored = false;
			slots[key].warning = null;
		}
		clearAllStorage();
		result = null;
		lastGeneratedAt = null;
		highlights = {};
		diffs = {};
		viewModes = {};
		swatches = [];
		fileInsights = {};
		showSwatches = false;
		searchQuery = '';
		showHistory = false;
		history = [];
		prResults = [];
		modifications = {};
		renames = {};
		familyRenames = {};
		tokenCoverage = {};
		platformMismatches = [];
		dependencyMap = [];
		impactedTokens = [];
		diffNavIndex = {};
		toast.success('All files cleared');
	}

	// ─── Multi-file drag-and-drop ─────────────────────────────────────────────────

	async function autoDetectSlot(file: File): Promise<DropZoneKey | null> {
		const name = file.name.toLowerCase();
		if (name.includes('light')) return 'lightColors';
		if (name.includes('dark')) return 'darkColors';
		if (name.includes('value') || name.includes('spacing')) return 'values';
		if (name.includes('typography') || name.includes('typo')) return 'typography';

		try {
			const preview = await file.slice(0, 4096).text();
			const json = JSON.parse(preview) as Record<string, unknown>;
			function hasType(obj: unknown, t: string): boolean {
				if (!obj || typeof obj !== 'object') return false;
				const o = obj as Record<string, unknown>;
				if (o.$type === t) return true;
				return Object.entries(o).some(([k, v]) => !k.startsWith('$') && hasType(v, t));
			}
			if (json['typography'] || hasType(json, 'typography')) return 'typography';
			if (hasType(json, 'number')) return 'values';
			if (hasType(json, 'color')) {
				const topKeys = Object.keys(json).join(' ').toLowerCase();
				if (topKeys.includes('dark')) return 'darkColors';
				return 'lightColors';
			}
		} catch {
			/* not valid JSON, skip */
		}
		return null;
	}

	async function handleBulkDrop(e: DragEvent) {
		e.preventDefault();
		bulkDropActive = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.name.endsWith('.json'));
		if (!files.length) {
			toast.error('No .json files found in the drop');
			return;
		}
		let assigned = 0;
		const unmatched: string[] = [];
		for (const file of files) {
			const slot = await autoDetectSlot(file);
			if (slot) {
				await assignFile(slot, file);
				assigned++;
			} else {
				unmatched.push(file.name);
			}
		}
		if (assigned) toast.success(`${assigned} file${assigned > 1 ? 's' : ''} auto-assigned`);
		if (unmatched.length) toast.error(`Could not assign: ${unmatched.join(', ')}`);
	}

	// ─── Generate ─────────────────────────────────────────────────────────────────

	async function generate() {
		if (!canGenerate) return;
		loading = true;
		errorMsg = null;
		result = null;
		highlights = {};
		diffs = {};
		viewModes = {};

		try {
			const fd = new FormData();
			fd.append('lightColors', slots.lightColors.file!);
			fd.append('darkColors', slots.darkColors.file!);
			fd.append('values', slots.values.file!);
			fd.append('platforms', JSON.stringify(selectedPlatforms));

			// Append optional files if present
			const optionalKeys: DropZoneKey[] = [
				'typography',
				'referencePrimitivesScss',
				'referenceColorsScss',
				'referencePrimitivesTs',
				'referenceColorsTs',
				'referenceColorsSwift',
				'referenceColorsKotlin'
			];
			for (const key of optionalKeys) {
				if (slots[key].file) fd.append(key, slots[key].file!);
			}

			const res = await fetch('/api/generate', { method: 'POST', body: fd });
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `HTTP ${res.status}`);
			}

			let parsed: GenerateResponse;
			try {
				parsed = await res.json();
			} catch {
				throw new Error('Server returned invalid JSON');
			}

			if (!parsed?.files?.length) {
				throw new Error('No files were generated');
			}

			result = parsed;
			lastGeneratedAt = new Date();
			activeTab = parsed.files[0].filename;
			searchQuery = '';
			showHistory = false;

			saveResult(parsed);

			const entry: HistoryEntry = {
				id: Date.now().toString(),
				generatedAt: new Date().toISOString(),
				platforms: parsed.platforms,
				stats: parsed.stats,
				files: parsed.files
			};
			saveToHistory(entry);
			history = loadHistory();

			toast.success(`${parsed.files.length} files generated`);

			if (chatWebhookUrl) {
				notifyGoogleChat(parsed).catch(() => {});
			}
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Generation failed';
			toast.error(errorMsg ?? 'Generation failed');
		} finally {
			loading = false;
		}
	}

	// ─── Syntax Highlighting ──────────────────────────────────────────────────────

	$effect(() => {
		if (result?.files && browser) {
			highlightAll(result.files);
			computeAllDiffs(result.files);
			swatchComparisons = computeSwatchComparison(result.files);
		}
	});

	// Re-highlight when theme changes
	$effect(() => {
		if (selectedTheme && result?.files && browser) {
			highlightAll(result.files);
		}
	});

	// Apply line highlight classes to rendered Shiki DOM
	$effect(() => {
		const _hl = highlightedLines;
		if (!browser) return;
		requestAnimationFrame(() => {
			const wrap =
				document.querySelector('.shiki-wrap code') ?? document.querySelector('.code-pre code');
			if (!wrap) return;
			const lines = wrap.querySelectorAll(':scope > .line');
			lines.forEach((el, i) => {
				const lineNum = i + 1;
				if (_hl && lineNum >= _hl.start && lineNum <= _hl.end) {
					el.classList.add('line--highlighted');
				} else {
					el.classList.remove('line--highlighted');
				}
			});
		});
	});

	// ── Color swatch injection ────────────────────────────────────────────────
	function injectColorSwatches(html: string): string {
		// Split by HTML tags, only process text nodes (between tags)
		const parts = html.split(/(<[^>]*>)/);
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].startsWith('<')) continue;
			// #RRGGBB or #RRGGBBAA or #RGB (CSS/SCSS/TypeScript)
			parts[i] = parts[i].replace(
				/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g,
				(match, hex) => {
					const full =
						hex.length === 3
							? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
							: `#${hex.slice(0, 6)}`;
					return `<span class="code-color-dot" style="background:${full}" aria-hidden="true"></span>${match}`;
				}
			);
			// 0xFFRRGGBB or 0xRRGGBB (Swift/Kotlin)
			parts[i] = parts[i].replace(/0x([0-9a-fA-F]{6,8})(?![0-9a-fA-F])/gi, (match, hex) => {
				const rgb = hex.length === 8 ? hex.slice(2) : hex;
				const full = `#${rgb.slice(0, 6)}`;
				return `<span class="code-color-dot" style="background:${full}" aria-hidden="true"></span>${match}`;
			});
		}
		return parts.join('');
	}

	async function highlightAll(files: GeneratedFile[]) {
		const { codeToHtml } = await import('shiki');
		const theme = THEMES.find((t) => t.id === selectedTheme) ?? THEMES[2];
		const langMap: Record<string, string> = {
			scss: 'scss',
			typescript: 'typescript',
			swift: 'swift',
			kotlin: 'kotlin'
		};
		for (const file of files) {
			const lang = langMap[file.format] ?? 'text';
			try {
				const raw = await codeToHtml(file.content, {
					lang,
					theme: theme.id,
					colorReplacements: { [theme.bg]: 'transparent' }
				});
				highlights[file.filename] = injectColorSwatches(raw);
			} catch {
				// fallback to plain text
			}
		}
	}

	// ─── Diff ─────────────────────────────────────────────────────────────────────

	async function computeAllDiffs(files: GeneratedFile[]) {
		const { diffLines, diffWords } = await import('diff');
		for (const file of files) {
			if (!file.referenceContent) continue;
			const changes = diffLines(file.referenceContent, file.content);
			const lines: DiffLine[] = [];
			let oldLine = 1;
			let newLine = 1;
			for (const change of changes) {
				const type = change.added ? 'add' : change.removed ? 'remove' : 'equal';
				const texts = change.value.replace(/\n$/, '').split('\n');
				for (const text of texts) {
					const dl: DiffLine = { type, text };
					if (type === 'equal') {
						dl.oldLineNum = oldLine++;
						dl.newLineNum = newLine++;
					} else if (type === 'remove') {
						dl.oldLineNum = oldLine++;
					} else {
						dl.newLineNum = newLine++;
					}
					lines.push(dl);
				}
			}
			// Word-level diff: pair consecutive remove+add lines
			enrichWordDiffs(lines, diffWords);
			diffs[file.filename] = lines;
		}
		deprecations = extractDeprecations(diffs);
		modifications = extractModifiedTokens(diffs);
		renames = detectRenames(diffs);
		familyRenames = detectFamilyRenames(renames);
		tokenCoverage = computeTokenCoverage(files);
		if (files.length >= 2) {
			platformMismatches = validateCrossPlatform(files);
		} else {
			platformMismatches = [];
		}
		if (dependencyMap.length > 0) {
			impactedTokens = computeImpact(dependencyMap, modifications, renames, deprecations);
		}
	}

	function getViewMode(filename: string): ViewMode {
		return viewModes[filename] ?? 'code';
	}

	// ─── Download ─────────────────────────────────────────────────────────────────

	function downloadFile(file: GeneratedFile) {
		const blob = new Blob([file.content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function downloadZip() {
		if (!result?.files.length) return;
		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		for (const file of result.files) {
			zip.file(file.filename, file.content);
		}
		const blob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `token-sync-${new Date().toISOString().slice(0, 10)}.zip`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('ZIP downloaded');
	}

	// ─── Copy ─────────────────────────────────────────────────────────────────────

	async function copyToClipboard(content: string) {
		try {
			await navigator.clipboard.writeText(content);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Copy failed');
		}
	}

	// ─── Diff Navigation ──────────────────────────────────────────────────────────

	let diffNavIndex = $state<Record<string, number>>({});

	function navigateDiff(filename: string, direction: 'prev' | 'next') {
		const lines = diffs[filename];
		if (!lines) return;
		const indices = diffChangeIndices(lines);
		if (!indices.length) return;
		const current = diffNavIndex[filename] ?? -1;
		let next: number;
		if (direction === 'next') {
			next = current < indices.length - 1 ? current + 1 : 0;
		} else {
			next = current > 0 ? current - 1 : indices.length - 1;
		}
		diffNavIndex[filename] = next;
		const el = document.getElementById(`diff-line-${filename}-${indices[next]}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// ─── Keyboard navigation for file list ───────────────────────────────────────

	function handleTabKeydown(e: KeyboardEvent) {
		if (!result?.files.length) return;
		const filenames = result.files.map((f) => f.filename);
		const idx = filenames.indexOf(activeTab);
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
			e.preventDefault();
			activeTab = filenames[(idx + 1) % filenames.length];
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
			e.preventDefault();
			activeTab = filenames[(idx - 1 + filenames.length) % filenames.length];
		}
	}

	let swatchComparisons = $state<SwatchComparison[]>([]);
	let swatchTab = $state<'all' | 'changes'>('all');

	// ─── Shareable Config ─────────────────────────────────────────────────────────

	async function exportConfig() {
		const refData: Record<string, { name: string; content: string }> = {};
		for (const key of REF_KEYS) {
			if (slots[key].file) {
				const content = await slots[key].file!.text();
				refData[key] = { name: slots[key].file!.name, content };
			}
		}
		const config = {
			version: 1,
			platforms: selectedPlatforms,
			referenceFiles: refData
		};
		const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'token-sync-config.json';
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Config exported');
	}

	function importConfigFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		file.text().then((text) => {
			try {
				const config = JSON.parse(text) as {
					version: number;
					platforms: Platform[];
					referenceFiles: Record<string, { name: string; content: string }>;
				};
				if (config.platforms?.length) {
					selectedPlatforms = config.platforms;
					if (browser) savePlatforms(selectedPlatforms);
				}
				for (const [key, data] of Object.entries(config.referenceFiles ?? {})) {
					if (!REF_KEYS.includes(key as DropZoneKey)) continue;
					const synthetic = new File([data.content], data.name, { type: 'text/plain' });
					slots[key as DropZoneKey].file = synthetic;
					slots[key as DropZoneKey].restored = true;
					saveRefFile(key, data.name, data.content);
					fileInsights[key as DropZoneKey] = computeInsight(key as DropZoneKey, data.content);
				}
				toast.success('Config imported');
			} catch {
				toast.error('Invalid config file');
			}
		});
		input.value = '';
	}

	function handleCodeKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
			e.preventDefault();
			searchInputEl?.focus();
		}
		if (e.key === 'Escape') {
			highlightedLines = null;
		}
	}

	function handleLineClick(lineNum: number, e: MouseEvent) {
		if (e.shiftKey && highlightedLines) {
			const start = Math.min(highlightedLines.start, lineNum);
			const end = Math.max(highlightedLines.start, lineNum);
			highlightedLines = { start, end };
		} else {
			highlightedLines =
				highlightedLines?.start === lineNum && highlightedLines?.end === lineNum
					? null
					: { start: lineNum, end: lineNum };
		}
	}

	function extractSections(content: string): { label: string; line: number }[] {
		const sections: { label: string; line: number }[] = [];
		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const markMatch = line.match(/\/\/\s*MARK:\s*-?\s*(.+)/);
			if (markMatch) {
				sections.push({ label: markMatch[1].trim(), line: i + 1 });
				continue;
			}
			const sectionMatch = line.match(
				/^\/\/\s*(Primitive|Semantic|Light|Dark|Material|Typography|Spacing|CSS custom|SCSS|@property|:root)\b.*$/i
			);
			if (sectionMatch) {
				sections.push({ label: line.replace(/^\/\/\s*/, '').slice(0, 50), line: i + 1 });
				continue;
			}
			const objectMatch = line.match(
				/^(?:object|public extension|public struct|export interface|@mixin)\s+(\S+)/
			);
			if (objectMatch) {
				sections.push({ label: objectMatch[0].slice(0, 50), line: i + 1 });
			}
		}
		return sections;
	}

	function scrollToLine(lineNum: number) {
		showSectionNav = false;
		highlightedLines = { start: lineNum, end: lineNum };
		requestAnimationFrame(() => {
			const el =
				document.querySelector(`.shiki-wrap .line:nth-child(${lineNum})`) ??
				document.querySelector(`.code-pre code .line:nth-child(${lineNum})`);
			el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	// ─── History helpers ───────────────────────────────────────────────────────

	function restoreHistory(entry: HistoryEntry) {
		result = {
			success: true,
			platforms: entry.platforms,
			stats: entry.stats,
			files: entry.files
		};
		lastGeneratedAt = new Date(entry.generatedAt);
		if (result.files.length) activeTab = result.files[0].filename;
		highlights = {};
		diffs = {};
		viewModes = {};
		searchQuery = '';
		showHistory = false;
		toast.success('Previous generation restored');
	}

	// ─── Google Chat notification ──────────────────────────────────────────────

	async function notifyGoogleChat(res: GenerateResponse) {
		try {
			const changelog = generateChangelog(buildChangelogCtx());
			const r = await fetch('/api/notify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					webhookUrl: chatWebhookUrl,
					platforms: res.platforms,
					stats: res.stats,
					filesCount: res.files.length,
					generatedAt: new Date().toISOString(),
					changelog
				})
			});
			if (!r.ok) {
				const text = await r.text();
				toast.error(`Google Chat: ${text}`);
			} else {
				toast.success('Google Chat notified');
			}
		} catch {
			toast.error('Google Chat notification failed');
		}
	}

	// ─── GitHub PR ─────────────────────────────────────────────────────────────

	async function sendPRs() {
		if (!result?.files.length) return;
		if (!githubPat) {
			toast.error('Add your GitHub PAT in Settings first');
			showSettings = true;
			return;
		}

		sendingPrs = true;
		prResults = [];

		try {
			const repos = result.platforms
				.map((platform) => {
					const cfg = githubRepos[platform];
					if (!cfg?.owner || !cfg?.repo) return null;
					return {
						platform,
						owner: cfg.owner,
						repo: cfg.repo,
						baseBranch: cfg.branch || 'main',
						targetDir: cfg.dir || '',
						files: result!.files
							.filter((f) => f.platform === platform)
							.map((f) => ({ filename: f.filename, content: f.content }))
					};
				})
				.filter(Boolean);

			if (repos.length === 0) {
				toast.error('Configure repo settings for at least one platform in Settings');
				showSettings = true;
				return;
			}

			const changelog = generateChangelog(buildChangelogCtx());
			const res = await fetch('/api/github/pr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: githubPat, repos, description: changelog })
			});

			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(text || `HTTP ${res.status}`);
			}

			let data: { prs: { platform: string; url: string }[]; errors: string[] };
			try {
				data = await res.json();
			} catch {
				throw new Error('Server returned invalid JSON');
			}

			const successResults: PrResult[] = (data.prs ?? []).map((p) => ({
				...p,
				status: 'success' as const
			}));

			const failedResults: PrResult[] = (data.errors ?? []).map((errMsg) => {
				const platformMatch = errMsg.match(/^(\w+)\s*\(/);
				return {
					platform: platformMatch?.[1] ?? 'unknown',
					url: '',
					status: 'failed' as const,
					error: errMsg
				};
			});

			prResults = [...successResults, ...failedResults];

			const successes = successResults.length;
			if (successes > 0) {
				toast.success(`${successes} PR${successes > 1 ? 's' : ''} created`);
			}
			if (failedResults.length > 0) {
				toast.error(`${failedResults.length} PR${failedResults.length > 1 ? 's' : ''} failed`);
			}
		} catch (e) {
			toast.error(`PR creation failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			sendingPrs = false;
		}
	}

	async function retryPr(platform: string) {
		if (!result?.files.length || !githubPat) return;
		const cfg = githubRepos[platform as Platform];
		if (!cfg?.owner || !cfg?.repo) {
			toast.error(`No repo configured for ${platform}`);
			return;
		}
		const files = result.files
			.filter((f) => f.platform === platform)
			.map((f) => ({ filename: f.filename, content: f.content }));
		if (!files.length) return;

		const idx = prResults.findIndex((p) => p.platform === platform);
		if (idx >= 0)
			prResults[idx] = { ...prResults[idx], status: 'success', error: undefined, url: '…' };

		try {
			const changelog = generateChangelog(buildChangelogCtx());
			const res = await fetch('/api/github/pr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: githubPat,
					repos: [
						{
							platform,
							owner: cfg.owner,
							repo: cfg.repo,
							baseBranch: cfg.branch || 'main',
							targetDir: cfg.dir || '',
							files
						}
					],
					description: changelog
				})
			});
			if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
			const data: { prs: { platform: string; url: string }[]; errors: string[] } = await res.json();
			if (data.prs?.length && idx >= 0) {
				prResults[idx] = { platform, url: data.prs[0].url, status: 'success' };
				toast.success(`PR retried for ${platform}`);
			} else if (data.errors?.length) {
				throw new Error(data.errors[0]);
			}
		} catch (e) {
			if (idx >= 0) {
				prResults[idx] = {
					platform,
					url: '',
					status: 'failed',
					error: e instanceof Error ? e.message : String(e)
				};
			}
			toast.error(`Retry failed for ${platform}`);
		}
	}

	// ─── Theme management ─────────────────────────────────────────────────────

	function changeTheme(id: ThemeId) {
		selectedTheme = id;
		showThemePicker = false;
		if (browser) localStorage.setItem('token-sync:theme', id);
	}

	// ─── Settings panel keyboard management ────────────────────────────────────

	function handleSettingsToggle() {
		showSettings = !showSettings;
	}

	$effect(() => {
		if (!browser) return;
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				if (showThemePicker) {
					showThemePicker = false;
				} else if (showSettings) {
					showSettings = false;
				} else if (showHistory) {
					showHistory = false;
				} else if (showSwatches) {
					showSwatches = false;
				}
			}
		}
		function onClick(e: MouseEvent) {
			const target = e.target as Element | null;
			if (showThemePicker && !target?.closest('.theme-picker')) {
				showThemePicker = false;
			}
			if (showHistory && !target?.closest('.history-panel') && !target?.closest('.ctrl-btn')) {
				showHistory = false;
			}
			if (showSwatches && !target?.closest('.swatch-panel') && !target?.closest('.ctrl-btn')) {
				showSwatches = false;
			}
		}
		document.addEventListener('keydown', onKeydown);
		document.addEventListener('click', onClick);
		return () => {
			document.removeEventListener('keydown', onKeydown);
			document.removeEventListener('click', onClick);
		};
	});

	// ─── Settings persistence ──────────────────────────────────────────────────

	function onChatWebhookChange(e: Event) {
		chatWebhookUrl = (e.target as HTMLInputElement).value;
		if (browser) saveNotifyUrl(chatWebhookUrl);
	}

	function onGithubPatChange(e: Event) {
		githubPat = (e.target as HTMLInputElement).value;
		if (browser) saveGithubPat(githubPat);
	}

	function onGithubRepoChange(
		platform: Platform,
		field: keyof NonNullable<GithubConfigs[Platform]>,
		e: Event
	) {
		const val = (e.target as HTMLInputElement).value;
		githubRepos = {
			...githubRepos,
			[platform]: {
				...(githubRepos[platform] ?? { owner: '', repo: '', branch: 'main', dir: '' }),
				[field]: val
			}
		};
		if (browser) saveGithubRepos(githubRepos);
	}

	function onFigmaPasscodeChange(e: Event) {
		figmaWebhookPasscode = (e.target as HTMLInputElement).value;
		if (browser) saveFigmaWebhookPasscode(figmaWebhookPasscode);
	}

	async function pollFigmaWebhook() {
		if (!figmaWebhookPasscode) return;
		try {
			const res = await fetch(
				`/api/figma/webhook?passcode=${encodeURIComponent(figmaWebhookPasscode)}`
			);
			if (res.ok) {
				const data: { event: { file_name: string; timestamp: string; receivedAt: string } | null } =
					await res.json();
				if (data.event && data.event.receivedAt !== figmaWebhookEvent?.receivedAt) {
					figmaWebhookEvent = data.event;
					figmaWebhookSeen = false;
				}
			}
		} catch {
			/* polling silently fails */
		}
	}

	$effect(() => {
		if (!browser || !figmaWebhookPasscode) return;
		const interval = setInterval(pollFigmaWebhook, 30_000);
		pollFigmaWebhook();
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<Toaster theme="dark" position="bottom-right" richColors />

<div class="app">
	<!-- Skip link for keyboard users -->
	<a href="#main-content" class="skip-link">Skip to main content</a>

	<header class="header">
		<div class="header-inner">
			<div class="brand">
				<span class="brand-mark" aria-hidden="true">◈</span>
				<div class="brand-text">
					<h1 class="brand-name">Token&nbsp;Sync</h1>
					<span class="brand-sub">Design token pipeline — Figma → SCSS · TS · Swift · Kotlin</span>
				</div>
			</div>
			<div class="header-right">
				{#if figmaWebhookEvent && !figmaWebhookSeen}
					<button
						class="figma-webhook-alert"
						onclick={() => {
							figmaWebhookSeen = true;
						}}
						title="Figma file updated — re-upload tokens to sync"
					>
						<span class="figma-alert-dot"></span>
						Figma updated {figmaWebhookEvent.file_name ? `(${figmaWebhookEvent.file_name})` : ''}
					</button>
				{/if}
				<div class="header-status">
					<span class="status-dot" class:status-dot--active={requiredFilled > 0} aria-hidden="true"
					></span>
					<span class="status-label" aria-live="polite" aria-atomic="true">
						{#if requiredFilled === 3}
							Ready to generate
						{:else}
							{requiredFilled}/3 required files loaded
						{/if}
					</span>
				</div>
			</div>
		</div>
	</header>

	<main class="main" id="main-content">
		<div class="workspace">
			<!-- ── Upload Panel ─────────────────────────────────────────────── -->
			<aside class="upload-panel">
				<!-- Platform Toggle -->
				<div class="platform-section">
					<div class="panel-eyebrow">
						<span>PLATFORM</span>
					</div>
					<div class="platform-toggle" role="radiogroup" aria-label="Select platform">
						{#each PLATFORMS as p (p.id)}
							<button
								class="platform-btn"
								class:platform-btn--active={selectedPlatforms.includes(p.id)}
								style="--p-color: {p.color}"
								onclick={() => selectPlatform(p.id)}
								role="radio"
								aria-checked={selectedPlatforms.includes(p.id)}
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted icon SVG constants defined in this file -->
								<span class="platform-icon">{@html p.icon}</span>
								<span class="platform-name">{p.label}</span>
								<span class="platform-sublabel">{p.sublabel}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- File List -->
				<div class="panel-eyebrow" style="margin-top: 20px;">
					<span>INPUT</span>
					<div class="panel-header-actions">
						<button
							class="clear-all-btn"
							onclick={exportConfig}
							title="Export platform + reference file config"
							aria-label="Export config">↑ export</button
						>
						<label
							class="clear-all-btn"
							for="import-config-input"
							title="Import saved config"
							aria-label="Import config"
						>
							↓ import
							<input
								id="import-config-input"
								type="file"
								accept=".json,application/json"
								class="sr-only"
								onchange={importConfigFile}
							/>
						</label>
						<button class="clear-all-btn" onclick={clearAll}>Clear all</button>
					</div>
				</div>

				<div
					class="file-list"
					ondragenter={(e) => {
						e.preventDefault();
						bulkDropActive = true;
					}}
					ondragover={(e) => {
						e.preventDefault();
					}}
					ondragleave={(e) => {
						if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node))
							bulkDropActive = false;
					}}
					ondrop={handleBulkDrop}
					role="region"
				>
					{#if bulkDropActive}
						<div class="bulk-drop-overlay">
							<span class="bulk-drop-label">Drop Figma JSON files to auto-assign</span>
						</div>
					{/if}
					<!-- FIGMA EXPORT section -->
					<div class="file-section-label">
						<span class="file-section-brand">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted icon SVG constant defined in this file -->
							{@html ICON_FIGMA}
							Figma export
						</span>
						<span class="file-section-sub">Required: Light · Dark · Value</span>
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
							ondragenter={(e) => handleDragEnter(dk, e)}
							ondragover={(e) => handleDragOver(dk, e)}
							ondragleave={() => handleDragLeave(dk)}
							ondrop={(e) => handleDrop(dk, e)}
						>
							<input
								type="file"
								accept={slot.accept}
								class="sr-only"
								onchange={(e) => handleFileInput(dk, e)}
							/>
							<span
								class="file-ext-dot"
								style="background-color: {extColor(slot.ext)}"
								title=".{slot.ext} file"
							></span>
							<div class="file-meta">
								<span class="file-label">{slot.label}</span>
								<span class="file-hint">{slot.hint}</span>
							</div>
							<div class="file-action">
								{#if filled}
									{#if slot.warning}
										<span class="file-warning" title={slot.warning}>⚠</span>
									{/if}
									{#if insight}
										<span class="file-insight">{insight.count} {insight.label}</span>
									{/if}
									<span class="file-loaded">
										<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
											<path
												d="M1.5 5l2.5 2.5 4.5-4.5"
												stroke="currentColor"
												stroke-width="1.5"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
										{slot.file!.name.length > 20
											? slot.file!.name.slice(0, 17) + '…'
											: slot.file!.name}
									</span>
									<button class="file-clear" onclick={(e) => clearFile(dk, e)} aria-label="Remove"
										>✕</button
									>
								{:else}
									<span class="file-cta" class:file-cta--dragging={slot.dragging}>
										{slot.dragging ? 'Drop it' : slot.required ? 'Click or drag' : 'Optional'}
									</span>
								{/if}
							</div>
						</label>
					{/each}

					<!-- REFERENCE FILES section — platform-filtered -->
					{#if visibleKeys.some((k) => REF_KEYS.includes(k))}
						{@const activePlatform = PLATFORMS.find((p) => selectedPlatforms.includes(p.id))}
						<div class="file-section-label file-section-label--ref">
							<span class="file-section-brand">
								{#if activePlatform}
									<!-- eslint-disable svelte/no-at-html-tags -- trusted icon SVG constant defined in this file -->
									<span class="file-section-platform-icon" style="color: {activePlatform.color}"
										>{@html activePlatform.icon}</span
									>
									<!-- eslint-enable svelte/no-at-html-tags -->
								{/if}
								Reference files
							</span>
							<span class="file-section-sub">Optional — naming convention detection</span>
						</div>
						{#each visibleKeys.filter((k) => REF_KEYS.includes(k)) as key (key)}
							{@const slot = slots[key]}
							{@const filled = !!slot.file}
							{@const insight = fileInsights[key]}
							<label
								class="file-row file-row--ref"
								class:file-row--filled={filled}
								class:file-row--restored={slot.restored}
								class:file-row--dragging={slot.dragging}
								ondragenter={(e) => handleDragEnter(key, e)}
								ondragover={(e) => handleDragOver(key, e)}
								ondragleave={() => handleDragLeave(key)}
								ondrop={(e) => handleDrop(key, e)}
							>
								<input
									type="file"
									accept={slot.accept}
									class="sr-only"
									onchange={(e) => handleFileInput(key, e)}
								/>
								<span
									class="file-ext-dot"
									style="background-color: {extColor(slot.ext)}"
									title=".{slot.ext} file"
								></span>
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
												<span class="restored-icon" title="Restored from last session">↺</span>
											{:else}
												<svg
													width="10"
													height="10"
													viewBox="0 0 10 10"
													fill="none"
													aria-hidden="true"
												>
													<path
														d="M1.5 5l2.5 2.5 4.5-4.5"
														stroke="currentColor"
														stroke-width="1.5"
														stroke-linecap="round"
														stroke-linejoin="round"
													/>
												</svg>
											{/if}
											{slot.file!.name.length > 20
												? slot.file!.name.slice(0, 17) + '…'
												: slot.file!.name}
										</span>
										<button
											class="file-clear"
											onclick={(e) => clearFile(key, e)}
											aria-label="Remove">✕</button
										>
									{:else}
										<span class="file-cta" class:file-cta--dragging={slot.dragging}>
											{slot.dragging ? 'Drop it' : 'Click or drag'}
										</span>
									{/if}
								</div>
							</label>
						{/each}
					{/if}
				</div>

				<!-- Generate Area -->
				<div class="generate-area">
					<div class="progress-bar" title="{requiredFilled}/3 required files loaded">
						<div class="progress-fill" style="width: {(requiredFilled / 3) * 100}%"></div>
					</div>
					<button
						class="generate-btn"
						onclick={generate}
						disabled={!canGenerate}
						aria-busy={loading}
						aria-describedby="generate-hint"
					>
						{#if loading}
							<span class="btn-spinner" aria-hidden="true"></span>
							<span>Generating…</span>
						{:else}
							<span class="btn-label">Generate files</span>
							<span class="btn-arrow">→</span>
						{/if}
					</button>
					{#if errorMsg}
						<div class="error-row" role="alert">
							<span class="error-prefix">!</span>
							<span>{errorMsg}</span>
						</div>
					{/if}
					<p class="generate-hint" id="generate-hint" aria-live="polite">
						{#if requiredFilled < 3}
							Load {3 - requiredFilled} more Figma JSON file{3 - requiredFilled !== 1 ? 's' : ''} to generate
						{:else}
							{visibleFilled} / {visibleKeys.length} files loaded · reference files improve output
						{/if}
					</p>
				</div>

				<SettingsPanel
					show={showSettings}
					{chatWebhookUrl}
					{githubPat}
					{githubRepos}
					{figmaWebhookPasscode}
					{figmaWebhookEvent}
					{selectedPlatforms}
					{platformColor}
					onToggle={handleSettingsToggle}
					{onChatWebhookChange}
					{onGithubPatChange}
					{onGithubRepoChange}
					{onFigmaPasscodeChange}
				/>
			</aside>

			<!-- ── Output Panel ──────────────────────────────────────────────── -->
			<section class="output-panel" aria-label="Generated output">
				{#if !result}
					<div class="output-idle">
						{#if swatches.length > 0}
							<!-- Swatch preview shown immediately after uploading Light.tokens.json -->
							<div class="idle-swatch-preview">
								<div class="idle-swatch-header">
									<span class="idle-swatch-title"
										>◈ Color Primitives — {swatches.length} tokens</span
									>
									<span class="idle-swatch-hint">Generate to produce code output →</span>
								</div>
								{#each [...new Set(swatches.map((s) => s.family))] as family (family)}
									<div class="idle-swatch-group">
										<span class="idle-swatch-group-name">{family}</span>
										<div class="swatch-row">
											{#each swatches.filter((s) => s.family === family) as swatch (swatch.name)}
												<div class="swatch-item" title="{swatch.name}\n{swatch.hex}">
													<div class="swatch-color" style="background: {swatch.hex}"></div>
													<span class="swatch-hex">{swatch.hex}</span>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="idle-grid" aria-hidden="true">
								{#each IDLE_GRID as cell, i (i)}
									<span class="idle-cell">{cell}</span>
								{/each}
							</div>
							<div class="idle-message">
								<p class="idle-title">Awaiting input</p>
								<p class="idle-sub">
									Load the 3 Figma JSON files and hit Generate to produce
									{selectedPlatforms.includes('web') ? 'SCSS + TypeScript' : ''}
									{selectedPlatforms.includes('ios') ? 'Swift' : ''}
									{selectedPlatforms.includes('android') ? 'Kotlin' : ''} output.
								</p>
							</div>
						{/if}
					</div>
				{:else}
					<div class="output-header">
						<div class="output-header-top">
							<div class="panel-eyebrow panel-eyebrow--out">
								<span>OUTPUT</span>
								{#if lastGeneratedAt}
									<span class="generated-at" title="Generated at {formatTime(lastGeneratedAt)}">
										{timeAgo(lastGeneratedAt)}
									</span>
								{/if}
							</div>
							<div class="output-actions">
								<button
									class="ctrl-btn ctrl-btn--primary"
									onclick={downloadZip}
									aria-label="Download all files as ZIP"
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
										><path
											d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14zM7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06z"
										/></svg
									>
									ZIP
								</button>
								<button
									class="ctrl-btn"
									onclick={sendPRs}
									disabled={sendingPrs}
									title="Send pull requests to team repos"
									aria-label="Send pull requests"
								>
									<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
										><path
											d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm0 9.5a.75.75 0 100 1.5.75.75 0 000-1.5zm9.5 0a.75.75 0 100 1.5.75.75 0 000-1.5z"
										/></svg
									>
									{sendingPrs ? '…' : 'PR'}
								</button>
								{#if Object.keys(diffs).length > 0}
									<button
										class="ctrl-btn"
										onclick={() => copyToClipboard(generateChangelog(buildChangelogCtx()))}
										aria-label="Copy changelog to clipboard"
										title="Copy changelog"
									>
										<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
											><path
												d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25zM5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25z"
											/></svg
										>
										Log
									</button>
								{/if}
								{#if swatches.length > 0}
									<button
										class="ctrl-btn"
										class:ctrl-btn--active={showSwatches}
										onclick={() => (showSwatches = !showSwatches)}
										title="Toggle color swatch preview">◈</button
									>
								{/if}
								{#if history.length > 0}
									<button
										class="ctrl-btn"
										class:ctrl-btn--active={showHistory}
										onclick={() => (showHistory = !showHistory)}
										title="View generation history"
									>
										<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
											><path
												d="M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.751.751 0 017 8.25v-3.5A.75.75 0 017.75 4z"
											/></svg
										>
										{history.length}
									</button>
								{/if}
							</div>
						</div>
						{#if result.stats}
							{@const s = result.stats}
							<div class="output-stats-row">
								{#if s.primitiveColors > 0}
									<span class="stat-pill" title="Primitive color tokens"
										>{s.primitiveColors} primitives</span
									>
								{/if}
								{#if s.semanticColors > 0}
									<span class="stat-pill" title="Semantic color tokens"
										>{s.semanticColors} semantic</span
									>
								{/if}
								{#if s.spacingSteps > 0}
									<span class="stat-pill" title="Spacing tokens">{s.spacingSteps} spacing</span>
								{/if}
								{#if s.typographyStyles > 0}
									<span class="stat-pill stat-pill--typo" title="Typography text styles"
										>{s.typographyStyles} text styles</span
									>
								{/if}
								<span class="stat-pill stat-pill--files">{result.files.length} files</span>
							</div>
						{/if}
					</div>

					<!-- Vertical file sidebar + code pane -->
					<div class="output-body">
						<!-- File sidebar -->
						<div
							class="file-sidebar"
							role="tablist"
							aria-label="Generated files"
							tabindex="0"
							onkeydown={handleTabKeydown}
						>
							{#each result.files as file (file.filename)}
								{@const hasDiff = !!diffs[file.filename]}
								{@const stats = hasDiff ? diffStats(diffs[file.filename]) : null}
								{@const modCount = modifications[file.filename]?.length ?? 0}
								{@const totalChanges = (stats?.added ?? 0) + (stats?.removed ?? 0) + modCount}
								<button
									class="sidebar-item"
									class:sidebar-item--active={activeTab === file.filename}
									role="tab"
									aria-selected={activeTab === file.filename}
									onclick={() => (activeTab = file.filename)}
								>
									<span class="sidebar-name">
										<span
											class="sidebar-dot"
											style="background: {file.format === 'scss'
												? '#F06090'
												: file.format === 'swift'
													? '#FF8040'
													: file.format === 'kotlin'
														? '#B060FF'
														: '#4D9EFF'}"
										></span>
										{file.filename}
									</span>
									<span class="sidebar-stats">
										<span class="sidebar-lines">{file.content.split('\n').length} lines</span>
										{#if totalChanges > 0}
											<span
												class="sidebar-change-dot"
												title="{stats?.added ?? 0} added, {stats?.removed ??
													0} removed, {modCount} modified"
											></span>
										{/if}
									</span>
								</button>
							{/each}
						</div>

						<!-- Code pane -->
						{#each result.files as file (file.filename)}
							{#if activeTab === file.filename}
								{@const mode = getViewMode(file.filename)}
								{@const hasDiff = !!diffs[file.filename]}
								{@const sr = searchQuery ? buildSearchHighlight(file.content, searchQuery) : null}
								{@const depCount = deprecations[file.filename]?.length ?? 0}
								{@const modCountBanner = modifications[file.filename]?.length ?? 0}
								{@const fileRenames = renames[file.filename] ?? []}
								{@const fileFamilyRenames = familyRenames[file.filename] ?? []}
								{@const familyGrouped = new Set(
									fileFamilyRenames.flatMap((fr) => fr.members.map((m) => m.oldName))
								)}
								{@const individualRenames = fileRenames.filter(
									(r) => !familyGrouped.has(r.oldName)
								)}
								{@const renameCount = fileFamilyRenames.length + individualRenames.length}
								{@const cov = tokenCoverage[file.filename]}
								{@const relevantImpacts =
									impactedTokens.length > 0 && diffs[file.filename]
										? impactedTokens.filter((it) => it.affectedSemantics.length > 0)
										: []}
								{@const totalInsights =
									depCount +
									modCountBanner +
									renameCount +
									(cov ? 1 : 0) +
									(relevantImpacts.length > 0 ? 1 : 0)}
								{@const sections = extractSections(file.content)}
								<div class="code-pane" role="tabpanel" tabindex="-1" onkeydown={handleCodeKeydown}>
									<div class="code-toolbar">
										<div class="toolbar-left">
											{#if hasDiff && !searchQuery}
												{@const ds = diffStats(diffs[file.filename], modifications[file.filename])}
												<div class="view-toggle" role="group" aria-label="View mode">
													<button
														class="toggle-btn"
														class:toggle-btn--active={mode === 'code'}
														aria-pressed={mode === 'code'}
														onclick={() => (viewModes[file.filename] = 'code')}>Code</button
													>
													<button
														class="toggle-btn"
														class:toggle-btn--active={mode === 'diff'}
														aria-pressed={mode === 'diff'}
														onclick={() => (viewModes[file.filename] = 'diff')}
													>
														Diff
														<span class="toggle-badge">+{ds.added} -{ds.removed}</span>
													</button>
													<button
														class="toggle-btn"
														class:toggle-btn--active={mode === 'changes'}
														aria-pressed={mode === 'changes'}
														onclick={() => (viewModes[file.filename] = 'changes')}>Changes</button
													>
												</div>
												{#if mode === 'diff' || mode === 'changes'}
													{@const changeCount = diffs[file.filename]
														? diffChangeIndices(diffs[file.filename]).length
														: 0}
													{#if changeCount > 0}
														<div class="diff-nav" role="navigation" aria-label="Diff navigation">
															<button
																class="diff-nav-btn"
																onclick={() => navigateDiff(file.filename, 'prev')}
																aria-label="Previous change">↑</button
															>
															<span class="diff-nav-count"
																>{(diffNavIndex[file.filename] ?? 0) + 1}/{changeCount}</span
															>
															<button
																class="diff-nav-btn"
																onclick={() => navigateDiff(file.filename, 'next')}
																aria-label="Next change">↓</button
															>
														</div>
													{/if}
												{/if}
											{/if}
										</div>
										<div class="toolbar-right">
											{#if sections.length > 0}
												<div class="section-nav">
													<button
														class="ctrl-btn ctrl-btn--icon"
														onclick={() => (showSectionNav = !showSectionNav)}
														aria-expanded={showSectionNav}
														title="Jump to section"
													>
														<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
															><path
																d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 14H1.75A1.75 1.75 0 010 12.25zm1.75-.25a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25zM3.5 6.25a.75.75 0 01.75-.75h7a.75.75 0 010 1.5h-7a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h4a.75.75 0 000-1.5z"
															/></svg
														>
													</button>
													{#if showSectionNav}
														<div class="section-menu" role="menu" aria-label="Jump to section">
															{#each sections as sec (sec.line)}
																<button
																	class="section-option"
																	role="menuitem"
																	onclick={() => scrollToLine(sec.line)}
																>
																	<span class="section-line">L{sec.line}</span>
																	{sec.label}
																</button>
															{/each}
														</div>
													{/if}
												</div>
											{/if}
											<div class="search-wrap">
												<input
													bind:this={searchInputEl}
													class="search-input"
													type="text"
													placeholder="Search ({searchShortcutHint})"
													bind:value={searchQuery}
													aria-label="Search in file"
												/>
												{#if searchQuery}
													<span
														class="search-count"
														class:search-count--zero={sr && sr.count === 0}
													>
														{sr?.count ?? 0}
													</span>
													<button
														class="search-clear"
														onclick={() => (searchQuery = '')}
														aria-label="Clear search">✕</button
													>
												{/if}
											</div>
											<button
												class="ctrl-btn ctrl-btn--icon"
												class:ctrl-btn--active={wrapLines}
												onclick={() => (wrapLines = !wrapLines)}
												title={wrapLines ? 'Disable line wrap' : 'Enable line wrap'}
												aria-label="Toggle line wrap"
											>
												<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
													><path
														d="M1.75 2h12.5a.75.75 0 010 1.5H1.75a.75.75 0 010-1.5zm0 5h9.5a2.25 2.25 0 010 4.5H9.46l.47.47a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-1.5-1.5a.75.75 0 010-1.06l1.5-1.5a.749.749 0 011.06 1.06l-.47.47h1.79a.75.75 0 000-1.5h-9.5a.75.75 0 010-1.5zM1.75 14h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 010-1.5z"
													/></svg
												>
											</button>
											<div class="theme-picker">
												<button
													class="theme-btn"
													onclick={() => (showThemePicker = !showThemePicker)}
													aria-expanded={showThemePicker}
													aria-label="Change syntax theme"
													title="Change syntax theme"
												>
													<span
														class="theme-dot"
														style="background:{THEMES.find((t) => t.id === selectedTheme)?.bg ??
															'#888'}"
													></span>
												</button>
												{#if showThemePicker}
													<div class="theme-menu" role="listbox" aria-label="Syntax themes">
														{#each THEMES as theme (theme.id)}
															<button
																class="theme-option"
																class:theme-option--active={selectedTheme === theme.id}
																onclick={() => changeTheme(theme.id)}
																role="option"
																aria-selected={selectedTheme === theme.id}
															>
																<span class="theme-dot" style="background:{theme.bg}"></span>
																{theme.label}
															</button>
														{/each}
													</div>
												{/if}
											</div>
											<div class="toolbar-divider"></div>
											<button
												class="ctrl-btn ctrl-btn--icon"
												onclick={() => copyToClipboard(file.content)}
												aria-label="Copy file contents"
												title="Copy"
											>
												<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
													><path
														d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25zM5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25z"
													/></svg
												>
											</button>
											<button
												class="ctrl-btn ctrl-btn--icon"
												onclick={() => downloadFile(file)}
												aria-label="Download this file"
												title="Save"
											>
												<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
													><path
														d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14zM7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06z"
													/></svg
												>
											</button>
										</div>
									</div>

									{#if totalInsights > 0}
										<div class="change-summary">
											<button
												class="change-summary-toggle"
												onclick={() =>
													(showChangeSummary[file.filename] = !showChangeSummary[file.filename])}
												aria-expanded={!!showChangeSummary[file.filename]}
											>
												<svg
													class="change-summary-chevron"
													class:change-summary-chevron--open={showChangeSummary[file.filename]}
													width="12"
													height="12"
													viewBox="0 0 16 16"
													fill="currentColor"
													><path
														d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
													/></svg
												>
												<span class="change-summary-label">
													{#if depCount > 0}<span class="cs-tag cs-tag--warn"
															>{depCount} removed</span
														>{/if}
													{#if modCountBanner > 0}<span class="cs-tag cs-tag--warn"
															>{modCountBanner} modified</span
														>{/if}
													{#if renameCount > 0}<span class="cs-tag cs-tag--info"
															>{renameCount} rename{renameCount > 1 ? 's' : ''}</span
														>{/if}
													{#if cov}<span
															class="cs-tag"
															class:cs-tag--ok={cov.coveragePercent >= 95}
															class:cs-tag--warn={cov.coveragePercent >= 80 &&
																cov.coveragePercent < 95}
															class:cs-tag--danger={cov.coveragePercent < 80}
															>{cov.coveragePercent.toFixed(0)}% coverage</span
														>{/if}
													{#if relevantImpacts.length > 0}<span class="cs-tag cs-tag--info"
															>{relevantImpacts.length} impacted</span
														>{/if}
												</span>
												{#if mode !== 'diff'}
													<span
														class="cs-diff-link"
														role="link"
														tabindex="0"
														onclick={(e) => {
															e.stopPropagation();
															viewModes[file.filename] = 'diff';
														}}
														onkeydown={(e) => {
															if (e.key === 'Enter') {
																e.stopPropagation();
																viewModes[file.filename] = 'diff';
															}
														}}>View diff</span
													>
												{/if}
											</button>
											{#if showChangeSummary[file.filename]}
												<div class="change-summary-body">
													{#if depCount > 0}
														<div class="cs-row cs-row--warn">
															<span class="cs-row-icon">−</span>
															<span class="cs-row-text">
																{depCount} token{depCount > 1 ? 's' : ''} removed: {deprecations[
																	file.filename
																]
																	.slice(0, 5)
																	.join(', ')}{depCount > 5 ? ` … +${depCount - 5} more` : ''}
															</span>
														</div>
													{/if}
													{#if modCountBanner > 0}
														<div class="cs-row cs-row--warn">
															<span class="cs-row-icon">~</span>
															<span class="cs-row-text">
																{modCountBanner} token{modCountBanner > 1 ? 's' : ''} modified: {modifications[
																	file.filename
																]
																	.slice(0, 3)
																	.map((m) => `${m.name} (${m.oldValue} → ${m.newValue})`)
																	.join(', ')}{modCountBanner > 3
																	? ` … +${modCountBanner - 3} more`
																	: ''}
															</span>
														</div>
													{/if}
													{#if fileFamilyRenames.length > 0}
														<div class="cs-row cs-row--info">
															<span class="cs-row-icon">↔</span>
															<span class="cs-row-text">
																{fileFamilyRenames
																	.map(
																		(fr) => `${fr.oldPrefix} → ${fr.newPrefix} (${fr.count} tokens)`
																	)
																	.join(', ')}
															</span>
														</div>
													{/if}
													{#if individualRenames.length > 0}
														<div class="cs-row cs-row--info">
															<span class="cs-row-icon">↔</span>
															<span class="cs-row-text">
																{individualRenames.length} possible rename{individualRenames.length >
																1
																	? 's'
																	: ''}: {individualRenames
																	.slice(0, 3)
																	.map((r) => `${r.oldName} → ${r.newName}`)
																	.join(', ')}{individualRenames.length > 3
																	? ` … +${individualRenames.length - 3} more`
																	: ''}
															</span>
														</div>
													{/if}
													{#if cov}
														<div
															class="cs-row"
															class:cs-row--ok={cov.coveragePercent >= 95}
															class:cs-row--warn={cov.coveragePercent >= 80 &&
																cov.coveragePercent < 95}
															class:cs-row--danger={cov.coveragePercent < 80}
														>
															<span class="cs-row-icon">◎</span>
															<span class="cs-row-text">
																Coverage: {cov.covered}/{cov.total} tokens ({cov.coveragePercent.toFixed(
																	1
																)}%){cov.orphaned.length
																	? ` · ${cov.orphaned.length} orphaned`
																	: ''}{cov.unimplemented.length
																	? ` · ${cov.unimplemented.length} unimplemented`
																	: ''}
															</span>
														</div>
													{/if}
													{#if relevantImpacts.length > 0}
														<div class="cs-row cs-row--info">
															<span class="cs-row-icon">◎</span>
															<span class="cs-row-text">
																{relevantImpacts
																	.slice(0, 3)
																	.map(
																		(it) =>
																			`${it.primitiveName} ${it.changeType} → affects ${it.affectedSemantics.length} semantic token${it.affectedSemantics.length > 1 ? 's' : ''}`
																	)
																	.join(' · ')}{relevantImpacts.length > 3
																	? ` … +${relevantImpacts.length - 3} more`
																	: ''}
															</span>
														</div>
													{/if}
												</div>
											{/if}
										</div>
									{/if}

									{#if searchQuery && sr}
										<!-- eslint-disable-next-line svelte/no-at-html-tags -- search results are escaped via escapeHtml() before mark injection -->
										<pre class="code-pre code-pre--search">{@html sr.html}</pre>
									{:else if mode === 'diff' && hasDiff}
										<div class="diff-view">
											{#each diffs[file.filename] as line, li (li)}
												{@const oldNum = line.type === 'add' ? '' : (line.oldLineNum ?? '')}
												{@const newNum = line.type === 'remove' ? '' : (line.newLineNum ?? '')}
												<div
													class="diff-line diff-line--{line.type}"
													id="diff-line-{file.filename}-{li}"
												>
													<span class="diff-ln diff-ln--old">{oldNum}</span>
													<span class="diff-ln diff-ln--new">{newNum}</span>
													<span class="diff-sig"
														>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span
													>
													<span class="diff-text"
														>{#if line.spans}{#each line.spans as span, si (si)}<span
																	class:diff-word--changed={span.changed}>{span.text}</span
																>{/each}{:else}{line.text}{/if}</span
													>
												</div>
											{/each}
										</div>
									{:else if mode === 'changes' && hasDiff}
										<div class="diff-view diff-view--filtered">
											{#each filterDiffLines(diffs[file.filename]) as item, fi (fi)}
												{#if 'text' in item}
													<div class="diff-line diff-line--{item.type}">
														<span class="diff-sig"
															>{item.type === 'add'
																? '+'
																: item.type === 'remove'
																	? '-'
																	: ' '}</span
														>
														<span class="diff-text"
															>{#if item.spans}{#each item.spans as span, si (si)}<span
																		class:diff-word--changed={span.changed}>{span.text}</span
																	>{/each}{:else}{item.text}{/if}</span
														>
													</div>
												{:else}
													<div class="diff-separator">···</div>
												{/if}
											{/each}
										</div>
									{:else if highlights[file.filename]}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="shiki-wrap numbered"
											class:shiki-wrap--wrap={wrapLines}
											class:shiki-wrap--has-highlight={highlightedLines !== null}
											onclick={(e) => {
												const target = e.target as HTMLElement;
												const line = target.closest('.line') as HTMLElement | null;
												if (!line) return;
												const codeEl = line.closest('code');
												if (!codeEl) return;
												const allLines = Array.from(codeEl.querySelectorAll(':scope > .line'));
												const idx = allLines.indexOf(line);
												if (idx >= 0) handleLineClick(idx + 1, e);
											}}
										>
											<!-- eslint-disable-next-line svelte/no-at-html-tags -- Shiki output is generated from our own transformer content -->
											{@html highlights[file.filename]}
										</div>
									{:else}
										<pre class="code-pre numbered" class:code-pre--wrap={wrapLines}><code
												>{file.content}</code
											></pre>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					<PlatformConsistency mismatches={platformMismatches} />

					{#if showSwatches && swatches.length > 0}
						<SwatchPanel
							{swatches}
							comparisons={swatchComparisons}
							tab={swatchTab}
							onTabChange={(t) => (swatchTab = t)}
							onClose={() => (showSwatches = false)}
						/>
					{/if}

					{#if showHistory}
						<HistoryPanel
							{history}
							{platformColor}
							onRestore={restoreHistory}
							onClose={() => (showHistory = false)}
						/>
					{/if}

					<PrResults
						results={prResults}
						{platformColor}
						onRetry={retryPr}
						onDismiss={() => (prResults = [])}
					/>
				{/if}
			</section>
		</div>
	</main>
</div>

<style>
	/* ─── Reset & Base ──────────────────────────────────────────────────────────── */
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
		min-height: 100dvh;
		-webkit-font-smoothing: antialiased;
		font-size: var(--base-text-size-sm);
		line-height: var(--base-text-lineHeight-normal);
	}

	/* Global focus ring for keyboard navigation */
	:global(:focus-visible) {
		outline: 2px solid var(--focus-outlineColor);
		outline-offset: 2px;
	}

	/* ─── Skip Link ──────────────────────────────────────────────────────────────── */
	.skip-link {
		position: absolute;
		top: -100%;
		left: 16px;
		z-index: 100;
		background: var(--brand-color);
		color: var(--fgColor-onEmphasis);
		padding: 8px 16px;
		border-radius: 0 0 var(--borderRadius-medium) var(--borderRadius-medium);
		font-family: 'IBM Plex Mono', monospace;
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: 0.04em;
		text-decoration: none;
		transition: top var(--base-duration-200) var(--base-easing-ease);
		outline: none;
	}
	.skip-link:focus {
		top: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		clip: rect(0 0 0 0);
		overflow: hidden;
	}

	/* ─── Header ────────────────────────────────────────────────────────────────── */
	.header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--bgColor-default) 92%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--borderColor-muted);
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 32px;
		gap: 24px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.brand-mark {
		font-size: 20px;
		color: var(--brand-color);
		line-height: 1;
		animation: mark-pulse 4s ease-in-out infinite;
	}

	@keyframes mark-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.brand-name {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-md);
		font-weight: 700;
		letter-spacing: -0.01em;
		text-transform: none;
		color: var(--fgColor-default);
		margin: 0;
		line-height: 1.2;
	}

	.brand-sub {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.figma-webhook-alert {
		display: flex;
		align-items: center;
		gap: 6px;
		background: color-mix(in srgb, var(--bgColor-attention-muted) 40%, transparent);
		border: 1px solid var(--borderColor-attention-muted, rgba(210, 153, 34, 0.3));
		color: var(--fgColor-attention);
		font-size: 11px;
		padding: 3px 10px;
		border-radius: var(--borderRadius-medium);
		cursor: pointer;
		white-space: nowrap;
		transition: background var(--base-duration-100) var(--base-easing-ease);
	}
	.figma-webhook-alert:hover {
		background: color-mix(in srgb, var(--bgColor-attention-muted) 60%, transparent);
	}
	.figma-alert-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fgColor-attention);
		animation: pulse-dot 2s infinite;
	}
	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
	.header-status {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--borderColor-emphasis);
		transition: background var(--base-duration-300) var(--base-easing-ease);
		flex-shrink: 0;
	}
	.status-dot--active {
		background: var(--brand-color);
		box-shadow: 0 0 6px color-mix(in srgb, var(--brand-color) 67%, transparent);
	}

	/* ─── Layout ────────────────────────────────────────────────────────────────── */
	.main {
		max-width: 1440px;
		margin: 0 auto;
		padding: 28px 32px 64px;
	}

	.workspace {
		display: grid;
		grid-template-columns: 440px 1fr;
		gap: 28px;
		align-items: start;
	}

	@media (max-width: 960px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.upload-panel {
			position: static !important;
		}
		.output-body {
			grid-template-columns: 1fr;
		}
		.file-sidebar {
			flex-direction: row;
			flex-wrap: wrap;
			border-right: none;
			border-bottom: 1px solid var(--borderColor-muted);
			overflow-x: auto;
			overflow-y: hidden;
		}
		.sidebar-item {
			flex-direction: row;
			align-items: center;
			gap: 8px;
			border-left: none;
			border-bottom: 2px solid transparent;
			border-right: 1px solid var(--borderColor-muted);
			padding: 9px 12px;
		}
		.sidebar-item--active {
			border-bottom-color: var(--brand-color);
			border-left-color: transparent;
		}
	}

	/* ─── Panel Eyebrow ─────────────────────────────────────────────────────────── */
	.panel-eyebrow {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: 0;
		text-transform: none;
		color: var(--fgColor-muted);
		margin-bottom: 14px;
	}
	.panel-eyebrow--out {
		margin-bottom: 0;
	}
	/* ─── Upload Panel ──────────────────────────────────────────────────────────── */
	.upload-panel {
		position: sticky;
		top: 68px;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-large);
		padding: 20px;
	}

	/* ─── Platform Toggle ───────────────────────────────────────────────────────── */
	.platform-section {
		margin-bottom: 20px;
	}

	.platform-toggle {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-large);
		padding: 4px;
		width: 100%;
	}

	.platform-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 4px 8px;
		border-radius: var(--borderRadius-large);
		border: none;
		background: transparent;
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition:
			color var(--base-duration-200) var(--base-easing-ease),
			background var(--base-duration-200) var(--base-easing-ease),
			box-shadow var(--base-duration-200) var(--base-easing-ease);
		position: relative;
	}
	.platform-btn:hover {
		color: var(--fgColor-muted);
		background: var(--control-transparent-bgColor-hover);
	}
	.platform-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--p-color, var(--fgColor-default));
		box-shadow: var(--shadow-floating-small);
	}
	.platform-btn--active .platform-name {
		color: var(--p-color, var(--fgColor-default));
	}

	.platform-icon {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	:global(.platform-icon svg) {
		display: block;
	}

	.platform-name {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: 0;
		color: inherit;
		line-height: 1;
	}

	.platform-sublabel {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		font-weight: var(--base-text-weight-normal);
		letter-spacing: 0.02em;
		color: var(--fgColor-disabled);
		opacity: 0.7;
		line-height: 1;
	}
	.platform-btn--active .platform-sublabel {
		opacity: 1;
	}

	/* ─── Clear All ─────────────────────────────────────────────────────────────── */
	.clear-all-btn {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		letter-spacing: 0;
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		padding: 2px 0;
		transition: color var(--base-duration-100) var(--base-easing-ease);
		white-space: nowrap;
		margin-left: auto;
	}
	.clear-all-btn:hover {
		color: var(--brand-color);
	}

	/* ─── File List ─────────────────────────────────────────────────────────────── */
	.file-list {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-large);
		overflow: hidden;
		margin-bottom: 14px;
		background: var(--bgColor-default);
		position: relative;
	}
	.bulk-drop-overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--bgColor-accent-muted) 80%, transparent);
		border: 2px dashed var(--borderColor-accent-emphasis);
		border-radius: var(--borderRadius-large);
		pointer-events: none;
	}
	.bulk-drop-label {
		font-size: var(--base-text-size-sm);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-accent);
		text-align: center;
		padding: 8px 16px;
	}

	.file-section-label {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		letter-spacing: 0;
		text-transform: none;
		color: var(--fgColor-disabled);
		padding: 8px 14px 7px;
		background: var(--bgColor-inset);
		border-bottom: 1px solid var(--borderColor-muted);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.file-section-label--ref {
		margin-top: 0;
		border-top: 1px solid var(--borderColor-muted);
	}
	.file-section-brand {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.file-section-platform-icon {
		display: flex;
		align-items: center;
		opacity: 0.85;
		transition: opacity var(--base-duration-200) var(--base-easing-ease);
	}
	.file-section-sub {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		letter-spacing: 0;
		color: var(--fgColor-disabled);
		opacity: 0.6;
		text-transform: none;
	}

	.file-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 13px 14px;
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
		from {
			transform: scaleY(0);
		}
		to {
			transform: scaleY(1);
		}
	}

	.file-ext-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		opacity: 0.5;
		transition: opacity var(--base-duration-200) var(--base-easing-ease);
		margin-top: 5px;
	}
	.file-row--filled .file-ext-dot {
		opacity: 1;
	}

	.file-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.file-label {
		font-family: var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		color: var(--fgColor-muted);
		transition: color var(--base-duration-200) var(--base-easing-ease);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.file-row--filled .file-label {
		color: var(--fgColor-default);
	}

	.file-hint {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		line-height: var(--base-text-lineHeight-normal);
	}

	.file-action {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.file-cta {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		white-space: nowrap;
	}
	.file-cta--dragging {
		color: var(--fgColor-muted);
	}

	.file-loaded {
		font-family: var(--fontStack-sansSerif);
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-success);
		max-width: 160px;
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
		font-family: var(--fontStack-sansSerif);
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		font-size: 10px;
		padding: 2px 4px;
		border-radius: 2px;
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			background var(--base-duration-100) var(--base-easing-ease);
		line-height: 1;
	}
	.file-clear:hover {
		color: var(--brand-color);
		background: var(--bgColor-danger-muted);
	}

	/* ─── Generate Area ─────────────────────────────────────────────────────────── */
	.generate-area {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.progress-bar {
		height: 2px;
		background: var(--control-bgColor-rest);
		border-radius: 1px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: var(--brand-color);
		border-radius: 1px;
		transition: width var(--base-duration-300) var(--base-easing-easeOut);
	}

	.generate-btn {
		width: 100%;
		padding: 13px 20px;
		background: var(--brand-color);
		color: var(--fgColor-onEmphasis);
		border: none;
		border-radius: var(--borderRadius-large);
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: -0.01em;
		text-transform: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition:
			background var(--base-duration-200) var(--base-easing-ease),
			opacity var(--base-duration-200) var(--base-easing-ease),
			transform var(--base-duration-100) var(--base-easing-ease);
	}
	.generate-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--brand-color) 85%, white);
		transform: translateY(-1px);
	}
	.generate-btn:active:not(:disabled) {
		transform: translateY(0);
	}
	.generate-btn:disabled {
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		color: var(--fgColor-disabled);
		cursor: not-allowed;
		transform: none;
		opacity: 0.5;
	}
	.btn-arrow {
		font-size: 16px;
		font-weight: var(--base-text-weight-light);
		transition: transform var(--base-duration-200) var(--base-easing-ease);
	}
	.generate-btn:hover:not(:disabled) .btn-arrow {
		transform: translateX(3px);
	}

	.btn-spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 1.5px solid color-mix(in srgb, var(--fgColor-onEmphasis) 30%, transparent);
		border-top-color: var(--fgColor-onEmphasis);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-row {
		display: flex;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bgColor-danger-muted);
		border: 1px solid var(--borderColor-danger-muted);
		border-radius: var(--borderRadius-small);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-danger);
		line-height: var(--base-text-lineHeight-normal);
	}
	.error-prefix {
		font-weight: 700;
		flex-shrink: 0;
	}

	.generate-hint {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		text-align: center;
		letter-spacing: 0;
	}

	/* ─── Output Panel ──────────────────────────────────────────────────────────── */
	.output-panel {
		min-height: 400px;
	}

	.output-idle {
		position: relative;
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-large);
		overflow: hidden;
		min-height: 440px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bgColor-default);
	}

	.idle-grid {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		align-content: start;
		padding: 24px;
		gap: 16px 0;
		opacity: 0.1;
		pointer-events: none;
	}
	.idle-cell {
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-light);
		color: var(--fgColor-muted);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.idle-message {
		position: relative;
		text-align: center;
		padding: 32px;
	}
	.idle-title {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		text-transform: none;
		margin-bottom: 8px;
	}
	.idle-sub {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		opacity: 0.7;
		max-width: 320px;
		line-height: var(--base-text-lineHeight-relaxed);
	}

	/* ─── Output Header ─────────────────────────────────────────────────────────── */
	.output-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}
	.output-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.output-header-top .panel-eyebrow {
		margin-bottom: 0;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.output-stats-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.output-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.generated-at {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		font-weight: var(--base-text-weight-normal);
	}

	.ctrl-btn {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		letter-spacing: 0;
		padding: 5px 10px;
		background: var(--button-default-bgColor-rest);
		border: 1px solid var(--button-default-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		color: var(--fgColor-muted);
		cursor: pointer;
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			border-color var(--base-duration-100) var(--base-easing-ease),
			background var(--base-duration-100) var(--base-easing-ease);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.ctrl-btn svg {
		flex-shrink: 0;
		opacity: 0.7;
	}
	.ctrl-btn:hover {
		color: var(--fgColor-default);
		border-color: var(--borderColor-emphasis);
		background: var(--control-bgColor-hover);
	}
	.ctrl-btn:hover svg {
		opacity: 1;
	}
	.ctrl-btn--primary {
		background: var(--bgColor-accent-muted);
		border-color: color-mix(in srgb, var(--borderColor-accent-emphasis) 40%, transparent);
		color: var(--fgColor-accent);
	}
	.ctrl-btn--primary:hover {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 80%, var(--bgColor-accent-emphasis));
		color: var(--fgColor-onEmphasis);
	}
	.ctrl-btn--icon {
		padding: 5px 6px;
	}

	/* ─── Output body: sidebar + code pane ─────────────────────────────────────── */
	.output-body {
		display: grid;
		grid-template-columns: 200px 1fr;
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-large);
		overflow: hidden;
		min-height: 400px;
	}

	/* ─── File Sidebar ───────────────────────────────────────────────────────────── */
	.file-sidebar {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--borderColor-muted);
		background: var(--bgColor-inset);
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--borderColor-default) transparent;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		background: none;
		border: none;
		border-left: 2px solid transparent;
		border-bottom: 1px solid var(--borderColor-muted);
		font-family: var(--fontStack-monospace);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			border-color var(--base-duration-100) var(--base-easing-ease);
	}
	.sidebar-item:last-child {
		border-bottom: none;
	}
	.sidebar-item:hover {
		background: var(--bgColor-muted);
	}
	.sidebar-item--active {
		background: var(--bgColor-muted);
		border-left-color: var(--brand-color);
	}

	.sidebar-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		opacity: 0.5;
		transition: opacity var(--base-duration-200) var(--base-easing-ease);
	}
	.sidebar-item--active .sidebar-dot {
		opacity: 1;
	}

	.sidebar-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--base-duration-100) var(--base-easing-ease);
		min-width: 0;
	}
	.sidebar-item--active .sidebar-name {
		color: var(--fgColor-default);
	}
	.sidebar-item:hover .sidebar-name {
		color: var(--fgColor-muted);
	}

	.sidebar-stats {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.sidebar-lines {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		color: var(--fgColor-disabled);
		white-space: nowrap;
	}
	.sidebar-change-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fgColor-attention);
		flex-shrink: 0;
	}

	/* ─── Code Pane ──────────────────────────────────────────────────────────────── */
	.code-pane {
		display: flex;
		flex-direction: column;
		background: var(--bgColor-default);
		overflow: hidden;
		min-width: 0;
	}

	.code-toolbar {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 6px 10px;
		background: var(--bgColor-inset);
		border-bottom: 1px solid var(--borderColor-muted);
	}
	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.toolbar-divider {
		width: 1px;
		height: 16px;
		background: var(--borderColor-muted);
		flex-shrink: 0;
	}
	.toggle-badge {
		font-family: var(--fontStack-monospace);
		font-size: 9px;
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		margin-left: 2px;
	}
	.toggle-btn--active .toggle-badge {
		color: var(--fgColor-muted);
	}

	/* ─── Diff Navigation ───────────────────────────────────────────────────────── */
	.diff-nav {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.diff-nav-btn {
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-default);
		color: var(--fgColor-muted);
		font-size: 11px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}
	.diff-nav-btn:hover {
		color: var(--fgColor-default);
		background: var(--bgColor-muted);
	}
	.diff-nav-count {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-muted);
		min-width: 36px;
		text-align: center;
	}
	.diff-separator {
		text-align: center;
		color: var(--fgColor-disabled);
		font-size: 11px;
		padding: 4px 0;
		background: var(--bgColor-inset);
		border-top: 1px dashed var(--borderColor-muted);
		border-bottom: 1px dashed var(--borderColor-muted);
		user-select: none;
	}
	.diff-word--changed {
		border-radius: 2px;
		padding: 0 1px;
	}
	.diff-line--add .diff-word--changed {
		background: color-mix(in srgb, var(--bgColor-success-emphasis) 30%, transparent);
	}
	.diff-line--remove .diff-word--changed {
		background: color-mix(in srgb, var(--bgColor-danger-emphasis) 30%, transparent);
	}

	/* ─── View Toggle ───────────────────────────────────────────────────────────── */
	.view-toggle {
		display: flex;
		background: var(--bgColor-inset);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 2px;
		gap: 2px;
	}
	.toggle-btn {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		letter-spacing: 0;
		padding: 4px 10px;
		background: transparent;
		border: none;
		border-radius: var(--borderRadius-medium);
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			color var(--base-duration-100) var(--base-easing-ease);
	}
	.toggle-btn--active {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-default);
		box-shadow: var(--shadow-floating-small);
	}

	/* ─── Line Numbers (CSS counters) ───────────────────────────────────────────── */
	:global(.numbered) {
		counter-reset: line-number;
	}
	:global(.numbered .line),
	:global(.numbered code .line) {
		counter-increment: line-number;
	}
	:global(.numbered .line::before),
	:global(.numbered code .line::before) {
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

	/* ─── Sticky Toolbar ───────────────────────────────────────────────────────── */
	.code-toolbar {
		position: sticky;
		top: 0;
		z-index: 10;
	}

	/* ─── Shiki Syntax Highlighting ─────────────────────────────────────────────── */
	.shiki-wrap {
		overflow: auto;
		flex: 1;
		min-height: 200px;
		max-height: calc(100vh - 240px);
	}

	:global(.shiki-wrap pre) {
		background: transparent !important;
		padding: 20px 24px 20px 16px;
		font-family: 'IBM Plex Mono', var(--fontStack-monospace) !important;
		font-size: 12.5px !important;
		font-weight: 400 !important;
		line-height: 1.8 !important;
		tab-size: 2 !important;
		margin: 0;
	}
	:global(.shiki-wrap code) {
		font-family: inherit !important;
		font-size: inherit !important;
	}
	:global(.shiki-wrap .line) {
		min-height: 1.8em;
		cursor: pointer;
		border-radius: 2px;
	}
	:global(.shiki-wrap .line:hover) {
		background: color-mix(in srgb, var(--bgColor-accent-muted) 15%, transparent);
	}
	:global(.shiki-wrap .line--highlighted) {
		background: color-mix(in srgb, var(--bgColor-attention-muted) 40%, transparent) !important;
	}
	:global(.shiki-wrap .line--highlighted::before) {
		color: var(--fgColor-attention) !important;
		border-right-color: var(--borderColor-attention-muted) !important;
	}

	/* Line wrap mode */
	.shiki-wrap--wrap :global(pre) {
		white-space: pre-wrap !important;
		word-break: break-all;
	}
	.code-pre--wrap code {
		white-space: pre-wrap !important;
		word-break: break-all;
	}

	/* ─── Inline color dot in code ─────────────────────────────────────────────── */
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

	/* ─── Theme picker ──────────────────────────────────────────────────────────── */
	.theme-picker {
		position: relative;
		display: flex;
		align-items: center;
	}
	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		background: transparent;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		transition: border-color var(--base-duration-200) var(--base-easing-ease);
	}
	.theme-btn:hover {
		border-color: var(--borderColor-default);
	}
	.theme-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.15);
		flex-shrink: 0;
	}
	.theme-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 50;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 4px;
		min-width: 140px;
		box-shadow: var(--shadow-floating-small);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.theme-option {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 5px 9px;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			color var(--base-duration-100) var(--base-easing-ease);
		width: 100%;
	}
	.theme-option:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}
	.theme-option--active {
		color: var(--fgColor-default);
		background: var(--control-bgColor-rest);
	}
	.theme-option--active::after {
		content: '✓';
		margin-left: auto;
		font-size: 9px;
		color: var(--fgColor-accent);
	}

	/* ─── Section Navigation ────────────────────────────────────────────────────── */
	.section-nav {
		position: relative;
	}
	.section-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 50;
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-medium);
		padding: 4px;
		min-width: 220px;
		max-width: 360px;
		max-height: 280px;
		overflow-y: auto;
		box-shadow: var(--shadow-floating-small);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.section-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 9px;
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-muted);
		background: transparent;
		border: none;
		border-radius: var(--borderRadius-small);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			color var(--base-duration-100) var(--base-easing-ease);
		width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.section-option:hover {
		background: var(--control-bgColor-hover);
		color: var(--fgColor-default);
	}
	.section-line {
		font-size: 9px;
		color: var(--fgColor-disabled);
		min-width: 32px;
		text-align: right;
		flex-shrink: 0;
	}

	/* ─── Plain Code Fallback ───────────────────────────────────────────────────── */
	.code-pre {
		overflow: auto;
		padding: 20px 24px;
		flex: 1;
		min-height: 200px;
		max-height: calc(100vh - 240px);
		tab-size: 2;
	}
	.code-pre code {
		font-family: 'IBM Plex Mono', var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-light);
		line-height: var(--base-text-lineHeight-loose);
		color: var(--fgColor-muted);
		white-space: pre;
	}

	/* ─── Diff View ─────────────────────────────────────────────────────────────── */
	.diff-view {
		overflow: auto;
		flex: 1;
		min-height: 200px;
		max-height: calc(100vh - 240px);
		font-family: 'IBM Plex Mono', var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-light);
		line-height: var(--base-text-lineHeight-relaxed);
		padding: 16px 0;
	}

	.diff-line {
		display: flex;
		gap: 10px;
		padding: 0 20px;
		min-height: 19px;
	}
	.diff-line--add {
		background: var(--bgColor-success-muted);
	}
	.diff-line--remove {
		background: var(--bgColor-danger-muted);
	}

	.diff-sig {
		width: 10px;
		flex-shrink: 0;
		font-weight: var(--base-text-weight-semibold);
		user-select: none;
	}
	.diff-line--add .diff-sig {
		color: var(--fgColor-success);
	}
	.diff-line--remove .diff-sig {
		color: var(--fgColor-danger);
	}
	.diff-line--equal .diff-sig {
		color: var(--fgColor-disabled);
	}

	.diff-ln {
		display: inline-block;
		width: 3.5ch;
		text-align: right;
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		color: var(--fgColor-disabled);
		user-select: none;
		flex-shrink: 0;
		opacity: 0.6;
	}
	.diff-ln--old {
		padding-right: 4px;
	}
	.diff-ln--new {
		padding-right: 8px;
		border-right: 1px solid var(--borderColor-muted);
		margin-right: 8px;
	}

	.diff-text {
		white-space: pre;
	}
	.diff-line--add .diff-text {
		color: var(--fgColor-success);
	}
	.diff-line--remove .diff-text {
		color: var(--fgColor-danger);
	}
	.diff-line--equal .diff-text {
		color: var(--fgColor-disabled);
	}

	/* ─── Change Summary (collapsed banners) ───────────────────────────────────── */
	.change-summary {
		border-bottom: 1px solid var(--borderColor-muted);
	}
	.change-summary-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 12px;
		background: color-mix(in srgb, var(--bgColor-muted) 50%, transparent);
		border: none;
		cursor: pointer;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		color: var(--fgColor-muted);
		text-align: left;
		transition: background var(--base-duration-100) var(--base-easing-ease);
	}
	.change-summary-toggle:hover {
		background: var(--bgColor-muted);
	}
	.change-summary-chevron {
		flex-shrink: 0;
		transition: transform var(--base-duration-200) var(--base-easing-ease);
		opacity: 0.5;
	}
	.change-summary-chevron--open {
		transform: rotate(90deg);
	}
	.change-summary-label {
		display: flex;
		align-items: center;
		gap: 5px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}
	.cs-tag {
		display: inline-flex;
		align-items: center;
		padding: 1px 7px;
		border-radius: var(--borderRadius-full);
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		font-weight: var(--base-text-weight-medium);
		white-space: nowrap;
		color: var(--fgColor-muted);
		background: var(--bgColor-inset);
	}
	.cs-tag--warn {
		color: var(--fgColor-attention);
		background: color-mix(in srgb, var(--bgColor-attention-muted) 40%, transparent);
	}
	.cs-tag--info {
		color: var(--fgColor-accent);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 30%, transparent);
	}
	.cs-tag--ok {
		color: var(--fgColor-success);
		background: color-mix(in srgb, var(--bgColor-success-muted) 30%, transparent);
	}
	.cs-tag--danger {
		color: var(--fgColor-danger);
		background: color-mix(in srgb, var(--bgColor-danger-muted) 30%, transparent);
	}
	.cs-diff-link {
		background: none;
		border: none;
		color: var(--fgColor-accent);
		font-family: var(--fontStack-sansSerif);
		font-size: 11px;
		cursor: pointer;
		padding: 0;
		white-space: nowrap;
		text-decoration: underline;
		text-underline-offset: 2px;
		flex-shrink: 0;
	}
	.change-summary-body {
		padding: 4px 0;
		background: color-mix(in srgb, var(--bgColor-muted) 30%, transparent);
	}
	.cs-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 3px 12px 3px 30px;
		font-family: var(--fontStack-monospace);
		font-size: 11px;
		color: var(--fgColor-muted);
	}
	.cs-row--warn {
		color: var(--fgColor-attention);
	}
	.cs-row--info {
		color: var(--fgColor-accent);
	}
	.cs-row--ok {
		color: var(--fgColor-success);
	}
	.cs-row--danger {
		color: var(--fgColor-danger);
	}
	.cs-row-icon {
		flex-shrink: 0;
		width: 12px;
		text-align: center;
		font-weight: var(--base-text-weight-semibold);
	}
	.cs-row-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ─── Platform Consistency Panel ─────────────────────────────────────────────── */

	/* ─── Token Stats Pills ──────────────────────────────────────────────────────── */
	.stat-pill {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		font-weight: var(--base-text-weight-medium);
		padding: 2px 8px;
		background: transparent;
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--borderRadius-full);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		cursor: default;
		white-space: nowrap;
	}
	.stat-pill--typo {
		border-color: var(--borderColor-done-muted);
		color: var(--fgColor-done);
	}
	.stat-pill--files {
		border-color: var(--borderColor-accent-muted);
		color: var(--fgColor-accent);
	}

	/* ─── Active Ctrl Btn ────────────────────────────────────────────────────────── */
	.ctrl-btn--active {
		color: var(--brand-color);
		border-color: var(--bgColor-danger-muted);
		background: var(--bgColor-danger-muted);
	}

	/* ─── Panel Header Actions ───────────────────────────────────────────────────── */
	.panel-header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* ─── File Insight Badge ─────────────────────────────────────────────────────── */
	.file-warning {
		font-size: 14px;
		line-height: 1;
		cursor: help;
		flex-shrink: 0;
		filter: saturate(2);
	}
	.file-insight {
		font-family: var(--fontStack-sansSerif);
		font-size: 10px;
		font-weight: var(--base-text-weight-medium);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* ─── Optional File Row ──────────────────────────────────────────────────────── */
	.file-row--optional:not(.file-row--filled) .file-ext-dot {
		opacity: 0.4;
	}
	.file-row--optional:not(.file-row--filled) .file-label {
		opacity: 0.6;
	}

	/* ─── Swatch Panel ───────────────────────────────────────────────────────────── */
	/* ─── Idle Swatch Preview ────────────────────────────────────────────────── */
	.idle-swatch-preview {
		width: 100%;
		padding: 24px 28px;
		overflow-y: auto;
		max-height: calc(100vh - 200px);
		scrollbar-width: thin;
		scrollbar-color: var(--borderColor-muted) transparent;
	}

	.idle-swatch-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 20px;
		gap: 12px;
	}

	.idle-swatch-title {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-muted);
		letter-spacing: 0;
		text-transform: none;
	}

	.idle-swatch-hint {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
	}

	.idle-swatch-group {
		margin-bottom: 16px;
	}

	.idle-swatch-group-name {
		display: block;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		color: var(--fgColor-disabled);
		letter-spacing: 0;
		text-transform: none;
		margin-bottom: 8px;
	}

	/* ─── Search ─────────────────────────────────────────────────────────────── */
	.search-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		max-width: 220px;
		position: relative;
	}

	.search-input {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		padding: 4px 10px;
		background: var(--control-bgColor-rest);
		border: 1px solid var(--control-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		color: var(--control-fgColor-rest);
		width: 100%;
		letter-spacing: 0;
		transition:
			border-color var(--base-duration-200) var(--base-easing-ease),
			color var(--base-duration-200) var(--base-easing-ease);
		outline: none;
	}

	.search-input:focus {
		border-color: var(--borderColor-accent-emphasis);
		color: var(--fgColor-default);
	}

	.search-input::placeholder {
		color: var(--control-fgColor-placeholder);
	}

	.search-count {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		color: var(--fgColor-success);
		white-space: nowrap;
		flex-shrink: 0;
		letter-spacing: 0;
	}

	.search-count--zero {
		color: var(--fgColor-danger);
	}

	.search-clear {
		background: none;
		border: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		font-size: 10px;
		font-family: inherit;
		padding: 2px 4px;
		flex-shrink: 0;
		transition: color var(--base-duration-100) var(--base-easing-ease);
	}

	.search-clear:hover {
		color: var(--fgColor-muted);
	}

	.code-pre--search {
		overflow: auto;
		padding: 20px 24px;
		flex: 1;
		min-height: 200px;
		max-height: calc(100vh - 240px);
		font-family: 'IBM Plex Mono', var(--fontStack-monospace);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-light);
		line-height: var(--base-text-lineHeight-loose);
		color: var(--fgColor-muted);
		white-space: pre;
		tab-size: 2;
	}

	:global(.search-mark) {
		background: var(--bgColor-attention-muted);
		color: var(--fgColor-attention);
		border-radius: 2px;
		padding: 0 1px;
	}

	/* ─── History Panel ──────────────────────────────────────────────────────── */
</style>
