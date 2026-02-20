import { parse, formatHex } from 'culori';
import type { GeneratedFile } from './types.js';
import {
	extractTokenNameValue,
	TOKEN_PATTERNS,
	type DiffLine,
	type TokenModification,
	type RenameEntry,
	type FamilyRename,
	type TokenCoverageResult,
	type PlatformMismatch,
	type ImpactEntry
} from './diff-utils.js';

// Re-export types that consumers also need
export type { TokenCoverageResult, PlatformMismatch, ImpactEntry, RenameEntry, FamilyRename };

// ─── Token Coverage ───────────────────────────────────────────────────────────

function extractAllTokenNames(content: string): Set<string> {
	const names = new Set<string>();
	for (const line of content.split('\n')) {
		for (const pat of TOKEN_PATTERNS) {
			const m = line.match(pat);
			if (m) {
				names.add(m[1]);
				break;
			}
		}
	}
	return names;
}

export function computeTokenCoverage(files: GeneratedFile[]): Record<string, TokenCoverageResult> {
	const result: Record<string, TokenCoverageResult> = {};
	for (const file of files) {
		if (!file.referenceContent) continue;
		const genNames = extractAllTokenNames(file.content);
		const refNames = extractAllTokenNames(file.referenceContent);
		const covered = [...genNames].filter((n) => refNames.has(n));
		const orphaned = [...refNames].filter((n) => !genNames.has(n));
		const unimplemented = [...genNames].filter((n) => !refNames.has(n));
		const total = new Set([...genNames, ...refNames]).size;
		result[file.filename] = {
			total,
			covered: covered.length,
			orphaned,
			unimplemented,
			coveragePercent: total > 0 ? (covered.length / total) * 100 : 100
		};
	}
	return result;
}

// ─── Cross-Platform Consistency ───────────────────────────────────────────────

function normalizeTokenName(name: string): string {
	return name
		.replace(/^[$_-]+/, '')
		.replace(/[-_]+/g, '-')
		.toLowerCase();
}

function normalizeHexValue(raw: string): string | null {
	const v = raw.trim().toLowerCase();

	if (/color\(\s*light:/i.test(v)) return null;
	if (/color\(\s*uicolor\./i.test(v)) return null;
	if (/^primitives\./i.test(v)) return null;
	if (/^lightcolortokens\.|^darkcolortokens\./i.test(v)) return null;

	// Swift: Color(hex: 0xRRGGBB) or Color(hex: 0xRRGGBBAA)
	const swiftMatch = v.match(/color\(\s*hex:\s*0x([0-9a-f]{6,8})/i);
	if (swiftMatch) {
		const h = swiftMatch[1];
		return `#${h.length === 8 ? h.slice(0, 6) : h}`;
	}

	// Kotlin: Color(0xAARRGGBB)
	const kotlinMatch = v.match(/color\(\s*0x([0-9a-f]{8})/i);
	if (kotlinMatch) {
		return `#${kotlinMatch[1].slice(2)}`;
	}

	// Web: any CSS color string -- use culori for safe parsing
	const webMatch = v.match(/#[0-9a-f]{3,8}\b/);
	if (!webMatch) return null;
	const parsed = parse(webMatch[0]);
	if (!parsed) return null;
	return formatHex(parsed);
}

export function validateCrossPlatform(files: GeneratedFile[]): PlatformMismatch[] {
	const platformTokens = new Map<
		string,
		Map<string, { rawValue: string; normalizedHex: string }>
	>();
	for (const file of files) {
		for (const line of file.content.split('\n')) {
			const nv = extractTokenNameValue(line);
			if (!nv) continue;
			const normHex = normalizeHexValue(nv.value);
			if (!normHex) continue;
			const normName = normalizeTokenName(nv.name);
			if (!platformTokens.has(normName)) platformTokens.set(normName, new Map());
			platformTokens
				.get(normName)!
				.set(file.platform, { rawValue: nv.value, normalizedHex: normHex });
		}
	}
	const mismatches: PlatformMismatch[] = [];
	for (const [tokenName, platforms] of platformTokens) {
		if (platforms.size < 2) continue;
		const vals = [...platforms.values()].map((v) => v.normalizedHex);
		if (new Set(vals).size > 1) {
			mismatches.push({
				tokenName,
				values: [...platforms.entries()].map(([p, v]) => ({
					platform: p,
					rawValue: v.rawValue,
					normalizedHex: v.normalizedHex
				}))
			});
		}
	}
	return mismatches;
}

// ─── Dependency Map ───────────────────────────────────────────────────────────

export interface DependencyEntry {
	semantic: string;
	primitive: string;
	hex: string;
}

export function buildDependencyMap(lightJson: Record<string, unknown>): DependencyEntry[] {
	const deps: DependencyEntry[] = [];
	function walk(obj: unknown, path: string) {
		if (!obj || typeof obj !== 'object') return;
		const o = obj as Record<string, unknown>;
		if (o.$type === 'color' && o.$value && typeof o.$value === 'object') {
			const v = o.$value as Record<string, unknown>;
			const aliasData = (o.$extensions as Record<string, unknown> | undefined)?.[
				'com.figma.aliasData'
			] as Record<string, unknown> | undefined;
			const targetName = aliasData?.targetVariableName as string | undefined;
			if (targetName && typeof v.hex === 'string') {
				deps.push({ semantic: path, primitive: targetName, hex: v.hex });
			}
			return;
		}
		for (const [k, val] of Object.entries(o)) {
			if (!k.startsWith('$')) walk(val, path ? `${path}/${k}` : k);
		}
	}
	walk(lightJson, '');
	return deps;
}

export function computeImpact(
	depMap: DependencyEntry[],
	mods: Record<string, TokenModification[]>,
	allRenames: Record<string, RenameEntry[]>,
	allDeprecations: Record<string, string[]>
): ImpactEntry[] {
	const primitiveChanges = new Map<string, string>();
	for (const modList of Object.values(mods)) {
		for (const m of modList) primitiveChanges.set(m.name.toLowerCase(), 'modified');
	}
	for (const renameList of Object.values(allRenames)) {
		for (const r of renameList) primitiveChanges.set(r.oldName.toLowerCase(), 'renamed');
	}
	for (const depList of Object.values(allDeprecations)) {
		for (const d of depList) primitiveChanges.set(d.toLowerCase(), 'removed');
	}

	const impacts: ImpactEntry[] = [];
	const grouped = new Map<string, string[]>();
	for (const dep of depMap) {
		const primKey = dep.primitive.split('/').pop()?.toLowerCase() ?? '';
		if (!grouped.has(dep.primitive)) grouped.set(dep.primitive, []);
		grouped.get(dep.primitive)!.push(dep.semantic);

		if (!primitiveChanges.has(primKey)) {
			const parts = dep.primitive.split('/');
			for (const p of parts) {
				if (primitiveChanges.has(p.toLowerCase())) {
					primitiveChanges.set(primKey, primitiveChanges.get(p.toLowerCase())!);
					break;
				}
			}
		}
	}

	for (const [primitivePath, semantics] of grouped) {
		const primKey = primitivePath.split('/').pop()?.toLowerCase() ?? '';
		const changeType = primitiveChanges.get(primKey);
		if (changeType) {
			impacts.push({ primitiveName: primitivePath, changeType, affectedSemantics: semantics });
		}
	}
	return impacts;
}

// ─── Rename Detection ─────────────────────────────────────────────────────────

export function detectRenames(allDiffs: Record<string, DiffLine[]>): Record<string, RenameEntry[]> {
	const result: Record<string, RenameEntry[]> = {};
	for (const [filename, lines] of Object.entries(allDiffs)) {
		const removedMap = new Map<string, string>();
		const addedMap = new Map<string, string>();
		for (const line of lines) {
			const nv = extractTokenNameValue(line.text);
			if (!nv || !nv.value || nv.value === '0') continue;
			if (line.type === 'remove') removedMap.set(nv.name, nv.value.toLowerCase());
			else if (line.type === 'add') addedMap.set(nv.name, nv.value.toLowerCase());
		}
		const addedByValue = new Map<string, string[]>();
		for (const [name, val] of addedMap) {
			if (!removedMap.has(name)) {
				const arr = addedByValue.get(val) ?? [];
				arr.push(name);
				addedByValue.set(val, arr);
			}
		}
		const found: RenameEntry[] = [];
		for (const [oldName, oldVal] of removedMap) {
			if (addedMap.has(oldName)) continue;
			const candidates = addedByValue.get(oldVal);
			if (candidates?.length) {
				let best = candidates[0];
				let bestScore = 0;
				for (const c of candidates) {
					let score = 0;
					for (let i = 0; i < Math.min(c.length, oldName.length); i++) {
						if (c[i] === oldName[i]) score++;
						else break;
					}
					if (score > bestScore) {
						bestScore = score;
						best = c;
					}
				}
				found.push({ oldName, newName: best, value: oldVal });
			}
		}
		if (found.length) result[filename] = found;
	}
	return result;
}

export function detectFamilyRenames(
	allRenames: Record<string, RenameEntry[]>
): Record<string, FamilyRename[]> {
	const result: Record<string, FamilyRename[]> = {};
	for (const [filename, renameList] of Object.entries(allRenames)) {
		const groups = new Map<string, { oldName: string; newName: string }[]>();
		for (const r of renameList) {
			let suffixLen = 0;
			const minLen = Math.min(r.oldName.length, r.newName.length);
			for (let i = 1; i <= minLen; i++) {
				if (r.oldName[r.oldName.length - i] === r.newName[r.newName.length - i]) suffixLen = i;
				else break;
			}
			const oldPrefix = r.oldName.slice(0, r.oldName.length - suffixLen);
			const newPrefix = r.newName.slice(0, r.newName.length - suffixLen);
			if (!oldPrefix || !newPrefix) continue;
			const key = `${oldPrefix}→${newPrefix}`;
			const arr = groups.get(key) ?? [];
			arr.push({ oldName: r.oldName, newName: r.newName });
			groups.set(key, arr);
		}
		const families: FamilyRename[] = [];
		for (const [key, members] of groups) {
			if (members.length < 3) continue;
			const [oldPrefix, newPrefix] = key.split('→');
			families.push({ oldPrefix, newPrefix, count: members.length, members });
		}
		if (families.length) result[filename] = families;
	}
	return result;
}
