import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { fetchVariables, transformFigmaResponse } from '$lib/figma-api.js';
import type { RequestHandler } from './$types';

const RequestSchema = z.object({
	fileKey: z.string().min(1),
	pat: z.string().min(1)
});

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success) {
		throw error(422, `Invalid request: ${parsed.error.message}`);
	}

	const { fileKey, pat } = parsed.data;

	try {
		const response = await fetchVariables(fileKey, pat);
		const normalized = transformFigmaResponse(response);

		return json({
			success: true,
			lightColors: normalized.lightColors,
			darkColors: normalized.darkColors,
			values: normalized.values,
			typography: normalized.typography
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown Figma API error';
		throw error(502, message);
	}
};
