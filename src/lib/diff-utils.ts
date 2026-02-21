import type { GeneratedFile, Platform } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiffLine = {
	type: 'add' | 'remove' | 'equal';
	text: string;
	spans?: { text: string; changed: boolean }[];
	oldLineNum?: number;
	newLineNum?: number;
};

export type ViewMode = 'code' | 'diff' | 'changes';

export interface DiffSummary {
	added: number;
	removed: number;
	unchanged: number;
	modified: number;
}

export interface TokenModification {
	name: string;
	oldValue: string;
	newValue: string;
}

export interface RenameEntry {
	oldName: string;
	newName: string;
	value: string;
}

export interface FamilyRename {
	oldPrefix: string;
	newPrefix: string;
	count: number;
	members: { oldName: string; newName: string }[];
}

export interface TokenCoverageResult {
	total: number;
	covered: number;
	orphaned: string[];
	unimplemented: string[];
	coveragePercent: number;
}

export interface PlatformMismatch {
	tokenName: string;
	values: { platform: string; rawValue: string; normalizedHex: string }[];
}

export interface ImpactEntry {
	primitiveName: string;
	changeType: string;
	affectedSemantics: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_VALUE_PATTERNS = [
	/\$([\w-]+)\s*:\s*(.+?)\s*;/,
	/--([\w-]+)\s*:\s*(.+?)\s*;/,
	/export\s+const\s+(\w+)\s*=\s*['"]?(.+?)['"]?\s*;?\s*$/,
	/static\s+let\s+(\w+)\s*=\s*(.+)/,
	/\bval\s+(\w+)\s*=\s*(.+)/
];

export const TOKEN_PATTERNS = [
	/\$([a-zA-Z][\w-]+)\s*:/,
	/--([a-zA-Z][\w-]+)\s*:/,
	/export\s+const\s+(\w+)/,
	/static\s+let\s+(\w+)/,
	/\bval\s+(\w+)/
];

// ─── Token Extraction ─────────────────────────────────────────────────────────

export function extractTokenNameValue(line: string): { name: string; value: string } | null {
	for (const pat of TOKEN_VALUE_PATTERNS) {
		const m = line.match(pat);
		if (m) return { name: m[1], value: m[2].trim() };
	}
	return null;
}

export function extractTokenNames(lines: DiffLine[], type: 'add' | 'remove'): Set<string> {
	const names = new Set<string>();
	for (const line of lines) {
		if (line.type !== type) continue;
		for (const pat of TOKEN_PATTERNS) {
			const m = line.text.match(pat);
			if (m) {
				names.add(m[1]);
				break;
			}
		}
	}
	return names;
}

// ─── Diff Computation Helpers ─────────────────────────────────────────────────

export function enrichWordDiffs(
	lines: DiffLine[],
	diffWordsFn: typeof import('diff').diffWords
): void {
	const removes: number[] = [];
	const adds: number[] = [];
	function processPairs() {
		const pairCount = Math.min(removes.length, adds.length);
		for (let p = 0; p < pairCount; p++) {
			const ri = removes[p],
				ai = adds[p];
			const wordChanges = diffWordsFn(lines[ri].text, lines[ai].text);
			const removeSpans: { text: string; changed: boolean }[] = [];
			const addSpans: { text: string; changed: boolean }[] = [];
			for (const wc of wordChanges) {
				if (wc.added) addSpans.push({ text: wc.value, changed: true });
				else if (wc.removed) removeSpans.push({ text: wc.value, changed: true });
				else {
					removeSpans.push({ text: wc.value, changed: false });
					addSpans.push({ text: wc.value, changed: false });
				}
			}
			if (removeSpans.some((s) => s.changed)) lines[ri].spans = removeSpans;
			if (addSpans.some((s) => s.changed)) lines[ai].spans = addSpans;
		}
		removes.length = 0;
		adds.length = 0;
	}
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].type === 'remove') {
			if (adds.length > 0) {
				processPairs();
			}
			removes.push(i);
		} else if (lines[i].type === 'add') {
			adds.push(i);
		} else {
			processPairs();
		}
	}
	processPairs();
}

export function diffStats(lines: DiffLine[], mods?: TokenModification[]): DiffSummary {
	return {
		added: lines.filter((l) => l.type === 'add').length,
		removed: lines.filter((l) => l.type === 'remove').length,
		unchanged: lines.filter((l) => l.type === 'equal').length,
		modified: mods?.length ?? 0
	};
}

// ─── Blame Map ────────────────────────────────────────────────────────────────

export type BlameStatus = 'new' | 'modified' | 'unchanged';

/**
 * Map diff lines to a per-line blame status for the generated (new) file.
 * Returns an array indexed by 0-based line number.
 */
export function computeBlameMap(lines: DiffLine[]): BlameStatus[] {
	const blame: BlameStatus[] = [];
	for (const line of lines) {
		if (line.type === 'remove') continue;
		if (line.type === 'equal') {
			blame.push('unchanged');
		} else {
			blame.push(line.spans?.some((s) => s.changed) ? 'modified' : 'new');
		}
	}
	return blame;
}

// ─── Diff Analysis ────────────────────────────────────────────────────────────

export function extractModifiedTokens(
	allDiffs: Record<string, DiffLine[]>
): Record<string, TokenModification[]> {
	const result: Record<string, TokenModification[]> = {};
	for (const [filename, lines] of Object.entries(allDiffs)) {
		const removedMap = new Map<string, string>();
		const addedMap = new Map<string, string>();
		for (const line of lines) {
			const nv = extractTokenNameValue(line.text);
			if (!nv) continue;
			if (line.type === 'remove') removedMap.set(nv.name, nv.value);
			else if (line.type === 'add') addedMap.set(nv.name, nv.value);
		}
		const mods: TokenModification[] = [];
		for (const [name, oldVal] of removedMap) {
			const newVal = addedMap.get(name);
			if (newVal && newVal !== oldVal) {
				mods.push({ name, oldValue: oldVal, newValue: newVal });
			}
		}
		if (mods.length) result[filename] = mods;
	}
	return result;
}

function extractAddedTokens(allDiffs: Record<string, DiffLine[]>): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	for (const [filename, lines] of Object.entries(allDiffs)) {
		const addedNames = extractTokenNames(lines, 'add');
		const removedNames = extractTokenNames(lines, 'remove');
		const genuinelyNew = [...addedNames].filter((n) => !removedNames.has(n));
		if (genuinelyNew.length) result[filename] = genuinelyNew;
	}
	return result;
}

export function extractDeprecations(
	allDiffs: Record<string, DiffLine[]>
): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	for (const [filename, lines] of Object.entries(allDiffs)) {
		const removedNames = extractTokenNames(lines, 'remove');
		const addedNames = extractTokenNames(lines, 'add');
		const genuinelyRemoved = [...removedNames].filter((n) => !addedNames.has(n));
		if (genuinelyRemoved.length) result[filename] = genuinelyRemoved;
	}
	return result;
}

// ─── Diff Navigation & Filtering ──────────────────────────────────────────────

export function diffChangeIndices(lines: DiffLine[]): number[] {
	if (!lines) return [];
	const indices: number[] = [];
	let inChunk = false;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].type !== 'equal') {
			if (!inChunk) {
				indices.push(i);
				inChunk = true;
			}
		} else {
			inChunk = false;
		}
	}
	return indices;
}

export function filterDiffLines(
	lines: DiffLine[],
	context: number = 3
): (DiffLine | { type: 'separator' })[] {
	const visible = new Set<number>();
	lines.forEach((l, i) => {
		if (l.type !== 'equal') {
			for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
				visible.add(j);
			}
		}
	});
	const out: (DiffLine | { type: 'separator' })[] = [];
	let lastIdx = -1;
	for (const idx of [...visible].sort((a, b) => a - b)) {
		if (lastIdx >= 0 && idx > lastIdx + 1) out.push({ type: 'separator' });
		out.push(lines[idx]);
		lastIdx = idx;
	}
	return out;
}

// ─── Changelog Generation ─────────────────────────────────────────────────────

export interface ChangelogContext {
	files: GeneratedFile[];
	platforms: Platform[];
	platformLabels: { id: Platform; label: string; sublabel: string }[];
	diffs: Record<string, DiffLine[]>;
	deprecations: Record<string, string[]>;
	modifications: Record<string, TokenModification[]>;
	renames: Record<string, RenameEntry[]>;
	familyRenames: Record<string, FamilyRename[]>;
	tokenCoverage: Record<string, TokenCoverageResult>;
	platformMismatches: PlatformMismatch[];
	impactedTokens: ImpactEntry[];
}

export function generateChangelog(ctx: ChangelogContext): string {
	if (!ctx.files.length) return '';
	const date = new Date().toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
	const platform = ctx.platforms
		.map((p) => {
			const plat = ctx.platformLabels.find((pp) => pp.id === p);
			return plat ? `${plat.label} (${plat.sublabel})` : p;
		})
		.join(', ');
	const lines: string[] = [`## Tokensmith — ${date}`, '', `**Platform:** ${platform}`, ''];
	const hasDiffs = Object.keys(ctx.diffs).length > 0;
	if (hasDiffs) {
		lines.push('### Changes');
		for (const file of ctx.files) {
			const d = ctx.diffs[file.filename];
			if (d) {
				const s = diffStats(d);
				lines.push(
					`- ${file.filename}: +${s.added} added, -${s.removed} removed, ${s.unchanged} unchanged`
				);
			} else {
				lines.push(`- ${file.filename}: new file (${file.content.split('\n').length} lines)`);
			}
		}
		lines.push('');
	}
	const addedTokens = extractAddedTokens(ctx.diffs);
	const allAdded = Object.entries(addedTokens);
	if (allAdded.length) {
		lines.push('### New tokens');
		for (const [fn, tokens] of allAdded) {
			for (const t of tokens.slice(0, 10)) lines.push(`- \`${t}\` (${fn})`);
			if (tokens.length > 10) lines.push(`- … +${tokens.length - 10} more (${fn})`);
		}
		lines.push('');
	}
	const allRemoved = Object.entries(ctx.deprecations);
	if (allRemoved.length) {
		lines.push('### Removed tokens');
		for (const [fn, tokens] of allRemoved) {
			for (const t of tokens.slice(0, 10)) lines.push(`- \`${t}\` (${fn})`);
			if (tokens.length > 10) lines.push(`- … +${tokens.length - 10} more (${fn})`);
		}
		lines.push('');
	}
	const allMods = Object.entries(ctx.modifications);
	if (allMods.length) {
		lines.push('### Modified tokens');
		for (const [fn, mods] of allMods) {
			for (const m of mods.slice(0, 10))
				lines.push(`- \`${m.name}\`: ${m.oldValue} → ${m.newValue} (${fn})`);
			if (mods.length > 10) lines.push(`- … +${mods.length - 10} more (${fn})`);
		}
		lines.push('');
	}
	const allRenames = Object.entries(ctx.renames);
	if (allRenames.length) {
		const allFamilyRenames = Object.entries(ctx.familyRenames);
		if (allFamilyRenames.some(([, frs]) => frs.length > 0)) {
			lines.push('### Family renames');
			for (const [fn, frs] of allFamilyRenames) {
				for (const fr of frs)
					lines.push(`- ${fr.oldPrefix} → ${fr.newPrefix} (${fr.count} tokens) (${fn})`);
			}
			lines.push('');
		}
		const familyGrouped = new Set(
			Object.values(ctx.familyRenames).flatMap((frs) =>
				frs.flatMap((fr) => fr.members.map((m) => m.oldName))
			)
		);
		const indivRenames = allRenames.flatMap(([fn, rs]) =>
			rs.filter((r) => !familyGrouped.has(r.oldName)).map((r) => ({ ...r, fn }))
		);
		if (indivRenames.length) {
			lines.push('### Possible renames');
			for (const r of indivRenames.slice(0, 10))
				lines.push(`- \`${r.oldName}\` → \`${r.newName}\` (${r.fn})`);
			if (indivRenames.length > 10) lines.push(`- … +${indivRenames.length - 10} more`);
			lines.push('');
		}
	}
	const allCoverage = Object.entries(ctx.tokenCoverage);
	if (allCoverage.length) {
		lines.push('### Token coverage');
		for (const [fn, cov] of allCoverage) {
			lines.push(
				`- ${fn}: ${cov.covered}/${cov.total} (${cov.coveragePercent.toFixed(1)}%)${cov.orphaned.length ? ` · ${cov.orphaned.length} orphaned` : ''}${cov.unimplemented.length ? ` · ${cov.unimplemented.length} unimplemented` : ''}`
			);
		}
		lines.push('');
	}
	if (ctx.platformMismatches.length) {
		lines.push('### Cross-platform mismatches');
		for (const mm of ctx.platformMismatches.slice(0, 10)) {
			lines.push(
				`- \`${mm.tokenName}\`: ${mm.values.map((v) => `${v.platform}=${v.normalizedHex}`).join(', ')}`
			);
		}
		if (ctx.platformMismatches.length > 10)
			lines.push(`- … +${ctx.platformMismatches.length - 10} more`);
		lines.push('');
	}
	if (ctx.impactedTokens.length) {
		lines.push('### Impact analysis');
		for (const it of ctx.impactedTokens
			.filter((i) => i.affectedSemantics.length > 0)
			.slice(0, 10)) {
			lines.push(
				`- \`${it.primitiveName}\` (${it.changeType}) → ${it.affectedSemantics.length} semantic tokens`
			);
		}
		lines.push('');
	}
	return lines.join('\n');
}
