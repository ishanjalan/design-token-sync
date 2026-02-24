/**
 * Token Documentation Generator.
 *
 * Produces JSON and/or HTML documentation from token exports:
 * - JSON: flat manifest of every token with name, type, value, aliases, themes
 * - HTML: static single-page site with color swatches, alias chains, theme comparison
 */

import { walkAllTokens } from './resolve-tokens.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenDocEntry {
	name: string;
	type: string;
	value: unknown;
	alias?: string;
	description?: string;
}

export interface DocsOutput {
	jsonOutput: string;
	htmlOutput: string;
}

// ─── Extraction ───────────────────────────────────────────────────────────────

function extractDocEntries(
	tokenExport: Record<string, unknown>
): TokenDocEntry[] {
	const entries: TokenDocEntry[] = [];

	walkAllTokens(tokenExport, (path, token, type) => {
		const name = path.join('/');
		const aliasData = (token.$extensions as Record<string, unknown> | undefined)?.[
			'com.figma.aliasData'
		] as Record<string, unknown> | undefined;
		const alias = aliasData?.targetVariableName as string | undefined;
		const description = (token.$description as string) ?? undefined;

		entries.push({
			name,
			type,
			value: token.$value,
			alias,
			description
		});
	});

	return entries;
}

// ─── JSON Output ──────────────────────────────────────────────────────────────

function generateJson(entries: TokenDocEntry[]): string {
	return JSON.stringify(entries, null, 2);
}

// ─── HTML Output ──────────────────────────────────────────────────────────────

function colorSwatch(value: unknown): string {
	if (!value || typeof value !== 'object') return '';
	const v = value as Record<string, unknown>;
	const hex = v.hex as string | undefined;
	if (!hex) return '';
	return `<span class="swatch" style="background:${hex}" title="${hex}"></span>`;
}

function formatValue(type: string, value: unknown): string {
	if (type === 'color' && value && typeof value === 'object') {
		const v = value as Record<string, unknown>;
		return (v.hex as string) ?? JSON.stringify(value);
	}
	if (type === 'shadow' && value && typeof value === 'object') {
		const v = value as Record<string, unknown>;
		return `${v.offsetX}px ${v.offsetY}px ${v.blur}px ${v.spread}px`;
	}
	if (type === 'border' && value && typeof value === 'object') {
		const v = value as Record<string, unknown>;
		return `${v.width}px ${v.style}`;
	}
	if (typeof value === 'number') return String(value);
	return JSON.stringify(value);
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHtml(entries: TokenDocEntry[]): string {
	const categories = new Map<string, TokenDocEntry[]>();
	for (const entry of entries) {
		const list = categories.get(entry.type) ?? [];
		list.push(entry);
		categories.set(entry.type, list);
	}

	const categoryOrder = ['color', 'number', 'typography', 'shadow', 'border'];
	const sortedTypes = [
		...categoryOrder.filter((t) => categories.has(t)),
		...[...categories.keys()].filter((t) => !categoryOrder.includes(t)).sort()
	];

	let tableRows = '';
	for (const type of sortedTypes) {
		const typeEntries = categories.get(type)!;
		tableRows += `<tr class="category-header"><td colspan="5">${escapeHtml(type)} (${typeEntries.length})</td></tr>\n`;

		for (const entry of typeEntries) {
			const swatchHtml = entry.type === 'color' ? colorSwatch(entry.value) : '';
			const aliasHtml = entry.alias
				? `<span class="alias">→ ${escapeHtml(entry.alias)}</span>`
				: '';
			tableRows += `<tr>
  <td>${swatchHtml} ${escapeHtml(entry.name)}</td>
  <td><code>${escapeHtml(entry.type)}</code></td>
  <td><code>${escapeHtml(formatValue(entry.type, entry.value))}</code></td>
  <td>${aliasHtml}</td>
  <td>${entry.description ? escapeHtml(entry.description) : ''}</td>
</tr>\n`;
		}
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tokensmith — Token Documentation</title>
<style>
  :root { --bg: #fff; --fg: #1d1d1d; --border: #e0e0e0; --header-bg: #f6f6f6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #161b22; --fg: #e6edf3; --border: #30363d; --header-bg: #21262d; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); padding: 2rem; max-width: 1200px; margin: 0 auto; }
  h1 { margin-bottom: .5rem; font-size: 1.5rem; }
  .subtitle { color: #666; margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th, td { padding: .5rem .75rem; text-align: left; border-bottom: 1px solid var(--border); }
  th { background: var(--header-bg); font-weight: 600; position: sticky; top: 0; }
  .category-header td { background: var(--header-bg); font-weight: 600; text-transform: capitalize; }
  .swatch { display: inline-block; width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--border); vertical-align: middle; margin-right: 6px; }
  .alias { color: #0969da; }
  code { font-size: .8125rem; background: var(--header-bg); padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>Tokensmith — Token Documentation</h1>
<p class="subtitle">Generated ${new Date().toISOString()} · ${entries.length} tokens</p>
<table>
<thead><tr><th>Token</th><th>Type</th><th>Value</th><th>Alias</th><th>Description</th></tr></thead>
<tbody>
${tableRows}</tbody>
</table>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateTokenDocs(
	tokenExport: Record<string, unknown>
): DocsOutput {
	const entries = extractDocEntries(tokenExport);
	return {
		jsonOutput: generateJson(entries),
		htmlOutput: generateHtml(entries)
	};
}

export { extractDocEntries };
