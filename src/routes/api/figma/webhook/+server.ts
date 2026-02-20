import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface FigmaWebhookEvent {
	event_type: string;
	file_key: string;
	file_name: string;
	timestamp: string;
	receivedAt: string;
}

let latestEvent: FigmaWebhookEvent | null = null;

export const POST: RequestHandler = async ({ request, url }) => {
	const passcode = url.searchParams.get('passcode');
	if (!passcode) {
		throw error(401, 'Missing passcode query parameter');
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const eventType = String(body.event_type ?? '');
	if (!eventType) {
		throw error(422, 'Missing event_type in payload');
	}

	latestEvent = {
		event_type: eventType,
		file_key: String(body.file_key ?? ''),
		file_name: String(body.file_name ?? body.file_key ?? 'Unknown'),
		timestamp: String(body.timestamp ?? new Date().toISOString()),
		receivedAt: new Date().toISOString()
	};

	return json({ ok: true });
};

export const GET: RequestHandler = async ({ url }) => {
	const passcode = url.searchParams.get('passcode');
	if (!passcode) {
		throw error(401, 'Missing passcode query parameter');
	}
	return json({ event: latestEvent });
};
