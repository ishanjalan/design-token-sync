import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	webhookUrl: z.string().url(),
	platforms: z.array(z.string()),
	stats: z.object({
		primitiveColors: z.number(),
		semanticColors: z.number(),
		spacingSteps: z.number(),
		typographyStyles: z.number()
	}),
	filesCount: z.number(),
	generatedAt: z.string(),
	changelog: z.string().optional()
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

	const { webhookUrl, platforms, stats, filesCount, generatedAt, changelog } = parsed.data;

	const platformStr = platforms.join(' · ');
	const statLines = [
		stats.primitiveColors > 0 ? `${stats.primitiveColors} primitive colors` : null,
		stats.semanticColors > 0 ? `${stats.semanticColors} semantic colors` : null,
		stats.spacingSteps > 0 ? `${stats.spacingSteps} spacing steps` : null,
		stats.typographyStyles > 0 ? `${stats.typographyStyles} text styles` : null
	]
		.filter(Boolean)
		.join(' · ');

	// Google Chat Cards v1 format
	const card = {
		cards: [
			{
				header: {
					title: 'Token Sync — Files Generated',
					subtitle: platformStr,
					imageUrl:
						'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/token/default/24px.svg',
					imageStyle: 'AVATAR'
				},
				sections: [
					{
						widgets: [
							{
								keyValue: {
									topLabel: 'Platforms',
									content: platformStr
								}
							},
							{
								keyValue: {
									topLabel: 'Tokens',
									content: statLines || 'No token stats available'
								}
							},
							{
								keyValue: {
									topLabel: 'Files generated',
									content: String(filesCount)
								}
							},
							{
								keyValue: {
									topLabel: 'Generated at',
									content: new Date(generatedAt).toLocaleString()
								}
							},
							...(changelog
								? [
										{
											textParagraph: {
												text: changelog.slice(0, 1000)
											}
										}
									]
								: [])
						]
					}
				]
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
