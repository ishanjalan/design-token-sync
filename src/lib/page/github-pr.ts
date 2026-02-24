import type { Platform, GenerateResponse } from '$lib/types.js';
import { generateChangelog, type ChangelogContext } from '$lib/diff-utils.js';

interface PrConfig {
	owner: string;
	repo: string;
	branch: string;
	dir: string;
}

interface PrResult {
	platform: string;
	url: string;
	status: 'success' | 'failed';
	error?: string;
}

export async function sendPRs(
	result: GenerateResponse | null,
	githubPat: string | null,
	githubRepos: Record<string, PrConfig>,
	changelogCtx: ChangelogContext,
	toast: { success: (msg: string) => void; error: (msg: string) => void; warning: (msg: string, opts?: { duration: number }) => void },
	callbacks: {
		setSendingPrs: (v: boolean) => void;
		setPrResults: (v: PrResult[]) => void;
		openSettings: () => void;
	}
): Promise<void> {
	if (!result?.files.length) return;
	if (!githubPat) {
		toast.warning('Add your GitHub PAT in Settings first', { duration: 8000 });
		callbacks.openSettings();
		return;
	}
	callbacks.setSendingPrs(true);
	callbacks.setPrResults([]);
	try {
		const grouped = new Map<string, { platforms: string[]; owner: string; repo: string; baseBranch: string; targetDir: string; files: { filename: string; content: string }[] }>();
		for (const platform of result.platforms) {
			const cfg = githubRepos[platform as Platform];
			if (!cfg?.owner || !cfg?.repo) continue;
			const repoKey = `${cfg.owner}/${cfg.repo}`;
			const existing = grouped.get(repoKey);
			const platFiles = result.files.filter((f) => f.platform === platform).map((f) => ({ filename: f.filename, content: f.content }));
			if (existing) { existing.platforms.push(platform); existing.files.push(...platFiles); }
			else { grouped.set(repoKey, { platforms: [platform], owner: cfg.owner, repo: cfg.repo, baseBranch: cfg.branch || 'main', targetDir: cfg.dir || '', files: platFiles }); }
		}
		const repos = Array.from(grouped.values()).map((g) => ({ platform: g.platforms.join('+'), owner: g.owner, repo: g.repo, baseBranch: g.baseBranch, targetDir: g.targetDir, files: g.files }));
		if (repos.length === 0) {
			toast.error('Configure repo settings for at least one platform');
			callbacks.openSettings();
			return;
		}
		const changelog = generateChangelog(changelogCtx);
		const res = await fetch('/api/github/pr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: githubPat, repos, description: changelog }) });
		if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(text || `HTTP ${res.status}`); }
		let data: { prs: { platform: string; url: string }[]; errors: string[] };
		try { data = await res.json(); } catch { throw new Error('Server returned invalid JSON'); }
		const successResults = (data.prs ?? []).map((p) => ({ ...p, status: 'success' as const }));
		const failedResults = (data.errors ?? []).map((errMsg) => { const platformMatch = errMsg.match(/^(\w+)\s*\(/); return { platform: platformMatch?.[1] ?? 'unknown', url: '', status: 'failed' as const, error: errMsg }; });
		callbacks.setPrResults([...successResults, ...failedResults]);
		if (successResults.length > 0) {
			toast.success(`${successResults.length} PR${successResults.length > 1 ? 's' : ''} created`);
		}
		if (failedResults.length > 0) toast.error(`${failedResults.length} PR${failedResults.length > 1 ? 's' : ''} failed`);
	} catch (e) {
		toast.error(`PR creation failed: ${e instanceof Error ? e.message : String(e)}`);
	} finally {
		callbacks.setSendingPrs(false);
	}
}

export async function retryPr(
	platform: string,
	result: GenerateResponse | null,
	githubPat: string | null,
	githubRepos: Record<string, PrConfig>,
	changelogCtx: ChangelogContext,
	prResults: PrResult[],
	toast: { success: (msg: string) => void; error: (msg: string) => void },
	setPrResults: (v: PrResult[]) => void
): Promise<void> {
	if (!result?.files.length || !githubPat) return;
	const cfg = githubRepos[platform as Platform];
	if (!cfg?.owner || !cfg?.repo) { toast.error(`No repo configured for ${platform}`); return; }
	const files = result.files.filter((f) => f.platform === platform).map((f) => ({ filename: f.filename, content: f.content }));
	if (!files.length) return;
	const idx = prResults.findIndex((p) => p.platform === platform);
	const updated = [...prResults];
	if (idx >= 0) updated[idx] = { ...updated[idx], status: 'success', error: undefined, url: '…' };
	setPrResults(updated);
	try {
		const changelog = generateChangelog(changelogCtx);
		const res = await fetch('/api/github/pr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: githubPat, repos: [{ platform, owner: cfg.owner, repo: cfg.repo, baseBranch: cfg.branch || 'main', targetDir: cfg.dir || '', files }], description: changelog }) });
		if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
		const data: { prs: { platform: string; url: string }[]; errors: string[] } = await res.json();
		if (data.prs?.length && idx >= 0) {
			const u = [...prResults];
			u[idx] = { platform, url: data.prs[0].url, status: 'success' };
			setPrResults(u);
			toast.success(`PR retried for ${platform}`);
		} else if (data.errors?.length) throw new Error(data.errors[0]);
	} catch (e) {
		if (idx >= 0) {
			const u = [...prResults];
			u[idx] = { platform, url: '', status: 'failed', error: e instanceof Error ? e.message : String(e) };
			setPrResults(u);
		}
		toast.error(`Retry failed for ${platform}`);
	}
}
