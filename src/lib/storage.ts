/**
 * Storage helpers for Tokensmith.
 *
 * Keys used:
 *   tokenSync:ref:{slotKey}  → { name, content, savedAt }
 *   tokenSync:result         → last GenerateResponse JSON
 *   tokenSync:platforms      → Platform[] JSON
 *   tokenSync:notifyUrl      → Google Chat webhook URL
 *   tokenSync:githubPat      → GitHub PAT
 *   tokenSync:githubRepos    → GithubConfigs JSON
 */

import type { Platform, GithubConfigs } from '$lib/types.js';

const PREFIX = 'tokenSync';
const STORAGE_VERSION = 4;

/**
 * Check if stored data is from a previous app version. If so, clear stale
 * state that may conflict with new code. Preserves settings (PATs, webhook URLs)
 * but clears cached results and ref files that may have incompatible shapes.
 */
export function migrateStorageIfNeeded(): void {
	try {
		const raw = localStorage.getItem(`${PREFIX}:version`);
		const stored = raw ? parseInt(raw, 10) : 0;
		if (stored >= STORAGE_VERSION) return;

		localStorage.removeItem(`${PREFIX}:result`);
		localStorage.removeItem(`${PREFIX}:platforms`);
		localStorage.removeItem(`${PREFIX}:history`);
		localStorage.removeItem(`${PREFIX}:bestPractices`);

		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(`${PREFIX}:ref:`)) keysToRemove.push(key);
		}
		keysToRemove.forEach((k) => localStorage.removeItem(k));

		localStorage.setItem(`${PREFIX}:version`, String(STORAGE_VERSION));
	} catch {
		// private browsing or quota — fail silently
	}
}

interface StoredRefFileEntry {
	name: string;
	content: string;
}

interface StoredRefFile {
	name: string;
	content: string;
	savedAt: string; // ISO timestamp
	entries?: StoredRefFileEntry[];
}

interface StoredResult {
	// Mirrors GenerateResponse from +page.svelte — kept as unknown to avoid circular deps
	data: unknown;
	savedAt: string;
}

// ─── Reference files ──────────────────────────────────────────────────────────

export function saveRefFile(
	slotKey: string,
	name: string,
	content: string,
	entries?: StoredRefFileEntry[]
): void {
	try {
		const payload: StoredRefFile = { name, content, savedAt: new Date().toISOString(), entries };
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
