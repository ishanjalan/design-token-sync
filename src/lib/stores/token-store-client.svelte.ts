import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import type { DropZoneKey } from '$lib/types.js';
import { fileStore } from './file-store.svelte.js';
import { validateFigmaJson, computeInsight } from '$lib/file-validation.js';

class TokenStoreClientClass {
	storedTokenVersion = $state<number | null>(null);
	storedTokenPushedAt = $state<string | null>(null);
	storedTokenVersions = $state<
		Array<{ sha: string; version: number; pushedAt: string; message: string }>
	>([]);
	storedTokensLoading = $state(false);
	tokensAutoLoaded = $state(false);
	tokenChangeSummary = $state<string | null>(null);
	tokensUpdatedBanner = $state<{ version: number; summary: string } | null>(null);
	previousTokenKeys = $state<Record<string, Set<string>>>({});
	pluginSyncAvailable = $state(false);
	pluginSyncReceivedAt = $state('');
	pluginAutoLoad = $state(true);

	computeTokenKeys(data: Record<string, unknown>): Record<string, Set<string>> {
		const result: Record<string, Set<string>> = {};
		for (const category of ['lightColors', 'darkColors', 'values', 'typography'] as const) {
			const obj = data[category];
			if (obj && typeof obj === 'object') {
				result[category] = new Set(Object.keys(obj as Record<string, unknown>));
			}
		}
		return result;
	}

	computeChangeSummary(
		oldKeys: Record<string, Set<string>>,
		newKeys: Record<string, Set<string>>
	): string | null {
		if (Object.keys(oldKeys).length === 0) return null;
		let added = 0,
			removed = 0;
		const categories: string[] = [];
		for (const cat of Object.keys(newKeys)) {
			const prev = oldKeys[cat] ?? new Set();
			const curr = newKeys[cat];
			for (const k of curr) {
				if (!prev.has(k)) added++;
			}
			for (const k of prev) {
				if (!curr.has(k)) removed++;
			}
			if (added > 0 || removed > 0) categories.push(cat.replace('Colors', ''));
		}
		if (added === 0 && removed === 0) return 'No key changes';
		const parts: string[] = [];
		if (added > 0) parts.push(`+${added} added`);
		if (removed > 0) parts.push(`-${removed} removed`);
		return parts.join(', ');
	}

	buildSlotEntries(
		data: Record<string, unknown>
	): { key: DropZoneKey; content: string; name: string }[] {
		const entries: { key: DropZoneKey; content: string; name: string }[] = [
			{
				key: 'lightColors',
				content: JSON.stringify(data.lightColors, null, 2),
				name: 'Light.tokens.json'
			},
			{
				key: 'darkColors',
				content: JSON.stringify(data.darkColors, null, 2),
				name: 'Dark.tokens.json'
			},
			{
				key: 'values',
				content: JSON.stringify(data.values, null, 2),
				name: 'Value.tokens.json'
			}
		];
		if (
			data.typography &&
			typeof data.typography === 'object' &&
			Object.keys(data.typography as object).length > 0
		) {
			entries.push({
				key: 'typography',
				content: JSON.stringify(data.typography, null, 2),
				name: 'typography.tokens.json'
			});
		}
		return entries;
	}

	buildPluginSlotEntries(
		data: Record<string, unknown>
	): { key: DropZoneKey; content: string; name: string }[] {
		const entries: { key: DropZoneKey; content: string; name: string }[] = [
			{
				key: 'lightColors',
				content: JSON.stringify(data.lightColors, null, 2),
				name: 'Light.tokens.json'
			},
			{
				key: 'darkColors',
				content: JSON.stringify(data.darkColors, null, 2),
				name: 'Dark.tokens.json'
			},
			{
				key: 'values',
				content: JSON.stringify(data.values, null, 2),
				name: 'Value.tokens.json'
			}
		];
		if (
			data.typography &&
			typeof data.typography === 'object' &&
			Object.keys(data.typography as object).length > 0
		) {
			entries.push({
				key: 'typography',
				content: JSON.stringify({ typography: data.typography }, null, 2),
				name: 'typography.tokens.json'
			});
		}
		return entries;
	}

	async loadStoredTokens(): Promise<boolean> {
		try {
			const res = await fetch('/api/tokens');
			if (!res.ok) return false;
			const data = await res.json();
			if (!data.available) return false;
			const prevVersion = this.storedTokenVersion;
			this.storedTokenVersion = data.manifest?.version ?? null;
			this.storedTokenPushedAt = data.manifest?.pushedAt ?? null;
			const newKeys = this.computeTokenKeys(data);
			if (prevVersion !== null && this.storedTokenVersion !== prevVersion) {
				this.tokenChangeSummary = this.computeChangeSummary(this.previousTokenKeys, newKeys);
			}
			this.previousTokenKeys = newKeys;
			const requiredEmpty =
				!fileStore.slots.lightColors.file &&
				!fileStore.slots.darkColors.file &&
				!fileStore.slots.values.file;
			if (!requiredEmpty) return false;
			fileStore.applyTokenData(this.buildSlotEntries(data));
			this.tokensAutoLoaded = true;
			toast.success(`Loaded design tokens v${this.storedTokenVersion}`);
			return true;
		} catch {
			return false;
		}
	}

	async loadStoredVersions() {
		try {
			const res = await fetch('/api/tokens?mode=versions&limit=10');
			if (!res.ok) return;
			const data = await res.json();
			this.storedTokenVersions = data.versions ?? [];
		} catch {
			/* silent */
		}
	}

	async loadTokenVersion(sha: string) {
		this.storedTokensLoading = true;
		try {
			const res = await fetch(`/api/tokens?mode=at&sha=${sha}`);
			if (!res.ok) throw new Error('Failed to fetch version');
			const data = await res.json();
			if (!data.available) {
				toast.error('Version not found');
				return;
			}
			this.storedTokenVersion = data.manifest?.version ?? null;
			this.storedTokenPushedAt = data.manifest?.pushedAt ?? null;
			fileStore.applyTokenData(this.buildSlotEntries(data));
			toast.success(`Loaded design tokens v${this.storedTokenVersion}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load version');
		} finally {
			this.storedTokensLoading = false;
		}
	}

	async refreshStoredTokens() {
		this.storedTokensLoading = true;
		try {
			const res = await fetch('/api/tokens');
			if (!res.ok) return;
			const data = await res.json();
			if (!data.available) {
				toast.error('No stored tokens available');
				return;
			}
			const prevVersion = this.storedTokenVersion;
			this.storedTokenVersion = data.manifest?.version ?? null;
			this.storedTokenPushedAt = data.manifest?.pushedAt ?? null;
			const newKeys = this.computeTokenKeys(data);
			if (prevVersion !== null && this.storedTokenVersion !== prevVersion) {
				const summary = this.computeChangeSummary(this.previousTokenKeys, newKeys);
				this.tokenChangeSummary = summary;
				if (genStoreRef()) {
					this.tokensUpdatedBanner = {
						version: this.storedTokenVersion ?? 0,
						summary: summary ?? ''
					};
				}
			}
			this.previousTokenKeys = newKeys;
			fileStore.applyTokenData(this.buildSlotEntries(data));
			await this.loadStoredVersions();
			toast.success(`Refreshed to v${this.storedTokenVersion}`);
		} catch {
			toast.error('Failed to refresh tokens');
		} finally {
			this.storedTokensLoading = false;
		}
	}

	async pollTokenVersion(onNewVersion?: (change: { version: number; added: number; removed: number; summary: string }) => void) {
		try {
			const res = await fetch('/api/tokens?mode=version');
			if (!res.ok) return;
			const data = await res.json();
			if (!data.available) return;
			const remoteVersion = data.manifest?.version ?? null;
			if (remoteVersion === null || remoteVersion === this.storedTokenVersion) return;
			this.storedTokensLoading = true;
			const fullRes = await fetch('/api/tokens');
			if (!fullRes.ok) return;
			const fullData = await fullRes.json();
			if (!fullData.available) return;
			const prevVersion = this.storedTokenVersion;
			this.storedTokenVersion = fullData.manifest?.version ?? null;
			this.storedTokenPushedAt = fullData.manifest?.pushedAt ?? null;
			const newKeys = this.computeTokenKeys(fullData);
			let added = 0, removed = 0;
			let summary = '';
			if (prevVersion !== null && this.storedTokenVersion !== prevVersion) {
				for (const cat of Object.keys(newKeys)) {
					const prev = this.previousTokenKeys[cat] ?? new Set<string>();
					const curr = newKeys[cat];
					for (const k of curr) { if (!prev.has(k)) added++; }
					for (const k of prev) { if (!curr.has(k)) removed++; }
				}
				summary = this.computeChangeSummary(this.previousTokenKeys, newKeys) ?? '';
				this.tokenChangeSummary = summary;
				this.tokensUpdatedBanner = { version: this.storedTokenVersion ?? 0, summary };
			}
			this.previousTokenKeys = newKeys;
			fileStore.applyTokenData(this.buildSlotEntries(fullData));
			await this.loadStoredVersions();
			toast.success(`New tokens detected — v${this.storedTokenVersion}`);
			if (added > 0 || removed > 0) {
				onNewVersion?.({ version: this.storedTokenVersion ?? 0, added, removed, summary });
			}
		} catch { /* silent */ }
		finally { this.storedTokensLoading = false; }
	}

	async checkPluginSync(onAutoApply?: () => void) {
		try {
			const res = await fetch('/api/figma/plugin-sync');
			if (!res.ok) return;
			const data = await res.json();
			if (data.available && data.receivedAt !== this.pluginSyncReceivedAt) {
				this.pluginSyncReceivedAt = data.receivedAt;
				if (this.pluginAutoLoad) {
					await this.applyPluginData(data);
					onAutoApply?.();
				} else {
					this.pluginSyncAvailable = true;
				}
			}
		} catch {
			/* silent */
		}
	}

	async applyPluginData(data: Record<string, unknown>) {
		fileStore.applyTokenData(this.buildPluginSlotEntries(data));
		this.pluginSyncAvailable = false;
		toast.success('Loaded tokens from Figma plugin');
	}

	async loadPluginSync() {
		try {
			const res = await fetch('/api/figma/plugin-sync');
			if (!res.ok) return;
			const data = await res.json();
			if (!data.available) {
				toast.error('No plugin data available');
				return;
			}
			await this.applyPluginData(data);
		} catch (err) {
			toast.error(
				`Failed to load plugin data: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
		}
	}
}

let genStoreRef: () => unknown = () => null;
export function setGenStoreRef(fn: () => unknown) {
	genStoreRef = fn;
}

export const tokenStore = new TokenStoreClientClass();
