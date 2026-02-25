/**
 * Returns the indices of diff lines whose text contains the search query.
 * Used for in-panel diff search (highlight + scroll to match).
 */
export function searchDiffLines(lines: { text: string }[], query: string): number[] {
	if (!query.trim()) return [];
	const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
	const matches: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		re.lastIndex = 0;
		if (re.test(lines[i].text)) matches.push(i);
	}
	return matches;
}

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
): { html: string; count: number; matchLines: number[] } {
	if (!query.trim()) return { html: escapeHtml(content), count: 0, matchLines: [] };
	let count = 0;
	const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
	const parts: string[] = [];
	const matchLineSet = new Set<number>();
	let lastIdx = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		parts.push(escapeHtml(content.slice(lastIdx, match.index)));
		parts.push(`<mark class="search-mark">${escapeHtml(match[0])}</mark>`);
		lastIdx = match.index + match[0].length;
		count++;
		const lineNum = content.slice(0, match.index).split('\n').length;
		matchLineSet.add(lineNum);
	}
	parts.push(escapeHtml(content.slice(lastIdx)));
	return { html: parts.join(''), count, matchLines: Array.from(matchLineSet) };
}
