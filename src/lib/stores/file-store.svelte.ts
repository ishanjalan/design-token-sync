import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import type { Platform, DropZoneKey, FileSlot } from '$lib/types.js';
import type { FileInsight } from '$lib/file-validation.js';
import type { Swatch } from '$lib/swatch-utils.js';
import type { DependencyEntry } from '$lib/token-analysis.js';
import {
	saveRefFile,
	loadRefFile,
	clearRefFile,
	savePlatforms,
	loadPlatforms,
	saveBestPractices,
	loadBestPractices,
	clearAllStorage
} from '$lib/storage.js';
import { validateFigmaJson, computeInsight } from '$lib/file-validation.js';
import { parseSwatches } from '$lib/swatch-utils.js';
import { buildDependencyMap } from '$lib/token-analysis.js';

export const ALL_KEYS: DropZoneKey[] = [
	'lightColors',
	'darkColors',
	'values',
	'typography',
	'referencePrimitivesScss',
	'referenceColorsScss',
	'referencePrimitivesTs',
	'referenceColorsTs',
	'referenceColorsSwift',
	'referenceColorsKotlin',
	'referenceTypographyScss',
	'referenceTypographyTs',
	'referenceTypographySwift',
	'referenceTypographyKotlin'
];

export const REF_KEYS: DropZoneKey[] = [
	'referencePrimitivesScss',
	'referenceColorsScss',
	'referencePrimitivesTs',
	'referenceColorsTs',
	'referenceColorsSwift',
	'referenceColorsKotlin',
	'referenceTypographyScss',
	'referenceTypographyTs',
	'referenceTypographySwift',
	'referenceTypographyKotlin'
];

class FileStoreClass {
	selectedPlatforms = $state<Platform[]>(['web']);
	bestPractices = $state(true);
	loading = $state(false);
	bulkDropActive = $state(false);
	needsRegeneration = $state(false);
	fileInsights = $state<Partial<Record<DropZoneKey, FileInsight>>>({});
	swatches = $state<Swatch[]>([]);
	dependencyMap = $state<DependencyEntry[]>([]);
	prevPlatforms = $state<string>(JSON.stringify(['web']));

	slots = $state<Record<DropZoneKey, FileSlot>>({
		lightColors: {
			label: 'Light.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma › Variables › Export JSON — light mode',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: true,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		darkColors: {
			label: 'Dark.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma › Variables › Export JSON — dark mode',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: true,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		values: {
			label: 'Value.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma spacing & integer scale',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: true,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referencePrimitivesScss: {
			label: 'Primitives.scss',
			accept: '.scss,text/plain',
			hint: 'Current file — primitive color variables',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsScss: {
			label: 'Colors.scss',
			accept: '.scss,text/plain',
			hint: 'Current file — semantic color variables',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referencePrimitivesTs: {
			label: 'Primitives.ts',
			accept: '.ts,text/plain',
			hint: 'Current file — primitive color constants',
			ext: 'ts',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsTs: {
			label: 'Colors.ts',
			accept: '.ts,text/plain',
			hint: 'Current file — semantic color constants',
			ext: 'ts',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsSwift: {
			label: 'Colors.swift',
			accept: '.swift,text/plain',
			hint: 'Current file — matches existing naming conventions',
			ext: 'swift',
			platforms: ['ios'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsKotlin: {
			label: 'Colors.kt',
			accept: '.kt,text/plain',
			hint: 'Current file — matches existing naming conventions',
			ext: 'kt',
			platforms: ['android'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographyScss: {
			label: 'Typography.scss',
			accept: '.scss,text/plain',
			hint: 'Current file — typography variables & mixins',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographyTs: {
			label: 'Typography.ts',
			accept: '.ts,text/plain',
			hint: 'Current file — typography constants',
			ext: 'ts',
			platforms: ['web'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographySwift: {
			label: 'Typography.swift',
			accept: '.swift,text/plain',
			hint: 'Current file — typography styles',
			ext: 'swift',
			platforms: ['ios'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographyKotlin: {
			label: 'Typography.kt',
			accept: '.kt,text/plain',
			hint: 'Current file — typography text styles',
			ext: 'kt',
			platforms: ['android'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		},
		typography: {
			label: 'typography.tokens.json',
			accept: 'application/json,.json',
			hint: 'Figma text styles — prefix with ios/ or droid/ for platform output',
			ext: 'json',
			platforms: ['web', 'android', 'ios'],
			required: false,
			file: null,
			dragging: false,
			restored: false,
			warning: null
		}
	});

	dragCounters: Partial<Record<DropZoneKey, number>> = {};

	get visibleKeys(): DropZoneKey[] {
		return [
			'lightColors',
			'darkColors',
			'values',
			'typography',
			...(this.selectedPlatforms.includes('web')
				? ([
						'referencePrimitivesScss',
						'referenceColorsScss',
						'referencePrimitivesTs',
						'referenceColorsTs',
						'referenceTypographyScss',
						'referenceTypographyTs'
					] as DropZoneKey[])
				: []),
			...(this.selectedPlatforms.includes('ios')
				? (['referenceColorsSwift', 'referenceTypographySwift'] as DropZoneKey[])
				: []),
			...(this.selectedPlatforms.includes('android')
				? (['referenceColorsKotlin', 'referenceTypographyKotlin'] as DropZoneKey[])
				: [])
		];
	}

	get requiredFilled() {
		return (['lightColors', 'darkColors', 'values'] as DropZoneKey[]).filter(
			(k) => !!this.slots[k].file
		).length;
	}

	get canGenerate() {
		return this.requiredFilled === 3 && !this.loading;
	}

	get visibleFilled() {
		return this.visibleKeys.filter((k) => !!this.slots[k].file).length;
	}

	get hasRefFiles() {
		return REF_KEYS.some((k) => !!this.slots[k].file);
	}

	init() {
		const storedPlatforms = loadPlatforms();
		if (storedPlatforms?.length) this.selectedPlatforms = storedPlatforms;
		this.bestPractices = loadBestPractices();

		for (const key of REF_KEYS) {
			const stored = loadRefFile(key);
			if (!stored) continue;
			const synthetic = new File([stored.content], stored.name, { type: 'text/plain' });
			this.slots[key].file = synthetic;
			this.slots[key].restored = true;
		}
	}

	selectPlatform(id: Platform) {
		this.selectedPlatforms = [id];
		if (browser) savePlatforms([id]);
	}

	setBestPractices(val: boolean) {
		this.bestPractices = val;
		saveBestPractices(val);
	}

	async assignFile(key: DropZoneKey, file: File) {
		if (REF_KEYS.includes(key)) {
			const expectedExt = `.${this.slots[key].ext}`;
			const fileExt = file.name.includes('.')
				? `.${file.name.split('.').pop()!.toLowerCase()}`
				: '';
			if (fileExt && fileExt !== expectedExt && fileExt !== '.txt') {
				toast.error(`Expected a ${expectedExt} file for ${this.slots[key].label}, got "${file.name}"`);
				return;
			}
		}
		let content: string;
		try {
			content = await file.text();
		} catch {
			toast.error(`Could not read ${file.name}`);
			this.slots[key].file = null;
			return;
		}
		this.slots[key].file = file;
		this.slots[key].restored = false;
		this.slots[key].warning = validateFigmaJson(key, content);
		this.fileInsights[key] = computeInsight(key, content);
		if (REF_KEYS.includes(key)) saveRefFile(key, file.name, content);
		if (key === 'lightColors') {
			try {
				const parsed = JSON.parse(content);
				this.swatches = parseSwatches(parsed);
				this.dependencyMap = buildDependencyMap(parsed);
			} catch {
				this.swatches = [];
				this.dependencyMap = [];
			}
		}
	}

	clearFile(key: DropZoneKey, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		this.slots[key].file = null;
		this.slots[key].restored = false;
		this.slots[key].warning = null;
		if (REF_KEYS.includes(key)) clearRefFile(key);
	}

	resetSlots() {
		for (const key of ALL_KEYS) {
			this.slots[key].file = null;
			this.slots[key].restored = false;
			this.slots[key].warning = null;
		}
		clearAllStorage();
		this.swatches = [];
		this.fileInsights = {};
		this.dependencyMap = [];
	}

	handleDragEnter(key: DropZoneKey, e: DragEvent) {
		e.preventDefault();
		this.dragCounters[key] = (this.dragCounters[key] ?? 0) + 1;
		this.slots[key].dragging = true;
	}

	handleDragOver(_key: DropZoneKey, e: DragEvent) {
		e.preventDefault();
	}

	handleDragLeave(key: DropZoneKey) {
		this.dragCounters[key] = (this.dragCounters[key] ?? 1) - 1;
		if ((this.dragCounters[key] ?? 0) <= 0) {
			this.dragCounters[key] = 0;
			this.slots[key].dragging = false;
		}
	}

	handleDrop(key: DropZoneKey, e: DragEvent) {
		e.preventDefault();
		this.dragCounters[key] = 0;
		this.slots[key].dragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) this.assignFile(key, file);
	}

	handleFileInput(key: DropZoneKey, e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) this.assignFile(key, input.files[0]);
	}

	async autoDetectSlot(file: File): Promise<DropZoneKey | null> {
		const name = file.name.toLowerCase();
		if (name.includes('light')) return 'lightColors';
		if (name.includes('dark')) return 'darkColors';
		if (name.includes('value') || name.includes('spacing')) return 'values';
		if (name.includes('typography') || name.includes('typo')) return 'typography';
		try {
			const preview = await file.slice(0, 4096).text();
			const json = JSON.parse(preview) as Record<string, unknown>;
			function hasType(obj: unknown, t: string): boolean {
				if (!obj || typeof obj !== 'object') return false;
				const o = obj as Record<string, unknown>;
				if (o.$type === t) return true;
				return Object.entries(o).some(([k, v]) => !k.startsWith('$') && hasType(v, t));
			}
			if (json['typography'] || hasType(json, 'typography')) return 'typography';
			if (hasType(json, 'number')) return 'values';
			if (hasType(json, 'color')) {
				const topKeys = Object.keys(json).join(' ').toLowerCase();
				if (topKeys.includes('dark')) return 'darkColors';
				return 'lightColors';
			}
		} catch {
			/* not JSON */
		}
		return null;
	}

	async handleBulkDrop(e: DragEvent) {
		e.preventDefault();
		this.bulkDropActive = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.name.endsWith('.json'));
		if (!files.length) {
			toast.error('No .json files found in the drop');
			return;
		}
		let assigned = 0;
		const unmatched: string[] = [];
		for (const file of files) {
			const slot = await this.autoDetectSlot(file);
			if (slot) {
				await this.assignFile(slot, file);
				assigned++;
			} else {
				unmatched.push(file.name);
			}
		}
		if (assigned) toast.success(`${assigned} file${assigned > 1 ? 's' : ''} auto-assigned`);
		if (unmatched.length) toast.error(`Could not assign: ${unmatched.join(', ')}`);
	}

	applyTokenData(slotEntries: { key: DropZoneKey; content: string; name: string }[]) {
		for (const entry of slotEntries) {
			const file = new File([entry.content], entry.name, { type: 'application/json' });
			this.slots[entry.key].file = file;
			this.slots[entry.key].restored = false;
			this.slots[entry.key].warning = validateFigmaJson(entry.key, entry.content);
			this.fileInsights[entry.key] = computeInsight(entry.key, entry.content);
		}
		try {
			const parsed = JSON.parse(slotEntries[0].content);
			this.swatches = parseSwatches(parsed);
			this.dependencyMap = buildDependencyMap(parsed);
		} catch {
			this.swatches = [];
			this.dependencyMap = [];
		}
	}
}

export const fileStore = new FileStoreClass();
