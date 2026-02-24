import { browser } from '$app/environment';
import { SvelteSet } from 'svelte/reactivity';

export const THEMES = [
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

export type ThemeId = (typeof THEMES)[number]['id'];

export const THEME_PAIRS: Record<string, ThemeId> = {
	'github-dark-dimmed': 'github-light',
	'github-dark': 'github-light',
	'github-light': 'github-dark',
	'one-dark-pro': 'min-light',
	'min-light': 'one-dark-pro',
	dracula: 'github-light',
	'catppuccin-mocha': 'catppuccin-latte',
	'catppuccin-latte': 'catppuccin-mocha',
	'night-owl': 'github-light'
};

export type SidePanelId = 'import' | 'files' | 'history' | 'settings' | 'help' | null;

class UiStoreClass {
	selectedTheme = $state<ThemeId>('github-dark-dimmed');
	showThemePicker = $state(false);
	appColorMode = $state<'dark' | 'light'>('dark');
	searchQuery = $state('');
	searchInputEl = $state<HTMLInputElement | null>(null);
	showHistory = $state(false);
	showSwatches = $state(false);
	swatchTab = $state<'all' | 'changes'>('all');
	highlightedLines = $state<{ start: number; end: number } | null>(null);
	wrapLines = $state(false);
	showSectionNav = $state(false);
	collapsedSections = new SvelteSet<number>();
	codeScrollTop = $state(0);
	codeScrollHeight = $state(0);
	codeClientHeight = $state(0);
	codeScrollEl: HTMLElement | null = $state(null);
	currentBreadcrumb = $state('');
	diffNavIndex = $state<Record<string, number>>({});
	showChangeSummary = $state<Record<string, boolean>>({});
	activePanel = $state<SidePanelId>('import');
	panelWidth = $state(280);

	readonly isMac = browser && /Mac|iPhone|iPad/.test(navigator.userAgent);
	readonly searchShortcutHint = this.isMac ? '⌘F' : 'Ctrl+F';

	init() {
		const storedTheme = localStorage.getItem('tokensmith:theme') as ThemeId | null;
		if (storedTheme && THEMES.some((t) => t.id === storedTheme)) this.selectedTheme = storedTheme;

		const storedWidth = localStorage.getItem('tokensmith:panel-width');
		if (storedWidth) this.panelWidth = Math.max(120, Math.min(480, parseInt(storedWidth, 10)));
	}

	detectAppColorMode(): 'dark' | 'light' {
		if (!browser) return 'dark';
		const mode = document.documentElement.getAttribute('data-color-mode');
		if (mode === 'light') return 'light';
		if (mode === 'auto')
			return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
		return 'dark';
	}

	changeTheme(id: string) {
		this.selectedTheme = id as ThemeId;
		this.showThemePicker = false;
		if (browser) localStorage.setItem('tokensmith:theme', id);
	}

	handleRailSelect(id: 'import' | 'files' | 'history' | 'settings' | 'help') {
		this.activePanel = this.activePanel === id ? null : id;
	}

	toggleFold(lineNum: number) {
		if (this.collapsedSections.has(lineNum)) this.collapsedSections.delete(lineNum);
		else this.collapsedSections.add(lineNum);
	}

	scrollToLine(lineNum: number) {
		this.showSectionNav = false;
		this.highlightedLines = { start: lineNum, end: lineNum };
		requestAnimationFrame(() => {
			const el =
				document.querySelector(`.shiki-wrap .line:nth-child(${lineNum})`) ??
				document.querySelector(`.code-pre code .line:nth-child(${lineNum})`);
			el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	handleLineClick(lineNum: number, e: MouseEvent) {
		if (e.shiftKey && this.highlightedLines) {
			const start = Math.min(this.highlightedLines.start, lineNum);
			const end = Math.max(this.highlightedLines.start, lineNum);
			this.highlightedLines = { start, end };
		} else {
			this.highlightedLines =
				this.highlightedLines?.start === lineNum && this.highlightedLines?.end === lineNum
					? null
					: { start: lineNum, end: lineNum };
		}
	}

	seekMinimap(fraction: number) {
		if (this.codeScrollEl) {
			const maxScroll = this.codeScrollEl.scrollHeight - this.codeScrollEl.clientHeight;
			this.codeScrollEl.scrollTop = fraction * maxScroll;
		}
	}

	handleCodeScroll(e: Event) {
		const el = e.target as HTMLElement;
		this.codeScrollTop = el.scrollTop;
		this.codeScrollHeight = el.scrollHeight;
		this.codeClientHeight = el.clientHeight;
	}
}

export const uiStore = new UiStoreClass();

if (browser) {
	uiStore.appColorMode = uiStore.detectAppColorMode();
	const observer = new MutationObserver(() => {
		const prev = uiStore.appColorMode;
		uiStore.appColorMode = uiStore.detectAppColorMode();
		if (prev !== uiStore.appColorMode) {
			const currentTheme = THEMES.find((t) => t.id === uiStore.selectedTheme);
			if (currentTheme && currentTheme.mode !== uiStore.appColorMode) {
				const paired = THEME_PAIRS[uiStore.selectedTheme];
				if (paired) uiStore.selectedTheme = paired;
				else {
					const fallback = THEMES.find((t) => t.mode === uiStore.appColorMode);
					if (fallback) uiStore.selectedTheme = fallback.id;
				}
			}
		}
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-color-mode']
	});
}
