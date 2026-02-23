/**
 * GitHub-backed token storage.
 *
 * Persists design-token JSON files to a dedicated GitHub repo using the
 * Git Trees API (atomic multi-file commits). Reads them back via the
 * Contents API.  Falls back gracefully when env vars are missing.
 */

import { env } from '$env/dynamic/private';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenManifest {
	version: number;
	pushedAt: string;
	tokenCounts: {
		colors: number;
		values: number;
		typography: number;
	};
}

export interface StoredTokens {
	available: true;
	manifest: TokenManifest;
	lightColors: Record<string, unknown>;
	darkColors: Record<string, unknown>;
	values: Record<string, unknown>;
	typography: Record<string, unknown>;
}

export interface TokenVersionSummary {
	sha: string;
	version: number;
	pushedAt: string;
	message: string;
}

interface GitHubTreeItem {
	path: string;
	mode: '100644';
	type: 'blob';
	content: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getConfig(): { pat: string; owner: string; repo: string } | null {
	const pat = env.TOKENS_GITHUB_PAT;
	const repoStr = env.TOKENS_GITHUB_REPO;
	if (!pat || !repoStr) return null;
	const [owner, repo] = repoStr.split('/');
	if (!owner || !repo) return null;
	return { pat, owner, repo };
}

const API = 'https://api.github.com';
const BRANCH = 'main';
const DIR = 'tokens/latest';

function headers(pat: string): Record<string, string> {
	return {
		Authorization: `Bearer ${pat}`,
		Accept: 'application/vnd.github+json',
		'Content-Type': 'application/json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

let cachedTokens: StoredTokens | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

// ─── Public API ──────────────────────────────────────────────────────────────

export function isConfigured(): boolean {
	return getConfig() !== null;
}

export async function fetchManifestOnly(): Promise<TokenManifest | null> {
	const cfg = getConfig();
	if (!cfg) return null;
	return fetchManifest(cfg);
}

/**
 * Commits token files + manifest to the GitHub repo as a single atomic commit.
 * Returns the new manifest on success, or null if storage is not configured.
 */
export async function commitTokens(data: {
	lightColors: Record<string, unknown>;
	darkColors: Record<string, unknown>;
	values: Record<string, unknown>;
	typography: Record<string, unknown>;
}): Promise<TokenManifest | null> {
	const cfg = getConfig();
	if (!cfg) return null;

	const currentManifest = await fetchManifest(cfg);
	const nextVersion = (currentManifest?.version ?? 0) + 1;

	const manifest: TokenManifest = {
		version: nextVersion,
		pushedAt: new Date().toISOString(),
		tokenCounts: {
			colors: countKeys(data.lightColors),
			values: countKeys(data.values),
			typography: countKeys(data.typography)
		}
	};

	const files: GitHubTreeItem[] = [
		{ path: `${DIR}/light.tokens.json`, mode: '100644', type: 'blob', content: JSON.stringify(data.lightColors, null, 2) },
		{ path: `${DIR}/dark.tokens.json`, mode: '100644', type: 'blob', content: JSON.stringify(data.darkColors, null, 2) },
		{ path: `${DIR}/value.tokens.json`, mode: '100644', type: 'blob', content: JSON.stringify(data.values, null, 2) },
		{ path: `${DIR}/typography.tokens.json`, mode: '100644', type: 'blob', content: JSON.stringify(data.typography, null, 2) },
		{ path: 'tokens/manifest.json', mode: '100644', type: 'blob', content: JSON.stringify(manifest, null, 2) }
	];

	const latestSha = await getHeadSha(cfg);
	const treeSha = await createTree(cfg, latestSha, files);
	await createCommit(cfg, treeSha, latestSha, `v${nextVersion} — design tokens update`);

	cachedTokens = {
		available: true,
		manifest,
		lightColors: data.lightColors,
		darkColors: data.darkColors,
		values: data.values,
		typography: data.typography
	};
	cachedAt = Date.now();

	return manifest;
}

/**
 * Fetches the latest token files from GitHub. Uses an in-memory cache (60s TTL).
 */
export async function fetchLatestTokens(): Promise<StoredTokens | { available: false; reason: string }> {
	const cfg = getConfig();
	if (!cfg) return { available: false, reason: 'not_configured' };

	if (cachedTokens && Date.now() - cachedAt < CACHE_TTL_MS) {
		return cachedTokens;
	}

	try {
		const [manifest, light, dark, values, typography] = await Promise.all([
			fetchFileJson<TokenManifest>(cfg, 'tokens/manifest.json'),
			fetchFileJson<Record<string, unknown>>(cfg, `${DIR}/light.tokens.json`),
			fetchFileJson<Record<string, unknown>>(cfg, `${DIR}/dark.tokens.json`),
			fetchFileJson<Record<string, unknown>>(cfg, `${DIR}/value.tokens.json`),
			fetchFileJson<Record<string, unknown>>(cfg, `${DIR}/typography.tokens.json`)
		]);

		if (!manifest || !light || !dark || !values) {
			return { available: false, reason: 'no_tokens_stored' };
		}

		const result: StoredTokens = {
			available: true,
			manifest,
			lightColors: light,
			darkColors: dark,
			values,
			typography: typography ?? {}
		};

		cachedTokens = result;
		cachedAt = Date.now();
		return result;
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		return { available: false, reason: msg };
	}
}

/**
 * Returns recent version history by reading commits that touched manifest.json.
 */
export async function fetchVersionHistory(limit = 10): Promise<TokenVersionSummary[]> {
	const cfg = getConfig();
	if (!cfg) return [];

	try {
		const url = `${API}/repos/${cfg.owner}/${cfg.repo}/commits?path=tokens/manifest.json&per_page=${limit}`;
		const res = await fetch(url, { headers: headers(cfg.pat) });
		if (!res.ok) return [];

		const commits = (await res.json()) as Array<{
			sha: string;
			commit: { message: string; committer: { date: string } };
		}>;

		return commits.map((c, i) => {
			const versionMatch = c.commit.message.match(/^v(\d+)/);
			return {
				sha: c.sha.slice(0, 7),
				version: versionMatch ? parseInt(versionMatch[1], 10) : commits.length - i,
				pushedAt: c.commit.committer.date,
				message: c.commit.message
			};
		});
	} catch {
		return [];
	}
}

/**
 * Fetches token files at a specific commit sha.
 */
export async function fetchTokensAtVersion(sha: string): Promise<StoredTokens | { available: false; reason: string }> {
	const cfg = getConfig();
	if (!cfg) return { available: false, reason: 'not_configured' };

	try {
		const [manifest, light, dark, values, typography] = await Promise.all([
			fetchFileJsonAtRef(cfg, 'tokens/manifest.json', sha),
			fetchFileJsonAtRef(cfg, `${DIR}/light.tokens.json`, sha),
			fetchFileJsonAtRef(cfg, `${DIR}/dark.tokens.json`, sha),
			fetchFileJsonAtRef(cfg, `${DIR}/value.tokens.json`, sha),
			fetchFileJsonAtRef(cfg, `${DIR}/typography.tokens.json`, sha)
		]);

		if (!manifest || !light || !dark || !values) {
			return { available: false, reason: 'files_not_found_at_version' };
		}

		return {
			available: true,
			manifest: manifest as TokenManifest,
			lightColors: light as Record<string, unknown>,
			darkColors: dark as Record<string, unknown>,
			values: values as Record<string, unknown>,
			typography: (typography ?? {}) as Record<string, unknown>
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		return { available: false, reason: msg };
	}
}

// ─── GitHub REST helpers ─────────────────────────────────────────────────────

async function getHeadSha(cfg: { pat: string; owner: string; repo: string }): Promise<string> {
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${BRANCH}`;
	const res = await fetch(url, { headers: headers(cfg.pat) });
	if (!res.ok) {
		if (res.status === 404 || res.status === 409) {
			return await initializeRepo(cfg);
		}
		throw new Error(`Failed to get HEAD: ${res.status}`);
	}
	const data = (await res.json()) as { object: { sha: string } };
	return data.object.sha;
}

async function initializeRepo(cfg: { pat: string; owner: string; repo: string }): Promise<string> {
	// Use the Contents API to bootstrap an empty repo — the low-level Git API
	// (blobs, trees, commits) returns 409 until at least one commit exists.
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/README.md`;
	const res = await fetch(url, {
		method: 'PUT',
		headers: headers(cfg.pat),
		body: JSON.stringify({
			message: 'Initial commit',
			content: btoa('# Design Tokens\n\nManaged by Tokensmith.\n'),
			branch: BRANCH
		})
	});
	if (!res.ok) throw new Error(`Failed to initialize repo: ${res.status}`);
	const data = (await res.json()) as { commit: { sha: string } };
	return data.commit.sha;
}

async function createBlob(cfg: { pat: string; owner: string; repo: string }, content: string): Promise<string> {
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/git/blobs`;
	const res = await fetch(url, {
		method: 'POST',
		headers: headers(cfg.pat),
		body: JSON.stringify({ content, encoding: 'utf-8' })
	});
	if (!res.ok) throw new Error(`Failed to create blob: ${res.status}`);
	const data = (await res.json()) as { sha: string };
	return data.sha;
}

async function createTree(
	cfg: { pat: string; owner: string; repo: string },
	baseSha: string,
	items: GitHubTreeItem[]
): Promise<string> {
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/git/trees`;
	const res = await fetch(url, {
		method: 'POST',
		headers: headers(cfg.pat),
		body: JSON.stringify({ base_tree: baseSha, tree: items })
	});
	if (!res.ok) throw new Error(`Failed to create tree: ${res.status}`);
	const data = (await res.json()) as { sha: string };
	return data.sha;
}

async function createCommit(
	cfg: { pat: string; owner: string; repo: string },
	treeSha: string,
	parentSha: string,
	message: string
): Promise<string> {
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/git/commits`;
	const res = await fetch(url, {
		method: 'POST',
		headers: headers(cfg.pat),
		body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
	});
	if (!res.ok) throw new Error(`Failed to create commit: ${res.status}`);
	const data = (await res.json()) as { sha: string };

	await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${BRANCH}`, {
		method: 'PATCH',
		headers: headers(cfg.pat),
		body: JSON.stringify({ sha: data.sha })
	});

	return data.sha;
}

async function fetchFileJson<T>(
	cfg: { pat: string; owner: string; repo: string },
	path: string
): Promise<T | null> {
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${BRANCH}`;
	const res = await fetch(url, {
		headers: { ...headers(cfg.pat), Accept: 'application/vnd.github.raw+json' }
	});
	if (!res.ok) return null;
	return (await res.json()) as T;
}

async function fetchFileJsonAtRef<T>(
	cfg: { pat: string; owner: string; repo: string },
	path: string,
	ref: string
): Promise<T | null> {
	const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`;
	const res = await fetch(url, {
		headers: { ...headers(cfg.pat), Accept: 'application/vnd.github.raw+json' }
	});
	if (!res.ok) return null;
	return (await res.json()) as T;
}

async function fetchManifest(cfg: { pat: string; owner: string; repo: string }): Promise<TokenManifest | null> {
	return fetchFileJson<TokenManifest>(cfg, 'tokens/manifest.json');
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function countKeys(obj: Record<string, unknown>): number {
	let count = 0;
	for (const val of Object.values(obj)) {
		if (val && typeof val === 'object' && '$type' in (val as Record<string, unknown>)) {
			count++;
		} else if (val && typeof val === 'object') {
			count += countKeys(val as Record<string, unknown>);
		}
	}
	return count;
}
