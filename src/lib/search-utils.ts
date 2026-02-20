function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function buildSearchHighlight(
	content: string,
	query: string
): { html: string; count: number } {
	if (!query.trim()) return { html: escapeHtml(content), count: 0 };
	let count = 0;
	const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
	const parts: string[] = [];
	let lastIdx = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		parts.push(escapeHtml(content.slice(lastIdx, match.index)));
		parts.push(`<mark class="search-mark">${escapeHtml(match[0])}</mark>`);
		lastIdx = match.index + match[0].length;
		count++;
	}
	parts.push(escapeHtml(content.slice(lastIdx)));
	return { html: parts.join(''), count };
}
