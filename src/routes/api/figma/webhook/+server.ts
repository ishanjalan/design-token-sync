import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

interface FigmaWebhookEvent {
	event_type: string;
	file_key: string;
	file_name: string;
	timestamp: string;
	receivedAt: string;
}

// In-memory cache — populated from disk on first read
let memoryEvent: FigmaWebhookEvent | null = null;
let loaded = false;

const STATE_PATH = join(process.cwd(), '.webhook-state.json');

function loadFromDisk(): FigmaWebhookEvent | null {
	try {
		const raw = readFileSync(STATE_PATH, 'utf-8');
		return JSON.parse(raw) as FigmaWebhookEvent;
	} catch {
		return null;
	}
}

function saveToDisk(event: FigmaWebhookEvent): void {
	try {
		mkdirSync(join(process.cwd()), { recursive: true });
		writeFileSync(STATE_PATH, JSON.stringify(event, null, 2), 'utf-8');
	} catch {
		// Non-fatal: memory cache still works for the current process lifetime
	}
}

function getLatestEvent(): FigmaWebhookEvent | null {
	if (!loaded) {
		memoryEvent = loadFromDisk();
		loaded = true;
	}
	return memoryEvent;
}

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

	const event: FigmaWebhookEvent = {
		event_type: eventType,
		file_key: String(body.file_key ?? ''),
		file_name: String(body.file_name ?? body.file_key ?? 'Unknown'),
		timestamp: String(body.timestamp ?? new Date().toISOString()),
		receivedAt: new Date().toISOString()
	};

	memoryEvent = event;
	loaded = true;
	saveToDisk(event);

	return json({ ok: true });
};

export const GET: RequestHandler = async ({ url }) => {
	const passcode = url.searchParams.get('passcode');
	if (!passcode) {
		throw error(401, 'Missing passcode query parameter');
	}
	return json({ event: getLatestEvent() });
};
