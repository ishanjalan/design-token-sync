const urlInput = document.getElementById('url-input') as HTMLInputElement;
const urlStatus = document.getElementById('url-status') as HTMLSpanElement;
const btnSync = document.getElementById('btn-sync') as HTMLButtonElement;
const btnDownload = document.getElementById('btn-download') as HTMLButtonElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const statsEl = document.getElementById('stats') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const timestampEl = document.getElementById('timestamp') as HTMLParagraphElement;
const statCollections = document.getElementById('stat-collections') as HTMLSpanElement;
const statColors = document.getElementById('stat-colors') as HTMLSpanElement;
const statNumbers = document.getElementById('stat-numbers') as HTMLSpanElement;
const statTypography = document.getElementById('stat-typography') as HTMLSpanElement;
const statEffects = document.getElementById('stat-effects') as HTMLSpanElement;
const statGroupTypography = document.getElementById('stat-group-typography') as HTMLDivElement;
const statGroupEffects = document.getElementById('stat-group-effects') as HTMLDivElement;

interface TokenStats {
  collections: number;
  colors: number;
  numbers: number;
  effects?: number;
  typography?: number;
}

interface TokenData {
  lightColors: Record<string, unknown>;
  darkColors: Record<string, unknown>;
  values: Record<string, unknown>;
  typography: Record<string, unknown>;
  stats: TokenStats;
}

let extractedData: TokenData | null = null;
let lastExtractedAt: Date | null = null;

parent.postMessage({ pluginMessage: { type: 'load-url' } }, '*');

// --- URL validation ---

function isValidUrl(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function updateUrlStatus() {
  const val = urlInput.value.trim();
  if (!val) {
    urlInput.classList.remove('url-valid');
    urlStatus.textContent = '';
    return;
  }
  if (isValidUrl(val)) {
    urlInput.classList.add('url-valid');
    urlStatus.textContent = '\u2713';
    urlStatus.style.color = '#16a34a';
  } else {
    urlInput.classList.remove('url-valid');
    urlStatus.textContent = '';
  }
}

urlInput.addEventListener('input', () => {
  parent.postMessage({ pluginMessage: { type: 'save-url', url: urlInput.value } }, '*');
  updateUrlStatus();
  updateButtons();
});

// --- Buttons ---

function updateButtons() {
  const hasUrl = isValidUrl(urlInput.value);
  btnSync.disabled = !hasUrl || !extractedData;
  btnDownload.disabled = !extractedData;
  btnRefresh.disabled = false;
}

// --- Status ---

function setStatus(text: string, level: 'success' | 'error' | 'info') {
  statusEl.textContent = text;
  statusEl.className = `status status--${level}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateTimestamp() {
  if (lastExtractedAt) {
    timestampEl.textContent = 'Extracted at ' + formatTime(lastExtractedAt);
  }
}

// --- Stats ---

function showStats(stats: TokenStats) {
  statCollections.textContent = String(stats.collections);
  statColors.textContent = String(stats.colors);
  statNumbers.textContent = String(stats.numbers);

  const typo = stats.typography || 0;
  if (typo > 0) {
    statTypography.textContent = String(typo);
    statGroupTypography.style.display = 'flex';
  } else {
    statGroupTypography.style.display = 'none';
  }

  const eff = stats.effects || 0;
  if (eff > 0) {
    statEffects.textContent = String(eff);
    statGroupEffects.style.display = 'flex';
  } else {
    statGroupEffects.style.display = 'none';
  }

  statsEl.style.display = 'flex';
}

// --- Re-extract ---

btnRefresh.addEventListener('click', () => {
  btnRefresh.classList.add('spinning');
  btnRefresh.disabled = true;
  setStatus('Re-extracting…', 'info');
  parent.postMessage({ pluginMessage: { type: 'extract' } }, '*');
});

// --- Initial load ---

setStatus('Loading…', 'info');
btnSync.innerHTML = '<span class="spinner"></span> Extracting…';
parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');

// --- Message handler ---

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'url-loaded') {
    if (msg.url) urlInput.value = msg.url;
    updateUrlStatus();
    updateButtons();
  }

  if (msg.type === 'tokens') {
    extractedData = msg.data as TokenData;
    lastExtractedAt = new Date();
    showStats(extractedData.stats);
    updateTimestamp();

    const parts: string[] = [];
    if (extractedData.stats.colors > 0) parts.push(extractedData.stats.colors + ' colors');
    if (extractedData.stats.numbers > 0) parts.push(extractedData.stats.numbers + ' values');
    const typoCount = extractedData.stats.typography || 0;
    if (typoCount > 0) parts.push(typoCount + ' text styles');
    parts.push(extractedData.stats.collections + ' collections');
    setStatus(parts.join(' \u00b7 '), 'success');

    btnSync.innerHTML = '<span class="btn-text">Sync to Tokensmith</span>';
    btnSync.classList.remove('btn-success');
    btnRefresh.classList.remove('spinning');
    updateButtons();
  }

  if (msg.type === 'error') {
    setStatus(msg.message, 'error');
    btnSync.innerHTML = '<span class="btn-text">Sync to Tokensmith</span>';
    btnSync.classList.remove('btn-success');
    btnRefresh.classList.remove('spinning');
    updateButtons();
  }
};

// --- Sync ---

btnSync.addEventListener('click', async () => {
  if (!extractedData) return;

  const baseUrl = urlInput.value.trim().replace(/\/$/, '');
  if (!baseUrl) return;

  btnSync.innerHTML = '<span class="spinner"></span> Syncing…';
  btnSync.disabled = true;
  setStatus('Sending tokens to Tokensmith…', 'info');

  try {
    const res = await fetch(`${baseUrl}/api/figma/plugin-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lightColors: extractedData.lightColors,
        darkColors: extractedData.darkColors,
        values: extractedData.values,
        typography: extractedData.typography,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const CHECK_SVG = '<span class="check-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg></span>';
    btnSync.innerHTML = CHECK_SVG + ' <span class="btn-text">Synced!</span>';
    btnSync.classList.add('btn-success');
    setStatus('Synced at ' + formatTime(new Date()) + ' — open Tokensmith to generate', 'success');

    setTimeout(() => {
      btnSync.innerHTML = '<span class="btn-text">Sync to Tokensmith</span>';
      btnSync.classList.remove('btn-success');
      updateButtons();
    }, 4000);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync';
    setStatus(`Sync failed: ${message}`, 'error');
    btnSync.innerHTML = '<span class="btn-text">Sync to Tokensmith</span>';
    btnSync.classList.remove('btn-success');
    updateButtons();
  }
});

// --- Download ---

btnDownload.addEventListener('click', () => {
  if (!extractedData) return;

  const files: { name: string; data: unknown }[] = [
    { name: 'Light.tokens.json', data: extractedData.lightColors },
    { name: 'Dark.tokens.json', data: extractedData.darkColors },
    { name: 'Value.tokens.json', data: extractedData.values },
  ];

  if (extractedData.typography && Object.keys(extractedData.typography).length > 0) {
    files.push({ name: 'typography.tokens.json', data: extractedData.typography });
  }

  for (const file of files) {
    const blob = new Blob([JSON.stringify(file.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  setStatus(`Downloaded ${files.length} token files`, 'success');
});

updateButtons();
