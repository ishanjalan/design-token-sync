import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const TokenMapSchema = z.record(z.string(), z.any());

const PluginSyncSchema = z.object({
	lightColors: TokenMapSchema,
	darkColors: TokenMapSchema,
	values: TokenMapSchema,
	typography: TokenMapSchema.optional().default({})
});

type PluginSyncData = z.infer<typeof PluginSyncSchema> & { receivedAt: string };

let latestSync: PluginSyncData | null = null;

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const parsed = PluginSyncSchema.safeParse(body);
	if (!parsed.success) {
		throw error(422, `Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}

	latestSync = {
		...parsed.data,
		receivedAt: new Date().toISOString()
	};

	return json(
		{
			success: true,
			receivedAt: latestSync.receivedAt
		},
		{
			headers: { 'Access-Control-Allow-Origin': '*' }
		}
	);
};

export const GET: RequestHandler = async () => {
	if (!latestSync) {
		return json(
			{ available: false },
			{ headers: { 'Access-Control-Allow-Origin': '*' } }
		);
	}

	return json(
		{
			available: true,
			receivedAt: latestSync.receivedAt,
			lightColors: latestSync.lightColors,
			darkColors: latestSync.darkColors,
			values: latestSync.values,
			typography: latestSync.typography
		},
		{
			headers: { 'Access-Control-Allow-Origin': '*' }
		}
	);
};
