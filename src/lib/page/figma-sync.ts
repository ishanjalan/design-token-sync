import type { DropZoneKey } from '$lib/types.js';

interface FigmaSettings {
	figmaFileKey: string;
	figmaPat: string;
	figmaFetching: boolean;
	figmaWebhookPasscode: string;
	figmaWebhookEvent: { file_name: string; timestamp: string; receivedAt: string } | null;
	figmaWebhookSeen: boolean;
	chatWebhookUrl: string;
}

export async function onFigmaFetch(
	settings: FigmaSettings,
	applyTokenData: (entries: { key: DropZoneKey; content: string; name: string }[]) => void,
	toast: { success: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
	if (!settings.figmaFileKey || !settings.figmaPat || settings.figmaFetching) return;
	settings.figmaFetching = true;
	try {
		const res = await fetch('/api/figma/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileKey: settings.figmaFileKey, pat: settings.figmaPat }) });
		if (!res.ok) { toast.error(`Figma API error: ${await res.text()}`); return; }
		const data = await res.json();
		const entries: { key: DropZoneKey; content: string; name: string }[] = [
			{ key: 'lightColors', content: JSON.stringify(data.lightColors, null, 2), name: 'Light.tokens.json' },
			{ key: 'darkColors', content: JSON.stringify(data.darkColors, null, 2), name: 'Dark.tokens.json' },
			{ key: 'values', content: JSON.stringify(data.values, null, 2), name: 'Value.tokens.json' }
		];
		if (data.typography && Object.keys(data.typography).length > 0) entries.push({ key: 'typography', content: JSON.stringify(data.typography, null, 2), name: 'typography.tokens.json' });
		applyTokenData(entries);
		toast.success('Fetched tokens from Figma');
	} catch (err) {
		toast.error(`Failed to fetch from Figma: ${err instanceof Error ? err.message : 'Unknown error'}`);
	} finally {
		settings.figmaFetching = false;
	}
}

export async function pollFigmaWebhook(settings: FigmaSettings): Promise<void> {
	if (!settings.figmaWebhookPasscode) return;
	try {
		const res = await fetch(`/api/figma/webhook?passcode=${encodeURIComponent(settings.figmaWebhookPasscode)}`);
		if (res.ok) {
			const data: { event: { file_name: string; timestamp: string; receivedAt: string } | null } = await res.json();
			if (data.event && data.event.receivedAt !== settings.figmaWebhookEvent?.receivedAt) {
				settings.figmaWebhookEvent = data.event;
				settings.figmaWebhookSeen = false;
			}
		}
	} catch { /* silent */ }
}

export async function notifyTokenUpdate(
	change: { version: number; added: number; removed: number; summary: string },
	selectedPlatforms: string[],
	chatWebhookUrl: string | null,
	toast: { success: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
	try {
		const payload: Record<string, unknown> = {
			platforms: selectedPlatforms,
			version: change.version,
			tokenChanges: { added: change.added, removed: change.removed, summary: change.summary },
			generatedAt: new Date().toISOString()
		};
		if (chatWebhookUrl) payload.webhookUrl = chatWebhookUrl;
		const r = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		if (!r.ok) { const text = await r.text(); toast.error(`Google Chat: ${text}`); }
		else toast.success('Google Chat notified');
	} catch {
		toast.error('Google Chat notification failed');
	}
}
