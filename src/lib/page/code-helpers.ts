import type { DiffLine } from '$lib/diff-utils.js';

export function extractSections(content: string): { label: string; line: number }[] {
	const sections: { label: string; line: number }[] = [];
	const lines = content.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const markMatch = line.match(/\/\/\s*MARK:\s*-?\s*(.+)/);
		if (markMatch) { sections.push({ label: markMatch[1].trim(), line: i + 1 }); continue; }
		const sectionMatch = line.match(/^\/\/\s*(Primitive|Semantic|Light|Dark|Material|Typography|Spacing|CSS custom|SCSS|@property|:root)\b.*$/i);
		if (sectionMatch) { sections.push({ label: line.replace(/^\/\/\s*/, '').slice(0, 50), line: i + 1 }); continue; }
		const objectMatch = line.match(/^(?:object|public extension|public struct|export interface|@mixin)\s+(\S+)/);
		if (objectMatch) sections.push({ label: objectMatch[0].slice(0, 50), line: i + 1 });
	}
	return sections;
}

export function computeFoldRanges(content: string): { start: number; end: number; label: string }[] {
	const sections = extractSections(content);
	const ranges: { start: number; end: number; label: string }[] = [];
	const totalLines = content.split('\n').length;
	for (let i = 0; i < sections.length; i++) {
		const start = sections[i].line;
		const end = i + 1 < sections.length ? sections[i + 1].line - 1 : totalLines;
		ranges.push({ start, end, label: sections[i].label });
	}
	return ranges;
}

export function extractDiffColor(text: string): string | null {
	const m = text.match(/#([0-9a-fA-F]{6,8}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/) ?? text.match(/0x([0-9a-fA-F]{6,8})(?![0-9a-fA-F])/i);
	if (!m) return null;
	const raw = m[1];
	if (raw.length === 3) return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
	if (raw.length === 8 && text.includes('0x')) return `#${raw.slice(2, 8)}`;
	return `#${raw.slice(0, 6)}`;
}

export function computeHunkHeaders(lines: DiffLine[]): Set<number> {
	const hunks = new Set<number>();
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].type === 'equal') continue;
		if (i === 0 || lines[i - 1].type === 'equal') hunks.add(i);
	}
	return hunks;
}

export function nearestContext(lines: DiffLine[], idx: number): string {
	for (let i = idx - 1; i >= 0; i--) {
		const t = lines[i].text.trim();
		if (t.startsWith('//') && t.length > 3) return t;
		if (/^(export|object|public |@mixin|:root|\$\w)/.test(t)) return t.slice(0, 60);
	}
	return '';
}
