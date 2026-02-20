import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const startedAt = Date.now();

export const GET: RequestHandler = async () => {
	return json({
		status: 'ok',
		version: '0.0.1',
		uptime: Math.floor((Date.now() - startedAt) / 1000)
	});
};
