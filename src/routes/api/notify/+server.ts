import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	webhookUrl: z.string().url().optional(),
	platforms: z.array(z.string()),
	version: z.number().optional(),
	tokenChanges: z
		.object({
			added: z.number(),
			removed: z.number(),
			summary: z.string()
		})
		.optional(),
	stats: z
		.object({
			primitiveColors: z.number(),
			semanticColors: z.number(),
			spacingSteps: z.number(),
			typographyStyles: z.number()
		})
		.optional(),
	generatedAt: z.string()
});

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

	const webhookUrl = parsed.data.webhookUrl || env.GOOGLE_CHAT_WEBHOOK_URL;
	if (!webhookUrl) {
		throw error(422, 'No webhook URL configured (set GOOGLE_CHAT_WEBHOOK_URL or pass webhookUrl)');
	}

	const { platforms, version, tokenChanges, stats, generatedAt } = parsed.data;

	const platformStr = platforms.join(' · ');
	const title = version
		? `Tokensmith — Design System Updated (v${version})`
		: 'Tokensmith — Design System Updated';

	const widgets: Record<string, unknown>[] = [
		{ keyValue: { topLabel: 'Platforms', content: platformStr } }
	];

	if (tokenChanges) {
		const parts: string[] = [];
		if (tokenChanges.added > 0) parts.push(`+${tokenChanges.added} added`);
		if (tokenChanges.removed > 0) parts.push(`-${tokenChanges.removed} removed`);
		widgets.push({ keyValue: { topLabel: 'Token changes', content: parts.join(', ') || 'Updated' } });
	}

	if (stats) {
		const statLines = [
			stats.primitiveColors > 0 ? `${stats.primitiveColors} primitive colors` : null,
			stats.semanticColors > 0 ? `${stats.semanticColors} semantic colors` : null,
			stats.spacingSteps > 0 ? `${stats.spacingSteps} spacing steps` : null,
			stats.typographyStyles > 0 ? `${stats.typographyStyles} text styles` : null
		]
			.filter(Boolean)
			.join(' · ');
		if (statLines) widgets.push({ keyValue: { topLabel: 'Tokens', content: statLines } });
	}

	widgets.push({
		keyValue: { topLabel: 'Updated at', content: new Date(generatedAt).toLocaleString() }
	});

	const card = {
		cards: [
			{
				header: {
					title,
					subtitle: platformStr,
					imageUrl:
						'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/token/default/24px.svg',
					imageStyle: 'AVATAR'
				},
				sections: [{ widgets }]
			}
		]
	};

	try {
		const res = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(card)
		});

		if (!res.ok) {
			const text = await res.text();
			throw error(502, `Google Chat webhook returned ${res.status}: ${text}`);
		}
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(
			502,
			`Failed to reach Google Chat webhook: ${e instanceof Error ? e.message : String(e)}`
		);
	}

	return json({ success: true });
};
