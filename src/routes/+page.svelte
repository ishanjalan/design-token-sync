<script lang="ts">
	import { browser } from '$app/environment';
	import { updated } from '$app/stores';
	import { onMount } from 'svelte';
	import { Toaster, toast } from 'svelte-sonner';
	import type { Platform, DropZoneKey } from '$lib/types.js';
	import { type DiffLine, diffChangeIndices, generateChangelog, computeBlameMap } from '$lib/diff-utils.js';

	import { formatFileSize, langLabel, platformColor, formatTime, timeAgo } from '$lib/page/format-helpers.js';
	import { extractSections, computeFoldRanges, extractDiffColor, computeHunkHeaders, nearestContext } from '$lib/page/code-helpers.js';
	import { generate as doGenerate, buildChangelogCtx, type GenerationStores } from '$lib/page/generation.js';
	import { downloadZip as doDownloadZip, copyToClipboard as doCopyToClipboard } from '$lib/page/download.js';
	import { sendPRs as doSendPRs, retryPr as doRetryPr } from '$lib/page/github-pr.js';
	import { onFigmaFetch as doFigmaFetch, pollFigmaWebhook as doPollFigmaWebhook, notifyTokenUpdate as doNotifyTokenUpdate, type FigmaSettings } from '$lib/page/figma-sync.js';

	import AppShell from '$lib/components/AppShell.svelte';
	import ActivityRail from '$lib/components/ActivityRail.svelte';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import HeaderBar from '$lib/components/HeaderBar.svelte';
	import ImportPanel from '$lib/components/ImportPanel.svelte';
	import ExplorerPanel from '$lib/components/ExplorerPanel.svelte';
	import EditorPane from '$lib/components/EditorPane.svelte';
	import WelcomeView from '$lib/components/WelcomeView.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import HelpPanel from '$lib/components/HelpPanel.svelte';
	import QualityPanel from '$lib/components/QualityPanel.svelte';
	import { analyzeReferenceFiles, type BestPracticeAdvice } from '$lib/best-practices-advisor.js';
	import { detectRefCompleteness, type RefCompletenessWarning } from '$lib/ref-completeness.js';
	import { AlertTriangle } from 'lucide-svelte';

	import { fileStore, REF_KEYS } from '$lib/stores/file-store.svelte.js';
	import { genStore } from '$lib/stores/generation-store.svelte.js';
	import { uiStore, THEMES } from '$lib/stores/ui-store.svelte.js';
	import { settingsStore } from '$lib/stores/settings-store.svelte.js';
	import { tokenStore, setGenStoreRef } from '$lib/stores/token-store-client.svelte.js';


	setGenStoreRef(() => genStore.result);

	// ─── Icons ───────────────────────────────────────────────────────────────────

	const ICON_SASS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zM9.615 15.998c.175.645.156 1.248-.024 1.792l-.065.18c-.024.061-.052.12-.078.176-.14.29-.326.56-.555.81-.698.759-1.672 1.047-2.09.805-.45-.262-.226-1.335.584-2.19.871-.918 2.12-1.509 2.12-1.509v-.003l.108-.061zm9.911-10.861c-.542-2.133-4.077-2.834-7.422-1.645-1.989.707-4.144 1.818-5.693 3.267C4.568 8.48 4.275 9.98 4.396 10.607c.427 2.211 3.457 3.657 4.703 4.73v.006c-.367.18-3.056 1.529-3.686 2.925-.675 1.47.105 2.521.615 2.655 1.575.436 3.195-.36 4.065-1.649.84-1.261.766-2.881.404-3.676.496-.135 1.08-.195 1.83-.104 2.101.24 2.521 1.56 2.43 2.1-.09.539-.523.854-.674.944-.15.091-.195.12-.181.181.015.09.091.09.21.075.165-.03 1.096-.45 1.141-1.471.045-1.29-1.186-2.729-3.375-2.7-.9.016-1.471.091-1.875.256-.03-.045-.061-.075-.105-.105-1.35-1.455-3.855-2.475-3.75-4.41.03-.705.285-2.564 4.8-4.814 3.705-1.846 6.661-1.335 7.171-.21.733 1.604-1.576 4.59-5.431 5.024-1.47.165-2.235-.404-2.431-.615-.209-.225-.239-.24-.314-.194-.12.06-.045.255 0 .375.12.3.585.825 1.396 1.095.704.225 2.43.359 4.5-.45 2.324-.899 4.139-3.405 3.614-5.505l.073.067z"/></svg>`;
	const ICON_TYPESCRIPT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>`;
	const ICON_CSS = `<svg width="14" height="14" viewBox="0 0 1000 1000" aria-hidden="true"><path fill="currentColor" d="M0 0H840A160 160 0 0 1 1000 160V840A160 160 0 0 1 840 1000H160A160 160 0 0 1 0 840V0Z"/><path fill="#fff" d="m358.1,920c-64.23-.06-103.86-36.23-103.1-102.79,0,0,0-168.39,0-168.39,0-33.74,9.88-59.4,29.64-76.96,35.49-34.19,117.83-36.27,152.59.52,21.42,18.89,29.5,57.48,27.58,93.49h-73.72c.56-14.15-.19-35.58-8.51-43.65-10.81-14.63-39.36-12.91-46.91,2.32-4.64,8.26-6.96,20.49-6.96,36.67v146.18c0,30.65,10.65,46.15,31.96,46.49,9.96,0,17.53-3.62,22.68-10.85,7.19-8.58,8.31-27.58,7.73-41.32h73.72c5.04,70.07-36.32,119.16-106.71,118.29Zm234.04,0c-71.17.98-103.01-49.66-101.04-118.29h69.59c-1.93,29.92,8.35,57.17,32.99,55.27,10.99,0,18.73-3.44,23.2-10.33,8.5-12.59,10.09-48.95-2.06-63.02-8.49-13.55-39.03-25.51-55.16-33.57-23.03-11.02-39.61-24.1-49.75-39.26-22.87-33.64-20.75-107.48,11.34-137.4,31.18-36.92,112.61-38.62,143.82-.77,19.25,19.51,27.66,57.9,26.03,93.23h-67.02c.57-14.52-.8-37.95-6.44-46.49-3.95-7.23-11.43-10.85-22.42-10.85-19.59,0-29.38,11.71-29.38,35.12.21,24.86,9.9,35.06,32.48,45.45,29.24,11.36,66.42,30.76,79.9,54.24,40.2,71.54,12.62,180.82-86.09,176.65Zm224.76,0c-71.17.98-103.01-49.66-101.04-118.29h69.59c-1.93,29.92,8.35,57.17,32.99,55.27,10.99,0,18.73-3.44,23.2-10.33,8.5-12.59,10.09-48.95-2.06-63.02-8.49-13.55-39.03-25.51-55.16-33.57-23.03-11.02-39.61-24.1-49.75-39.26-22.87-33.64-20.75-107.48,11.34-137.4,31.18-36.92,112.61-38.62,143.82-.77,19.25,19.51,27.66,57.9,26.03,93.23h-67.02c.57-14.52-.8-37.95-6.44-46.49-3.95-7.23-11.43-10.85-22.42-10.85-19.59,0-29.38,11.71-29.38,35.12.21,24.86,9.9,35.06,32.48,45.45,29.24,11.36,66.42,30.76,79.9,54.24,40.2,71.54,12.62,180.82-86.09,176.65Z"/></svg>`;
	const ICON_KOTLIN = `<svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true"><path d="M48 48H0V0H48L23.505 23.6475L48 48Z" fill="url(#kt-grad)"/><defs><radialGradient id="kt-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(48) rotate(180) scale(48)"><stop stop-color="#E44857"/><stop offset=".5" stop-color="#C711E1"/><stop offset="1" stop-color="#7F52FF"/></radialGradient></defs></svg>`;
	const ICON_SWIFT = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5.35" fill="currentColor"/><path fill="#fff" d="M13.543 3.41c4.114 2.47 6.545 7.162 5.549 11.131-.024.093-.05.181-.076.272l.002.001c2.062 2.538 1.5 5.258 1.236 4.745-1.072-2.086-3.066-1.568-4.088-1.043a6.803 6.803 0 0 1-.281.158l-.02.012-.002.002c-2.115 1.123-4.957 1.205-7.812-.022a12.568 12.568 0 0 1-5.64-4.838c.649.48 1.35.902 2.097 1.252 3.019 1.414 6.051 1.311 8.197-.002C9.651 12.73 7.101 9.67 5.146 7.191a10.628 10.628 0 0 1-1.005-1.384c2.34 2.142 6.038 4.83 7.365 5.576C8.69 8.408 6.208 4.743 6.324 4.86c4.436 4.47 8.528 6.996 8.528 6.996.154.085.27.154.36.213.085-.215.16-.437.224-.668.708-2.588-.09-5.548-1.893-7.992z"/></svg>`;
	const ICON_FIGMA = `<svg width="12" height="14" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true"><path d="M6 28c2.21 0 4-1.79 4-4v-4H6c-2.21 0-4 1.79-4 4s1.79 4 4 4z"/><path d="M2 16c0-2.21 1.79-4 4-4h4v8H6c-2.21 0-4-1.79-4-4z"/><path d="M2 8c0-2.21 1.79-4 4-4h4v8H6C3.79 12 2 10.21 2 8z"/><path d="M10 4h4c2.21 0 4 1.79 4 4s-1.79 4-4 4h-4V4z"/><path d="M22 16c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4z"/></svg>`;

	type TechIcon = { svg: string; color: string; label: string };

	const PLATFORMS: { id: Platform; label: string; sublabel: string; color: string; icon: string; techIcons: TechIcon[] }[] = [
		{
			id: 'web', label: 'Web', sublabel: 'SCSS · TS · CSS', color: 'var(--fgColor-accent)', icon: ICON_SASS,
			techIcons: [
				{ svg: ICON_SASS, color: '#CC6699', label: 'SCSS' },
				{ svg: ICON_TYPESCRIPT, color: '#3178C6', label: 'TypeScript' },
				{ svg: ICON_CSS, color: '#663399', label: 'CSS' }
			]
		},
		{
			id: 'android', label: 'Android', sublabel: 'Kotlin', color: '#7F52FF', icon: ICON_KOTLIN,
			techIcons: [{ svg: ICON_KOTLIN, color: '#7F52FF', label: 'Kotlin' }]
		},
		{
			id: 'ios', label: 'iOS', sublabel: 'Swift', color: '#F05138', icon: ICON_SWIFT,
			techIcons: [{ svg: ICON_SWIFT, color: '#F05138', label: 'Swift' }]
		}
	];

	// ─── Lifecycle ───────────────────────────────────────────────────────────────

	onMount(() => {
		if (!browser) return;
		fileStore.init();
		genStore.init();
		uiStore.init();
		settingsStore.init();
		tokenStore.loadStoredTokens().then((loaded) => {
			tokenStore.loadStoredVersions();
			if (loaded && settingsStore.autoGenerate && fileStore.canGenerate) {
				setTimeout(doGenerateNow, 100);
			}
		});
	});

	// ─── Auto-reload on new deployment ──────────────────────────────────────────

	$effect(() => {
		if ($updated && browser) {
			const dest = location.pathname + '?_cb=' + Date.now();
			location.replace(dest);
		}
	});

	// ─── Platform change effect ──────────────────────────────────────────────────

	$effect(() => {
		const key = JSON.stringify(fileStore.selectedPlatforms);
		if (key !== fileStore.prevPlatforms) {
			fileStore.prevPlatforms = key;
			if (genStore.result && fileStore.canGenerate) {
				fileStore.needsRegeneration = true;
			}
			if (genStore.visibleFiles.length && !genStore.visibleFiles.some((f) => f.filename === genStore.activeTab)) {
				genStore.activeTab = genStore.visibleFiles[0].filename;
			}
		}
	});

	// ─── Quality Analysis ────────────────────────────────────────────────────────

	let qualityAdvice = $state<BestPracticeAdvice[]>([]);

	function runQualityAnalysis() {
		const refContent: Record<string, string> = {};
		for (const key of REF_KEYS) {
			const slot = fileStore.slots[key];
			if (slot?.files?.length) {
				for (const f of slot.files) {
					const r = new FileReader();
					r.onload = () => {
						refContent[f.name] = r.result as string;
						qualityAdvice = analyzeReferenceFiles(refContent, fileStore.selectedPlatforms);
					};
					r.readAsText(f);
				}
			} else if (slot?.file) {
				const f = slot.file;
				const r = new FileReader();
				r.onload = () => {
					refContent[f.name] = r.result as string;
					qualityAdvice = analyzeReferenceFiles(refContent, fileStore.selectedPlatforms);
				};
				r.readAsText(f);
			}
		}
		if (REF_KEYS.every((k) => !fileStore.slots[k]?.file && !fileStore.slots[k]?.files?.length)) {
			qualityAdvice = analyzeReferenceFiles({}, fileStore.selectedPlatforms);
		}
	}

	$effect(() => {
		if (genStore.result) {
			runQualityAnalysis();
		}
	});

	const qualityIssueCount = $derived(
		(genStore.result?.warnings?.length ?? 0) + qualityAdvice.length
	);

	// ─── Syntax highlighting effects ─────────────────────────────────────────────

	$effect(() => {
		const files = genStore.visibleFiles;
		if (files.length > 0 && browser) {
			const theme = THEMES.find((t) => t.id === uiStore.selectedTheme) ?? THEMES[2];
			genStore.highlightAll(files, theme.id, theme.bg);
			genStore.computeAllDiffs(files);
		}
	});
	$effect(() => {
		const files = genStore.visibleFiles;
		if (uiStore.selectedTheme && files.length > 0 && browser) {
			const theme = THEMES.find((t) => t.id === uiStore.selectedTheme) ?? THEMES[2];
			genStore.highlightAll(files, theme.id, theme.bg);
		}
	});

	// ─── Highlighted lines effect ────────────────────────────────────────────────

	$effect(() => {
		const _hl = uiStore.highlightedLines;
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

	// ─── Fold / Blame effect ─────────────────────────────────────────────────────

	$effect(() => {
		if (!genStore.highlights || !genStore.result?.files) return;
		const file = genStore.result.files.find((f) => f.filename === genStore.activeTab);
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
				const isCollapsed = uiStore.collapsedSections.has(range.start);
				const hiddenCount = range.end - range.start;
				const toggle = document.createElement('span');
				toggle.className = `fold-toggle ${isCollapsed ? 'fold-toggle--collapsed' : ''}`;
				toggle.textContent = isCollapsed ? '▶' : '▼';
				toggle.title = isCollapsed ? `Expand ${hiddenCount} lines` : 'Collapse section';
				toggle.addEventListener('click', (e) => { e.stopPropagation(); uiStore.toggleFold(range.start); });
				lineEl.prepend(toggle);

				if (isCollapsed) {
					for (let l = range.start; l < range.end; l++) {
						const el = lines[l] as HTMLElement | undefined;
						if (el) el.style.display = 'none';
					}
					const placeholder = document.createElement('div');
					placeholder.className = 'fold-placeholder';
					placeholder.textContent = `··· ${hiddenCount} lines hidden (${range.label}) ···`;
					placeholder.addEventListener('click', () => uiStore.toggleFold(range.start));
					lineEl.after(placeholder);
				} else {
					for (let l = range.start; l < range.end; l++) {
						const el = lines[l] as HTMLElement | undefined;
						if (el) el.style.display = '';
					}
				}
			}

			const diffLines = genStore.diffs[file.filename];
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

	// ─── Breadcrumb updater ──────────────────────────────────────────────────────

	function handleCodeScroll(e: Event) {
		uiStore.handleCodeScroll(e);
		updateBreadcrumb(e.target as HTMLElement);
	}

	function updateBreadcrumb(scrollEl: HTMLElement) {
		if (!genStore.result?.files.length) return;
		const file = genStore.result.files.find((f) => f.filename === genStore.activeTab);
		if (!file) return;
		const sections = extractSections(file.content);
		if (sections.length === 0) { uiStore.currentBreadcrumb = ''; return; }
		const lineH = 22.5;
		const currentLine = Math.floor(scrollEl.scrollTop / lineH) + 1;
		let active = sections[0];
		for (const sec of sections) {
			if (sec.line <= currentLine) active = sec;
			else break;
		}
		uiStore.currentBreadcrumb = active ? active.label : '';
	}

	// ─── Navigation ──────────────────────────────────────────────────────────────

	function handleTabKeydown(e: KeyboardEvent) {
		if (!genStore.visibleFiles.length) return;
		const filenames = genStore.visibleFiles.map((f) => f.filename);
		const idx = filenames.indexOf(genStore.activeTab);
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); genStore.activeTab = filenames[(idx + 1) % filenames.length]; }
		else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); genStore.activeTab = filenames[(idx - 1 + filenames.length) % filenames.length]; }
	}

	function navigateDiff(filename: string, direction: 'prev' | 'next') {
		const lines = genStore.diffs[filename]; if (!lines) return;
		const indices = diffChangeIndices(lines); if (!indices.length) return;
		const current = uiStore.diffNavIndex[filename] ?? -1;
		let next: number;
		if (direction === 'next') next = current < indices.length - 1 ? current + 1 : 0;
		else next = current > 0 ? current - 1 : indices.length - 1;
		uiStore.diffNavIndex[filename] = next;
		document.getElementById(`diff-line-${filename}-${indices[next]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function handleCodeKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); uiStore.searchInputEl?.focus(); }
		if (e.key === 'Escape') uiStore.highlightedLines = null;
		if (e.altKey && genStore.activeTab && genStore.diffs[genStore.activeTab]) {
			if (e.key === 'ArrowDown') { e.preventDefault(); navigateDiff(genStore.activeTab, 'next'); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); navigateDiff(genStore.activeTab, 'prev'); }
		}
	}

	// ─── Generate (delegates to extracted module) ────────────────────────────────

	const REF_KEYS_FOR_GEN: DropZoneKey[] = ['referenceColorsWeb', 'referenceTypographyWeb', 'referenceColorsSwift', 'referenceColorsKotlin', 'referenceTypographySwift', 'referenceTypographyKotlin'];

	let confirmWarnings = $state<string[]>([]);
	let showConfirmDialog = $state(false);

	async function generate() {
		const warnings: string[] = [];
		const refContents: Record<string, string | undefined> = {};
		for (const key of REF_KEYS) {
			const slot = fileStore.slots[key];
			if (slot.files.length > 0) {
				const texts: string[] = [];
				for (const f of slot.files) {
					try { texts.push(await f.text()); } catch { /* skip */ }
				}
				refContents[key] = texts.join('\n');
			} else if (slot.file) {
				try { refContents[key] = await slot.file.text(); } catch { /* skip */ }
			}
		}
		const visibleRefContents: Record<string, string | undefined> = {};
		for (const key of REF_KEYS) {
			if (fileStore.visibleKeys.includes(key)) visibleRefContents[key] = refContents[key];
		}
		const completenessWarnings = detectRefCompleteness(visibleRefContents);
		for (const w of completenessWarnings) warnings.push(w.message);

		if (warnings.length > 0) {
			confirmWarnings = warnings;
			showConfirmDialog = true;
			return;
		}

		await doGenerateNow();
	}

	async function doGenerateNow() {
		showConfirmDialog = false;
		await doGenerate(
			{ fileStore, genStore, tokenStore, uiStore } as GenerationStores,
			REF_KEYS_FOR_GEN,
			toast
		);
	}

	function backToHome() {
		genStore.result = null;
		genStore.activeTab = '';
	}

	function clearAll() {
		fileStore.resetSlots();
		genStore.resetAll();
		uiStore.searchQuery = '';
		uiStore.showSwatches = false;
		uiStore.diffNavIndex = {};
		settingsStore.prResults = [];
		toast.success('All files cleared');
	}

	// ─── Download / Copy (delegates to extracted modules) ────────────────────────

	async function downloadZip() { await doDownloadZip(genStore.result?.files ?? [], toast); }
	async function copyToClipboard(content: string) { await doCopyToClipboard(content, toast); }

	// ─── Google Chat (delegates to extracted module) ─────────────────────────────

	async function notifyTokenUpdate(change: { version: number; added: number; removed: number; summary: string }) {
		await doNotifyTokenUpdate(change, fileStore.selectedPlatforms, settingsStore.chatWebhookUrl, toast);
	}

	// ─── GitHub PR (delegates to extracted module) ───────────────────────────────

	async function sendPRs() {
		await doSendPRs(
			genStore.result,
			settingsStore.githubPat,
			settingsStore.githubRepos,
			buildChangelogCtx(genStore, PLATFORMS),
			toast,
			{
				setSendingPrs: (v) => (settingsStore.sendingPrs = v),
				setPrResults: (v) => (settingsStore.prResults = v),
				openSettings: () => (uiStore.activePanel = 'settings')
			}
		);
	}

	async function retryPr(platform: string) {
		await doRetryPr(
			platform,
			genStore.result,
			settingsStore.githubPat,
			settingsStore.githubRepos,
			buildChangelogCtx(genStore, PLATFORMS),
			settingsStore.prResults,
			toast,
			(v) => (settingsStore.prResults = v)
		);
	}

	// ─── Figma fetch (delegates to extracted module) ─────────────────────────────

	async function onFigmaFetch() {
		await doFigmaFetch(settingsStore as FigmaSettings, (entries) => fileStore.applyTokenData(entries), toast);
	}

	// ─── Plugin sync polling ─────────────────────────────────────────────────────

	$effect(() => {
		if (!browser) return;
		const interval = setInterval(() => {
			tokenStore.checkPluginSync(() => {
				if (settingsStore.autoGenerate && fileStore.canGenerate) {
					setTimeout(doGenerateNow, 100);
				}
			});
		}, 3_000);
		tokenStore.checkPluginSync();
		return () => clearInterval(interval);
	});

	// ─── Stored token version polling (detects pushes to GitHub token repo) ─────

	$effect(() => {
		if (!browser) return;
		const interval = setInterval(() => {
			tokenStore.pollTokenVersion((change) => {
				notifyTokenUpdate(change).catch(() => {});
				if (settingsStore.autoGenerate && fileStore.canGenerate) {
					setTimeout(doGenerateNow, 100);
				}
			});
		}, 30_000);
		return () => clearInterval(interval);
	});

	// ─── Figma webhook polling ───────────────────────────────────────────────────

	$effect(() => {
		if (!browser || !settingsStore.figmaWebhookPasscode) return;
		const poll = () => doPollFigmaWebhook(settingsStore as FigmaSettings);
		const interval = setInterval(poll, 30_000);
		poll();
		return () => clearInterval(interval);
	});

	// ─── Escape handler ──────────────────────────────────────────────────────────

	$effect(() => {
		if (!browser) return;
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				if (uiStore.showThemePicker) uiStore.showThemePicker = false;
				else if (uiStore.showSectionNav) uiStore.showSectionNav = false;
			}
		}
		function onClick(e: MouseEvent) {
			const target = e.target as Element | null;
			if (uiStore.showThemePicker && !target?.closest('.theme-picker')) uiStore.showThemePicker = false;
		}
		document.addEventListener('keydown', onKeydown);
		document.addEventListener('click', onClick);
		return () => { document.removeEventListener('keydown', onKeydown); document.removeEventListener('click', onClick); };
	});
</script>

<div aria-live="polite" aria-atomic="false" role="region" aria-label="Notifications">
	<Toaster theme="dark" position="bottom-right" richColors />
</div>

{#if showConfirmDialog}
	<div class="confirm-overlay" role="dialog" aria-modal="true" aria-label="Generation warnings">
		<div class="confirm-dialog">
			<div class="confirm-icon">
				<AlertTriangle size={20} strokeWidth={2} />
			</div>
			<h3 class="confirm-title">Before generating</h3>
			<ul class="confirm-list">
				{#each confirmWarnings as w, i (i)}
					<li>{w}</li>
				{/each}
			</ul>
			<div class="confirm-actions">
				<button class="confirm-btn confirm-btn--secondary" onclick={() => (showConfirmDialog = false)}>Fix issues</button>
				<button class="confirm-btn confirm-btn--primary" onclick={doGenerateNow}>Generate anyway</button>
			</div>
		</div>
	</div>
{/if}

<AppShell activePanel={uiStore.activePanel} bind:panelWidth={uiStore.panelWidth} welcomeMode={!genStore.result} onClosePanel={() => (uiStore.activePanel = null)}>
	{#snippet header()}
		<HeaderBar
			appColorMode={uiStore.appColorMode}
			onBrandClick={backToHome}
			onThemeToggle={() => {
				const html = document.documentElement;
				const current = html.getAttribute('data-color-mode') ?? 'dark';
				const order = ['dark', 'light', 'auto'];
				const next = order[(order.indexOf(current) + 1) % order.length];
				html.setAttribute('data-color-mode', next === 'auto' ? 'auto' : next);
				localStorage.setItem('app-theme', next);
			}}
		/>
	{/snippet}

	{#snippet rail()}
		<ActivityRail
			active={uiStore.activePanel}
			hasOutput={!!genStore.result}
			{qualityIssueCount}
			onSelect={(id) => uiStore.handleRailSelect(id)}
		/>
	{/snippet}

	{#snippet sidePanel()}
		{#if uiStore.activePanel === 'import'}
			<ImportPanel
				slots={fileStore.slots}
				visibleKeys={fileStore.visibleKeys}
				refKeys={REF_KEYS}
				fileInsights={fileStore.fileInsights}
				platforms={PLATFORMS}
				selectedPlatforms={fileStore.selectedPlatforms}
			hasRefFiles={fileStore.hasRefFiles}
			bulkDropActive={fileStore.bulkDropActive}
				canGenerate={fileStore.canGenerate}
				loading={fileStore.loading}
				errorMsg={genStore.errorMsg}
				requiredFilled={fileStore.requiredFilled}
				iconFigma={ICON_FIGMA}
				onDragEnter={(k, e) => fileStore.handleDragEnter(k, e)}
				onDragOver={(k, e) => fileStore.handleDragOver(k, e)}
				onDragLeave={(k) => fileStore.handleDragLeave(k)}
				onDrop={(k, e) => fileStore.handleDrop(k, e)}
				onFileInput={(k, e) => fileStore.handleFileInput(k, e)}
				onClearFile={(k, e) => fileStore.clearFile(k, e)}
				onBulkDragEnter={(e) => { e.preventDefault(); fileStore.bulkDropActive = true; }}
				onBulkDragOver={(e) => { e.preventDefault(); }}
				onBulkDragLeave={(e) => { if (e.currentTarget === e.target || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) fileStore.bulkDropActive = false; }}
				onBulkDrop={(e) => fileStore.handleBulkDrop(e)}
				onClearAll={clearAll}
				onGenerate={generate}
				storedTokenVersion={tokenStore.storedTokenVersion}
				storedTokenPushedAt={tokenStore.storedTokenPushedAt}
				storedTokenVersions={tokenStore.storedTokenVersions}
				storedTokensLoading={tokenStore.storedTokensLoading}
				tokenChangeSummary={tokenStore.tokenChangeSummary}
				onRefreshStoredTokens={() => tokenStore.refreshStoredTokens()}
				onLoadTokenVersion={(sha) => tokenStore.loadTokenVersion(sha)}
			/>
		{:else if uiStore.activePanel === 'files'}
			<ExplorerPanel
				files={genStore.visibleFiles}
				activeTab={genStore.activeTab}
				diffs={genStore.diffs}
				modifications={genStore.modifications}
				onTabSelect={(f) => (genStore.activeTab = f)}
				onTabKeydown={handleTabKeydown}
			/>
		{:else if uiStore.activePanel === 'settings'}
			<SettingsPanel
				show={true}
				selectedPlatforms={fileStore.selectedPlatforms}
				chatWebhookUrl={settingsStore.chatWebhookUrl}
				githubPat={settingsStore.githubPat}
				githubRepos={settingsStore.githubRepos}
				figmaFileKey={settingsStore.figmaFileKey}
				figmaPat={settingsStore.figmaPat}
				figmaFetching={settingsStore.figmaFetching}
				figmaWebhookPasscode={settingsStore.figmaWebhookPasscode}
				figmaWebhookEvent={settingsStore.figmaWebhookEvent}
				{platformColor}
				onToggle={() => (uiStore.activePanel = null)}
				onChatWebhookChange={(e) => settingsStore.onChatWebhookChange(e)}
				onGithubPatChange={(e) => settingsStore.onGithubPatChange(e)}
				onGithubRepoChange={(p, f, e) => settingsStore.onGithubRepoChange(p, f, e)}
				onFigmaFileKeyChange={(e) => settingsStore.onFigmaFileKeyChange(e)}
				onFigmaPatChange={(e) => settingsStore.onFigmaPatChange(e)}
				{onFigmaFetch}
				onFigmaPasscodeChange={(e) => settingsStore.onFigmaPasscodeChange(e)}
			/>
		{:else if uiStore.activePanel === 'quality'}
			<QualityPanel
				warnings={genStore.result?.warnings ?? []}
				advice={qualityAdvice}
				platforms={fileStore.selectedPlatforms}
				onClose={() => (uiStore.activePanel = null)}
				onRerun={runQualityAnalysis}
			/>
		{:else if uiStore.activePanel === 'help'}
			<HelpPanel onClose={() => (uiStore.activePanel = null)} />
		{/if}
	{/snippet}

	{#snippet editor()}
		{#if !genStore.result}
			<div class="welcome-wrapper">
				<WelcomeView
					platforms={PLATFORMS}
					selectedPlatforms={fileStore.selectedPlatforms}
					onSelectPlatform={(id) => fileStore.selectPlatform(id)}
					swatchCount={fileStore.swatches.length}
					storedTokenVersion={tokenStore.storedTokenVersion}
					storedTokenPushedAt={tokenStore.storedTokenPushedAt}
					refKeys={REF_KEYS}
					visibleKeys={fileStore.visibleKeys}
					slots={fileStore.slots}
					fileInsights={fileStore.fileInsights}
					hasRefFiles={fileStore.hasRefFiles}
					tokensInitialLoading={tokenStore.tokensInitialLoading}
					canGenerate={fileStore.canGenerate}
					loading={fileStore.loading}
					progressStatus={genStore.progressStatus}
					errorMsg={genStore.errorMsg}
					onGenerate={generate}
					onDragEnter={(k, e) => fileStore.handleDragEnter(k, e)}
					onDragOver={(k, e) => fileStore.handleDragOver(k, e)}
					onDragLeave={(k) => fileStore.handleDragLeave(k)}
					onDrop={(k, e) => fileStore.handleDrop(k, e)}
					onFileInput={(k, e) => fileStore.handleFileInput(k, e)}
					onClearFile={(k, e) => fileStore.clearFile(k, e)}
					requiredFilled={fileStore.requiredFilled}
				/>
			</div>
		{:else}
			<EditorPane
				result={genStore.result}
				visibleFiles={genStore.visibleFiles}
				activeTab={genStore.activeTab}
				highlights={genStore.highlights}
				diffs={genStore.diffs}
				viewModes={genStore.viewModes}
				modifications={genStore.modifications}
				renames={genStore.renames}
				familyRenames={genStore.familyRenames}
				tokenCoverage={genStore.tokenCoverage}
				deprecations={genStore.deprecations}
				impactedTokens={genStore.impactedTokens}
				searchQuery={uiStore.searchQuery}
				searchInputEl={uiStore.searchInputEl}
				searchShortcutHint={uiStore.searchShortcutHint}
				highlightedLines={uiStore.highlightedLines}
				wrapLines={uiStore.wrapLines}
				showSectionNav={uiStore.showSectionNav}
				showChangeSummary={uiStore.showChangeSummary}
				collapsedSections={uiStore.collapsedSections}
				currentBreadcrumb={uiStore.currentBreadcrumb}
				codeScrollTop={uiStore.codeScrollTop}
				codeScrollHeight={uiStore.codeScrollHeight}
				codeClientHeight={uiStore.codeClientHeight}
				codeScrollEl={uiStore.codeScrollEl}
				lastGeneratedAt={genStore.lastGeneratedAt}
				sendingPrs={settingsStore.sendingPrs}
				diffTotals={genStore.diffTotals}
				diffNavIndex={uiStore.diffNavIndex}
				swatches={fileStore.swatches}
				showSwatches={uiStore.showSwatches}
				swatchComparisons={genStore.swatchComparisons}
				swatchTab={uiStore.swatchTab}
				prResults={settingsStore.prResults}
				platformMismatches={genStore.platformMismatches}
				themes={THEMES}
				selectedTheme={uiStore.selectedTheme}
				showThemePicker={uiStore.showThemePicker}
				selectedPlatforms={fileStore.selectedPlatforms}
				tokensUpdatedBanner={tokenStore.tokensUpdatedBanner}
				onRegenerate={generate}
				onBackToHome={backToHome}
				hasDualMode={genStore.hasDualMode}
				activeMode={genStore.activeMode}
				onModeChange={(mode) => genStore.setMode(mode)}
				{formatTime}
				{timeAgo}
				{platformColor}
				onTabSelect={(f) => (genStore.activeTab = f)}
				onTabKeydown={handleTabKeydown}
				onViewModeChange={(filename, mode) => (genStore.viewModes[filename] = mode)}
				onSearchChange={(q) => (uiStore.searchQuery = q)}
				onSearchInputBind={(el) => (uiStore.searchInputEl = el)}
				onCodeKeydown={handleCodeKeydown}
				onCodeScroll={handleCodeScroll}
				onCodeScrollBind={(el) => (uiStore.codeScrollEl = el)}
				onLineClick={(n, e) => uiStore.handleLineClick(n, e)}
				onSectionNavToggle={() => (uiStore.showSectionNav = !uiStore.showSectionNav)}
				onScrollToLine={(n) => uiStore.scrollToLine(n)}
				onWrapToggle={() => (uiStore.wrapLines = !uiStore.wrapLines)}
				onChangeSummaryToggle={(f) => (uiStore.showChangeSummary[f] = !uiStore.showChangeSummary[f])}
				onNavigateDiff={navigateDiff}
				onSeekMinimap={(f) => uiStore.seekMinimap(f)}
				onDownloadZip={downloadZip}
				onCopyFile={() => { if (genStore.activeFile) copyToClipboard(genStore.activeFile.content); }}
				onSendPRs={sendPRs}
				onCopyChangelog={() => copyToClipboard(generateChangelog(buildChangelogCtx(genStore, PLATFORMS)))}
				onToggleSwatches={() => (uiStore.showSwatches = !uiStore.showSwatches)}
				onSwatchTabChange={(t) => (uiStore.swatchTab = t)}
				onDismissPrResults={() => (settingsStore.prResults = [])}
				onRetryPr={retryPr}
				onChangeTheme={(id) => uiStore.changeTheme(id)}
				onThemePickerToggle={() => (uiStore.showThemePicker = !uiStore.showThemePicker)}
				{extractSections}
				{extractDiffColor}
				{computeHunkHeaders}
				{nearestContext}
				{langLabel}
				{formatFileSize}
			/>
		{/if}
	{/snippet}

	{#snippet statusBar()}
		<StatusBar
			activeFile={genStore.activeFile}
			diffs={genStore.diffs}
			modifications={genStore.modifications}
			diffTotals={genStore.diffTotals}
			warnings={genStore.result?.warnings ?? []}
			lastGeneratedAt={genStore.lastGeneratedAt}
			{langLabel}
			{formatFileSize}
			{timeAgo}
		/>
	{/snippet}

	{#snippet bottomTab()}
		<BottomTabBar
			active={uiStore.activePanel}
			hasOutput={!!genStore.result}
			{qualityIssueCount}
			onSelect={(id) => uiStore.handleRailSelect(id)}
		/>
	{/snippet}
</AppShell>

<style>
	.welcome-wrapper {
		display: flex;
		flex: 1;
		min-height: 0;
		animation: view-enter 300ms ease both;
	}

	@keyframes view-enter {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.welcome-wrapper {
			animation-duration: 0.01ms !important;
		}
	}

	:global(:root) {
		--brand-color: #F43F5E;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: var(--font-display);
		background: var(--bgColor-default);
		color: var(--fgColor-default);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		font-size: 13px;
		line-height: 1.5;
		overflow: hidden;
	}

	:global(:focus-visible) {
		outline: 2px solid var(--fgColor-accent);
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
		font-family: var(--font-code) !important;
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
		transition: opacity var(--transition-fast);
	}
	:global(.shiki-wrap .line:hover .fold-toggle), :global(.fold-toggle--collapsed) { opacity: 1; }
	:global(.fold-toggle:hover) { color: var(--fgColor-accent); }
	:global(.fold-placeholder) {
		padding: 2px 16px 2px 60px;
		font-family: var(--font-code); font-size: 10.5px;
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
		font-family: var(--font-code); font-size: 8px;
		color: var(--fgColor-disabled); white-space: nowrap;
	}

	/* ─── Pre-generation confirmation dialog ──────────────────────────────────── */
	.confirm-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.confirm-dialog {
		background: var(--bgColor-muted);
		border: 1px solid var(--borderColor-muted);
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 440px;
		width: 90%;
		box-shadow: var(--shadow-panel);
	}

	.confirm-icon {
		color: var(--fgColor-attention);
		margin-bottom: 12px;
	}

	.confirm-title {
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 700;
		color: var(--fgColor-default);
		margin-bottom: 12px;
	}

	.confirm-list {
		list-style: none;
		padding: 0;
		margin: 0 0 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.confirm-list li {
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--fgColor-muted);
		line-height: 1.6;
		padding-left: 16px;
		position: relative;
	}

	.confirm-list li::before {
		content: '•';
		position: absolute;
		left: 0;
		color: var(--fgColor-attention);
	}

	.confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.confirm-btn {
		padding: 7px 16px;
		border-radius: var(--radius-md);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--borderColor-muted);
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.confirm-btn--secondary {
		background: var(--bgColor-default);
		color: var(--fgColor-muted);
	}

	.confirm-btn--secondary:hover {
		background: var(--control-bgColor-hover);
		border-color: var(--borderColor-default);
	}

	.confirm-btn--primary {
		background: var(--brand-color);
		color: var(--fgColor-onEmphasis);
		border-color: var(--brand-color);
	}

	.confirm-btn--primary:hover {
		background: color-mix(in srgb, var(--brand-color) 85%, white);
	}
</style>
