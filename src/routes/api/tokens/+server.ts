import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	fetchLatestTokens,
	fetchVersionHistory,
	fetchTokensAtVersion,
	fetchManifestOnly
} from '$lib/server/token-store.js';

export const GET: RequestHandler = async ({ url }) => {
	const mode = url.searchParams.get('mode') ?? 'latest';

	if (mode === 'version') {
		const manifest = await fetchManifestOnly();
		if (!manifest) return json({ available: false });
		return json({ available: true, manifest });
	}

	if (mode === 'versions') {
		const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50);
		const versions = await fetchVersionHistory(limit);
		return json({ versions });
	}

	if (mode === 'at') {
		const sha = url.searchParams.get('sha');
		if (!sha) return json({ available: false, reason: 'missing_sha' });
		const result = await fetchTokensAtVersion(sha);
		return json(result);
	}

	const result = await fetchLatestTokens();
	return json(result);
};
