import { describe, it, expect } from 'vitest';
import {
	walkAllTokens,
	getTokenAtPath,
	buildTokenGraph,
	detectCycles,
	formatCycleWarnings,
	resolveToken
} from './resolve-tokens.js';

const colorToken = (hex: string, alias?: string) => ({
	$type: 'color',
	$value: { hex },
	...(alias
		? {
				$extensions: {
					'com.figma.aliasData': {
						targetVariableId: alias,
						targetVariableName: alias,
						targetVariableSetId: 's1',
						targetVariableSetName: '_Primitives'
					}
				}
			}
		: {})
});

describe('walkAllTokens', () => {
	it('walks color tokens', () => {
		const paths: string[][] = [];
		walkAllTokens({ Text: { primary: colorToken('#111') } }, (path) => paths.push([...path]));
		expect(paths).toEqual([['Text', 'primary']]);
	});

	it('walks multiple token types', () => {
		const types: string[] = [];
		walkAllTokens(
			{
				Color: { a: { $type: 'color', $value: {} } },
				Spacing: { b: { $type: 'number', $value: 4 } }
			},
			(_path, _token, type) => types.push(type)
		);
		expect(types).toEqual(['color', 'number']);
	});

	it('skips $ keys', () => {
		const paths: string[][] = [];
		walkAllTokens({ $meta: { a: colorToken('#fff') }, Text: colorToken('#000') }, (path) =>
			paths.push([...path])
		);
		expect(paths).toEqual([['Text']]);
	});

	it('handles null/primitive input', () => {
		const paths: string[][] = [];
		walkAllTokens(null, (path) => paths.push([...path]));
		walkAllTokens('string', (path) => paths.push([...path]));
		expect(paths).toEqual([]);
	});
});

describe('getTokenAtPath', () => {
	it('returns token at valid path', () => {
		const data = { Text: { primary: colorToken('#111') } };
		const result = getTokenAtPath(data, ['Text', 'primary']);
		expect(result?.$type).toBe('color');
	});

	it('returns null for invalid path', () => {
		expect(getTokenAtPath({ Text: {} }, ['Text', 'missing'])).toBeNull();
	});

	it('returns null for non-token node', () => {
		expect(getTokenAtPath({ Text: { primary: { nested: true } } }, ['Text', 'primary'])).toBeNull();
	});
});

describe('buildTokenGraph', () => {
	it('builds graph with alias edges', () => {
		const data = {
			Text: { primary: colorToken('#111', 'Colour/Grey/750') }
		};
		const graph = buildTokenGraph(data);
		expect(graph.nodes.size).toBe(1);
		expect(graph.edges.get('Text/primary')).toBe('Colour/Grey/750');
	});

	it('handles tokens without aliases', () => {
		const data = {
			Colour: { Grey: { '750': colorToken('#111') } }
		};
		const graph = buildTokenGraph(data);
		expect(graph.nodes.size).toBe(1);
		expect(graph.edges.size).toBe(0);
	});

	it('merges multiple exports', () => {
		const light = { Text: { primary: colorToken('#111', 'Colour/Grey/750') } };
		const dark = { Text: { primary: colorToken('#eee', 'Colour/Grey/50') } };
		const graph = buildTokenGraph(light, dark);
		// Same path, dark overwrites light
		expect(graph.nodes.size).toBe(1);
	});
});

describe('detectCycles', () => {
	it('returns no cycles for acyclic graph', () => {
		const data = {
			Text: { primary: colorToken('#111', 'Colour/Grey/750') },
			Colour: { Grey: { '750': colorToken('#111') } }
		};
		const graph = buildTokenGraph(data);
		const result = detectCycles(graph);
		expect(result.hasCycles).toBe(false);
		expect(result.cycles).toEqual([]);
	});

	it('detects a simple cycle (A → B → A)', () => {
		const graph = {
			nodes: new Map([
				['A', { path: ['A'], type: 'color', value: {}, aliasTarget: 'B' }],
				['B', { path: ['B'], type: 'color', value: {}, aliasTarget: 'A' }]
			]),
			edges: new Map([
				['A', 'B'],
				['B', 'A']
			])
		};
		const result = detectCycles(graph);
		expect(result.hasCycles).toBe(true);
		expect(result.cycles.length).toBeGreaterThan(0);
		const flat = result.cycles.flat();
		expect(flat).toContain('A');
		expect(flat).toContain('B');
	});

	it('detects a 3-node cycle (A → B → C → A)', () => {
		const graph = {
			nodes: new Map([
				['A', { path: ['A'], type: 'color', value: {}, aliasTarget: 'B' }],
				['B', { path: ['B'], type: 'color', value: {}, aliasTarget: 'C' }],
				['C', { path: ['C'], type: 'color', value: {}, aliasTarget: 'A' }]
			]),
			edges: new Map([
				['A', 'B'],
				['B', 'C'],
				['C', 'A']
			])
		};
		const result = detectCycles(graph);
		expect(result.hasCycles).toBe(true);
	});
});

describe('formatCycleWarnings', () => {
	it('formats cycles into human-readable messages', () => {
		const result = { hasCycles: true, cycles: [['A', 'B', 'A']] };
		const warnings = formatCycleWarnings(result);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].message).toBe('Circular reference: A → B → A');
		expect(warnings[0].chain).toEqual(['A', 'B', 'A']);
	});
});

describe('resolveToken', () => {
	it('resolves a direct token (no alias)', () => {
		const data = { Colour: { Grey: { '750': colorToken('#111') } } };
		const graph = buildTokenGraph(data);
		const resolved = resolveToken('Colour/Grey/750', graph);
		expect(resolved).not.toBeNull();
		expect(resolved?.type).toBe('color');
	});

	it('follows an alias chain', () => {
		const graph = {
			nodes: new Map([
				['Text/primary', { path: ['Text', 'primary'], type: 'color', value: { hex: '#aaa' }, aliasTarget: 'Colour/Grey/750' }],
				['Colour/Grey/750', { path: ['Colour', 'Grey', '750'], type: 'color', value: { hex: '#111' } }]
			]),
			edges: new Map([['Text/primary', 'Colour/Grey/750']])
		};
		const resolved = resolveToken('Text/primary', graph);
		expect(resolved?.path).toEqual(['Colour', 'Grey', '750']);
	});

	it('returns null on cycle', () => {
		const graph = {
			nodes: new Map([
				['A', { path: ['A'], type: 'color', value: {}, aliasTarget: 'B' }],
				['B', { path: ['B'], type: 'color', value: {}, aliasTarget: 'A' }]
			]),
			edges: new Map([
				['A', 'B'],
				['B', 'A']
			])
		};
		expect(resolveToken('A', graph)).toBeNull();
	});

	it('returns null for missing node', () => {
		const graph = { nodes: new Map(), edges: new Map() };
		expect(resolveToken('missing', graph)).toBeNull();
	});
});
