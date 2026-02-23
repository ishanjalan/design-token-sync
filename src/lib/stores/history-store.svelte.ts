import type { HistoryEntry } from '$lib/types.js';
import { loadHistory, saveToHistory } from '$lib/storage.js';
import { browser } from '$app/environment';

class HistoryStoreClass {
	history = $state<HistoryEntry[]>([]);

	init() {
		this.history = loadHistory();
	}

	addEntry(entry: HistoryEntry) {
		saveToHistory(entry);
		this.history = loadHistory();
	}

	storePrUrls(urls: string[]) {
		if (!urls.length) return;
		const all = loadHistory();
		if (all.length > 0) {
			all[0].prUrls = [...(all[0].prUrls ?? []), ...urls];
			if (browser) localStorage.setItem('tokensmith:history', JSON.stringify(all));
			this.history = all;
		}
	}
}

export const historyStore = new HistoryStoreClass();
