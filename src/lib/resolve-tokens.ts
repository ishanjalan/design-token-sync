/**
 * Centralized token resolution layer.
 *
 * Provides generic tree-walking utilities for Figma DTCG exports,
 * builds a directed graph of alias references, and detects cycles.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenNode {
	path: string[];
	type: string;
	value: unknown;
	aliasTarget?: string;
}

export interface TokenGraph {
	nodes: Map<string, TokenNode>;
	edges: Map<string, string>; // source path → alias target path
}

export interface CycleResult {
	hasCycles: boolean;
	cycles: string[][];
}

export interface CycleWarning {
	chain: string[];
	message: string;
}

// ─── Generic Tree Walking ─────────────────────────────────────────────────────

type AnyToken = Record<string, unknown>;

const KNOWN_TOKEN_TYPES = new Set([
	'color', 'number', 'shadow', 'border', 'typography',
	'gradient', 'transition', 'cubic-bezier', 'duration',
	'dimension', 'fontFamily', 'fontWeight', 'fontSize',
	'lineHeight', 'letterSpacing', 'string', 'boolean', 'other'
]);

export function walkAllTokens(
	obj: unknown,
	fn: (path: string[], token: AnyToken, type: string) => void,
	path: string[] = [],
	unknownTypes?: Map<string, number>
): void {
	if (!obj || typeof obj !== 'object') return;
	const o = obj as AnyToken;
	if (typeof o.$type === 'string') {
		if (unknownTypes !== undefined && !KNOWN_TOKEN_TYPES.has(o.$type as string)) {
			unknownTypes.set(o.$type as string, (unknownTypes.get(o.$type as string) ?? 0) + 1);
		}
		fn(path, o, o.$type as string);
		return;
	}
	for (const [key, val] of Object.entries(o)) {
		if (!key.startsWith('$')) walkAllTokens(val, fn, [...path, key], unknownTypes);
	}
}

/**
 * Walk all tokens and collect unknown $type values.
 * Returns a map of unknown type name → count.
 */
export function collectUnknownTokenTypes(obj: unknown): Map<string, number> {
	const unknownTypes = new Map<string, number>();
	walkAllTokens(obj, () => {}, [], unknownTypes);
	return unknownTypes;
}

export function getTokenAtPath(obj: unknown, path: string[]): AnyToken | null {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = (cur as AnyToken)[key];
	}
	if (!cur || typeof cur !== 'object') return null;
	const o = cur as AnyToken;
	return typeof o.$type === 'string' ? o : null;
}

// ─── Token Graph ──────────────────────────────────────────────────────────────

export function buildTokenGraph(...exports: Record<string, unknown>[]): TokenGraph {
	const nodes = new Map<string, TokenNode>();
	const edges = new Map<string, string>();

	for (const exp of exports) {
		walkAllTokens(exp, (path, token, type) => {
			const key = path.join('/');
			const aliasData = (token.$extensions as AnyToken | undefined)?.[
				'com.figma.aliasData'
			] as AnyToken | undefined;
			const aliasTarget = aliasData?.targetVariableName as string | undefined;

			nodes.set(key, { path, type, value: token.$value, aliasTarget });
			if (aliasTarget) {
				edges.set(key, aliasTarget);
			}
		});
	}

	return { nodes, edges };
}

// ─── Cycle Detection (DFS) ────────────────────────────────────────────────────

export function detectCycles(graph: TokenGraph): CycleResult {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const inStack = new Set<string>();

	function dfs(node: string, chain: string[]): void {
		if (inStack.has(node)) {
			const cycleStart = chain.indexOf(node);
			cycles.push(chain.slice(cycleStart).concat(node));
			return;
		}
		if (visited.has(node)) return;

		visited.add(node);
		inStack.add(node);
		chain.push(node);

		const target = graph.edges.get(node);
		if (target) {
			dfs(target, chain);
		}

		inStack.delete(node);
		chain.pop();
	}

	for (const node of graph.edges.keys()) {
		if (!visited.has(node)) {
			dfs(node, []);
		}
	}

	return { hasCycles: cycles.length > 0, cycles };
}

export function formatCycleWarnings(result: CycleResult): CycleWarning[] {
	return result.cycles.map((chain) => ({
		chain,
		message: `Circular reference: ${chain.join(' → ')}`
	}));
}

// ─── Token Resolution ─────────────────────────────────────────────────────────

export function resolveToken(
	path: string,
	graph: TokenGraph,
	maxDepth: number = 20
): TokenNode | null {
	let current = path;
	const seen = new Set<string>();

	for (let i = 0; i < maxDepth; i++) {
		if (seen.has(current)) return null; // cycle
		seen.add(current);

		const node = graph.nodes.get(current);
		if (!node) return null;

		const target = graph.edges.get(current);
		if (!target) return node; // leaf

		current = target;
	}

	return null;
}
