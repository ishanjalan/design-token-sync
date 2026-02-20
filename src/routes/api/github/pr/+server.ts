import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const FileSchema = z.object({
	filename: z.string(),
	content: z.string()
});

const RepoPushSchema = z.object({
	platform: z.string(),
	owner: z.string().min(1),
	repo: z.string().min(1),
	baseBranch: z.string().min(1).default('main'),
	targetDir: z.string().default(''),
	files: z.array(FileSchema)
});

const BodySchema = z.object({
	token: z.string().min(1),
	repos: z.array(RepoPushSchema).min(1),
	description: z.string().optional()
});

// ─── Encoding helpers ─────────────────────────────────────────────────────────

function encodeBase64(str: string): string {
	const bytes = new TextEncoder().encode(str);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

// ─── GitHub REST helpers ───────────────────────────────────────────────────────

async function ghFetch(token: string, path: string, options: RequestInit = {}): Promise<Response> {
	return fetch(`https://api.github.com${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json',
			...(options.headers ?? {})
		}
	});
}

async function getBranchSha(
	token: string,
	owner: string,
	repo: string,
	branch: string
): Promise<string> {
	const res = await ghFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
	if (!res.ok) throw new Error(`Branch ${branch} not found in ${owner}/${repo}: ${res.status}`);
	const data = (await res.json()) as { object: { sha: string } };
	return data.object.sha;
}

async function createBranch(
	token: string,
	owner: string,
	repo: string,
	newBranch: string,
	fromSha: string
): Promise<void> {
	const res = await ghFetch(token, `/repos/${owner}/${repo}/git/refs`, {
		method: 'POST',
		body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: fromSha })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to create branch ${newBranch}: ${res.status} ${text}`);
	}
}

async function getFileSha(
	token: string,
	owner: string,
	repo: string,
	filePath: string,
	branch: string
): Promise<string | undefined> {
	const res = await ghFetch(token, `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`);
	if (res.status === 404) return undefined;
	if (!res.ok) return undefined;
	const data = (await res.json()) as { sha?: string };
	return data.sha;
}

async function upsertFile(
	token: string,
	owner: string,
	repo: string,
	filePath: string,
	content: string,
	branch: string,
	message: string
): Promise<void> {
	const sha = await getFileSha(token, owner, repo, filePath, branch);
	const body: Record<string, string> = {
		message,
		content: encodeBase64(content),
		branch
	};
	if (sha) body.sha = sha;

	const res = await ghFetch(token, `/repos/${owner}/${repo}/contents/${filePath}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to upsert ${filePath}: ${res.status} ${text}`);
	}
}

async function createPR(
	token: string,
	owner: string,
	repo: string,
	head: string,
	base: string,
	title: string,
	body: string
): Promise<string> {
	const res = await ghFetch(token, `/repos/${owner}/${repo}/pulls`, {
		method: 'POST',
		body: JSON.stringify({ title, body, head, base })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to create PR in ${owner}/${repo}: ${res.status} ${text}`);
	}
	const data = (await res.json()) as { html_url: string };
	return data.html_url;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const parsed = BodySchema.safeParse(body);
	if (!parsed.success) {
		throw error(422, `Invalid request: ${parsed.error.message}`);
	}

	const { token, repos, description } = parsed.data;
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const branchName = `design-tokens/sync-${timestamp}`;

	const prs: { platform: string; url: string }[] = [];
	const errors: string[] = [];

	for (const repoCfg of repos) {
		try {
			const { platform, owner, repo, baseBranch, targetDir, files } = repoCfg;

			// Get the base branch SHA
			const baseSha = await getBranchSha(token, owner, repo, baseBranch);

			// Create a new feature branch
			await createBranch(token, owner, repo, branchName, baseSha);

			// Upsert each file
			for (const file of files) {
				const dir = targetDir.replace(/\/$/, '');
				const filePath = dir ? `${dir}/${file.filename}` : file.filename;
				await upsertFile(
					token,
					owner,
					repo,
					filePath,
					file.content,
					branchName,
					`design-tokens: update ${file.filename}`
				);
			}

			// Create PR
			const prBody = description
				? [
						description,
						'',
						`**Files updated:** ${files.map((f) => f.filename).join(', ')}`,
						'',
						'> This PR was created automatically by the Token Sync tool.',
						'> Review the changes and merge when ready.'
					].join('\n')
				: [
						'## Design Token Sync',
						'',
						`Generated by Token Sync on ${new Date().toLocaleString()}.`,
						'',
						`**Platform:** ${platform}`,
						`**Files updated:** ${files.map((f) => f.filename).join(', ')}`,
						'',
						'> This PR was created automatically by the Token Sync tool.',
						'> Review the changes and merge when ready.'
					].join('\n');

			const prUrl = await createPR(
				token,
				owner,
				repo,
				branchName,
				baseBranch,
				`design-tokens: sync ${platform} tokens`,
				prBody
			);

			prs.push({ platform, url: prUrl });
		} catch (e) {
			errors.push(
				`${repoCfg.platform} (${repoCfg.owner}/${repoCfg.repo}): ${e instanceof Error ? e.message : String(e)}`
			);
		}
	}

	if (prs.length === 0 && errors.length > 0) {
		throw error(500, `All PR creations failed:\n${errors.join('\n')}`);
	}

	return json({ prs, errors });
};
