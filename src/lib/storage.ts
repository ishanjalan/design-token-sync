/**
 * Storage helpers for Tokensmith.
 *
 * Keys used:
 *   tokenSync:ref:{slotKey}  → { name, content, savedAt }
 *   tokenSync:result         → last GenerateResponse JSON
 *   tokenSync:platforms      → Platform[] JSON
 *   tokenSync:history        → HistoryEntry[] JSON (last 5)
 *   tokenSync:notifyUrl      → Google Chat webhook URL
 *   tokenSync:githubPat      → GitHub PAT
 *   tokenSync:githubRepos    → GithubConfigs JSON
 */

import type { Platform, HistoryEntry, GithubConfigs } from '$lib/types.js';

const PREFIX = 'tokenSync';

interface StoredRefFile {
	name: string;
	content: string;
	savedAt: string; // ISO timestamp
}

interface StoredResult {
	// Mirrors GenerateResponse from +page.svelte — kept as unknown to avoid circular deps
	data: unknown;
	savedAt: string;
}

// ─── Reference files ──────────────────────────────────────────────────────────

export function saveRefFile(slotKey: string, name: string, content: string): void {
	try {
		const payload: StoredRefFile = { name, content, savedAt: new Date().toISOString() };
		localStorage.setItem(`${PREFIX}:ref:${slotKey}`, JSON.stringify(payload));
	} catch {
		// Quota exceeded or private browsing — fail silently
	}
}

export function loadRefFile(slotKey: string): StoredRefFile | null {
	try {
		const raw = localStorage.getItem(`${PREFIX}:ref:${slotKey}`);
		if (!raw) return null;
		return JSON.parse(raw) as StoredRefFile;
	} catch {
		return null;
	}
}

export function clearRefFile(slotKey: string): void {
	try {
		localStorage.removeItem(`${PREFIX}:ref:${slotKey}`);
	} catch {
		// ignore
	}
}

// ─── Last result ──────────────────────────────────────────────────────────────

export function saveResult(data: unknown): void {
	try {
		const payload: StoredResult = { data, savedAt: new Date().toISOString() };
		localStorage.setItem(`${PREFIX}:result`, JSON.stringify(payload));
	} catch {
		// ignore
	}
}

export function loadResult(): StoredResult | null {
	try {
		const raw = localStorage.getItem(`${PREFIX}:result`);
		if (!raw) return null;
		return JSON.parse(raw) as StoredResult;
	} catch {
		return null;
	}
}

// ─── Platform selection ───────────────────────────────────────────────────────

export function savePlatforms(platforms: Platform[]): void {
	try {
		localStorage.setItem(`${PREFIX}:platforms`, JSON.stringify(platforms));
	} catch {
		// ignore
	}
}

export function loadPlatforms(): Platform[] | null {
	try {
		const raw = localStorage.getItem(`${PREFIX}:platforms`);
		if (!raw) return null;
		return JSON.parse(raw) as Platform[];
	} catch {
		return null;
	}
}

// ─── History ──────────────────────────────────────────────────────────────────

const HISTORY_MAX = 5;

export function saveToHistory(entry: HistoryEntry): void {
	try {
		const existing = loadHistory();
		const updated = [entry, ...existing].slice(0, HISTORY_MAX);
		localStorage.setItem(`${PREFIX}:history`, JSON.stringify(updated));
	} catch {
		// ignore
	}
}

export function loadHistory(): HistoryEntry[] {
	try {
		const raw = localStorage.getItem(`${PREFIX}:history`);
		if (!raw) return [];
		return JSON.parse(raw) as HistoryEntry[];
	} catch {
		return [];
	}
}

// ─── Notification settings ────────────────────────────────────────────────────

export function saveNotifyUrl(url: string): void {
	try {
		localStorage.setItem(`${PREFIX}:notifyUrl`, url);
	} catch {
		// ignore
	}
}

export function loadNotifyUrl(): string {
	try {
		return localStorage.getItem(`${PREFIX}:notifyUrl`) ?? '';
	} catch {
		return '';
	}
}

// ─── GitHub settings ──────────────────────────────────────────────────────────

export function saveGithubPat(pat: string): void {
	try {
		localStorage.setItem(`${PREFIX}:githubPat`, pat);
	} catch {
		// ignore
	}
}

export function loadGithubPat(): string {
	try {
		return localStorage.getItem(`${PREFIX}:githubPat`) ?? '';
	} catch {
		return '';
	}
}

export function saveGithubRepos(configs: GithubConfigs): void {
	try {
		localStorage.setItem(`${PREFIX}:githubRepos`, JSON.stringify(configs));
	} catch {
		// ignore
	}
}

export function loadGithubRepos(): GithubConfigs {
	try {
		const raw = localStorage.getItem(`${PREFIX}:githubRepos`);
		if (!raw) return {};
		return JSON.parse(raw) as GithubConfigs;
	} catch {
		return {};
	}
}

// ─── Figma API settings ──────────────────────────────────────────────────────

export function saveFigmaFileKey(fileKey: string): void {
	try {
		localStorage.setItem(`${PREFIX}:figmaFileKey`, fileKey);
	} catch {
		// ignore
	}
}

export function loadFigmaFileKey(): string {
	try {
		return localStorage.getItem(`${PREFIX}:figmaFileKey`) ?? '';
	} catch {
		return '';
	}
}

export function saveFigmaPat(pat: string): void {
	try {
		localStorage.setItem(`${PREFIX}:figmaPat`, pat);
	} catch {
		// ignore
	}
}

export function loadFigmaPat(): string {
	try {
		return localStorage.getItem(`${PREFIX}:figmaPat`) ?? '';
	} catch {
		return '';
	}
}

// ─── Figma webhook settings ──────────────────────────────────────────────────

export function saveFigmaWebhookPasscode(passcode: string): void {
	try {
		localStorage.setItem(`${PREFIX}:figmaWebhookPasscode`, passcode);
	} catch {
		// ignore
	}
}

export function loadFigmaWebhookPasscode(): string {
	try {
		return localStorage.getItem(`${PREFIX}:figmaWebhookPasscode`) ?? '';
	} catch {
		return '';
	}
}

// ─── Clear all ────────────────────────────────────────────────────────────────

export function clearAllStorage(): void {
	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(PREFIX)) keysToRemove.push(key);
		}
		keysToRemove.forEach((k) => localStorage.removeItem(k));
	} catch {
		// ignore
	}
}
