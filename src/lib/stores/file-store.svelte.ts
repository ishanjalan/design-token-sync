import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import type { Platform, DropZoneKey, FileSlot, OutputCategory } from '$lib/types.js';
import type { FileInsight } from '$lib/file-validation.js';
import type { Swatch } from '$lib/swatch-utils.js';
import type { DependencyEntry } from '$lib/token-analysis.js';
import {
	saveRefFile,
	loadRefFile,
	clearRefFile,
	savePlatforms,
	loadPlatforms,
	clearAllStorage,
	migrateStorageIfNeeded
} from '$lib/storage.js';
import { validateFigmaJson, computeInsight } from '$lib/file-validation.js';
import { computeConventionHints } from '$lib/convention-hints.js';
import { computeValidation, type ValidationSummary } from '$lib/pre-validation.js';
import { parseSwatches } from '$lib/swatch-utils.js';
import { buildDependencyMap } from '$lib/token-analysis.js';

export const ALL_KEYS: DropZoneKey[] = [
	'lightColors',
	'darkColors',
	'values',
	'typography',
	'referenceColorsWeb',
	'referenceTypographyWeb',
	'referenceColorsSwift',
	'referenceColorsKotlin',
	'referenceTypographySwift',
	'referenceTypographyKotlin'
];

export const REF_KEYS: DropZoneKey[] = [
	'referenceColorsWeb',
	'referenceTypographyWeb',
	'referenceColorsSwift',
	'referenceColorsKotlin',
	'referenceTypographySwift',
	'referenceTypographyKotlin'
];

class FileStoreClass {
	selectedPlatforms = $state<Platform[]>(['web']);
	selectedOutputs = $state<OutputCategory[]>(['colors', 'typography']);
	loading = $state(false);
	bulkDropActive = $state(false);
	needsRegeneration = $state(false);
	fileInsights = $state<Partial<Record<DropZoneKey, FileInsight>>>({});
	conventionHints = $state<Partial<Record<DropZoneKey, string[]>>>({});
	validations = $state<Partial<Record<DropZoneKey, ValidationSummary>>>({});
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
			files: [],
			multiFile: false,
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
			files: [],
			multiFile: false,
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
			files: [],
			multiFile: false,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsWeb: {
			label: 'Color files',
			accept: '.scss,.ts,.css,text/plain',
			hint: 'Drop your existing color files (.scss, .ts, .css)',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			files: [],
			multiFile: true,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographyWeb: {
			label: 'Typography files',
			accept: '.scss,.ts,.css,text/plain',
			hint: 'Drop your existing typography files (.scss, .ts, .css)',
			ext: 'scss',
			platforms: ['web'],
			required: false,
			file: null,
			files: [],
			multiFile: true,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsSwift: {
			label: 'Colors.swift',
			accept: '.swift,text/plain',
			hint: 'Drop your existing color files',
			ext: 'swift',
			platforms: ['ios'],
			required: false,
			file: null,
			files: [],
			multiFile: true,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceColorsKotlin: {
			label: 'Colors.kt',
			accept: '.kt,text/plain',
			hint: 'Drop your existing color files',
			ext: 'kt',
			platforms: ['android'],
			required: false,
			file: null,
			files: [],
			multiFile: true,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographySwift: {
			label: 'Typography.swift',
			accept: '.swift,text/plain',
			hint: 'Drop your existing typography files',
			ext: 'swift',
			platforms: ['ios'],
			required: false,
			file: null,
			files: [],
			multiFile: true,
			dragging: false,
			restored: false,
			warning: null
		},
		referenceTypographyKotlin: {
			label: 'Typography.kt',
			accept: '.kt,text/plain',
			hint: 'Drop your existing typography files',
			ext: 'kt',
			platforms: ['android'],
			required: false,
			file: null,
			files: [],
			multiFile: true,
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
			files: [],
			multiFile: false,
			dragging: false,
			restored: false,
			warning: null
		}
	});

	dragCounters: Partial<Record<DropZoneKey, number>> = {};

	get visibleKeys(): DropZoneKey[] {
		const wantColors = this.selectedOutputs.includes('colors');
		const wantTypo = this.selectedOutputs.includes('typography');

		const webKeys: DropZoneKey[] = this.selectedPlatforms.includes('web')
			? [
					...(wantColors ? (['referenceColorsWeb'] as DropZoneKey[]) : []),
					...(wantTypo ? (['referenceTypographyWeb'] as DropZoneKey[]) : [])
				]
			: [];
		const iosKeys: DropZoneKey[] = this.selectedPlatforms.includes('ios')
			? [
					...(wantColors ? (['referenceColorsSwift'] as DropZoneKey[]) : []),
					...(wantTypo ? (['referenceTypographySwift'] as DropZoneKey[]) : [])
				]
			: [];
		const androidKeys: DropZoneKey[] = this.selectedPlatforms.includes('android')
			? [
					...(wantColors ? (['referenceColorsKotlin'] as DropZoneKey[]) : []),
					...(wantTypo ? (['referenceTypographyKotlin'] as DropZoneKey[]) : [])
				]
			: [];
		return [
			'lightColors',
			'darkColors',
			'values',
			...(wantTypo ? (['typography'] as DropZoneKey[]) : []),
			...webKeys,
			...iosKeys,
			...androidKeys
		];
	}

	get requiredFilled() {
		return (['lightColors', 'darkColors', 'values'] as DropZoneKey[]).filter(
			(k) => !!this.slots[k].file
		).length;
	}

	get canGenerate() {
		return this.requiredFilled === 3 && !this.loading && this.selectedOutputs.length > 0;
	}

	get visibleFilled() {
		return this.visibleKeys.filter((k) => !!this.slots[k].file).length;
	}

	get hasRefFiles() {
		return REF_KEYS.some((k) => !!this.slots[k].file);
	}

	get bestPractices() {
		return !this.hasRefFiles;
	}

	init() {
		migrateStorageIfNeeded();
		const storedPlatforms = loadPlatforms();
		if (storedPlatforms?.length) this.selectedPlatforms = storedPlatforms;

		for (const key of REF_KEYS) {
			const stored = loadRefFile(key);
			if (!stored) continue;
			const synthetic = new File([stored.content], stored.name, { type: 'text/plain' });
			this.slots[key].file = synthetic;
			this.slots[key].files = [synthetic];
			this.slots[key].restored = true;
			this.conventionHints[key] = computeConventionHints(key, stored.content);
			this.validations[key] = computeValidation(key, stored.content);
		}
	}

	selectPlatform(id: Platform) {
		this.selectedPlatforms = [id];
		if (browser) savePlatforms([id]);
	}

	toggleOutput(cat: OutputCategory) {
		if (this.selectedOutputs.includes(cat)) {
			this.selectedOutputs = this.selectedOutputs.filter((c) => c !== cat);
		} else {
			this.selectedOutputs = [...this.selectedOutputs, cat];
		}
	}

	async assignFile(key: DropZoneKey, file: File) {
		const slot = this.slots[key];
		if (REF_KEYS.includes(key) && !slot.multiFile) {
			const expectedExt = `.${slot.ext}`;
			const fileExt = file.name.includes('.')
				? `.${file.name.split('.').pop()!.toLowerCase()}`
				: '';
			if (fileExt && fileExt !== expectedExt && fileExt !== '.txt') {
				toast.error(`Expected a ${expectedExt} file for ${slot.label}, got "${file.name}"`);
				return;
			}
		}
		let content: string;
		try {
			content = await file.text();
		} catch {
			toast.error(`Could not read ${file.name}`);
			slot.file = null;
			return;
		}
		slot.file = file;
		slot.files = [file];
		slot.restored = false;
		slot.warning = validateFigmaJson(key, content);
		this.fileInsights[key] = computeInsight(key, content);
		if (REF_KEYS.includes(key)) {
			this.conventionHints[key] = computeConventionHints(key, content);
			this.validations[key] = computeValidation(key, content);
			saveRefFile(key, file.name, content);
		}
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

	async assignMultipleFiles(key: DropZoneKey, files: File[]) {
		const slot = this.slots[key];
		if (!slot.multiFile || files.length === 0) return;

		const acceptedExts = slot.accept
			.split(',')
			.filter((s) => s.startsWith('.'))
			.map((s) => s.toLowerCase());
		const validFiles: File[] = [];

		for (const f of files) {
			if (f.name.toLowerCase().endsWith('.zip')) {
				try {
					const { unzipSync, strFromU8 } = await import('fflate');
					const buf = new Uint8Array(await f.arrayBuffer());
					const extracted = unzipSync(buf);
					for (const [name, data] of Object.entries(extracted)) {
						const ext = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
						if (acceptedExts.includes(ext) || ext === '.txt') {
							const content = strFromU8(data);
							validFiles.push(new File([content], name, { type: 'text/plain' }));
						}
					}
				} catch {
					toast.error(`Could not extract ${f.name}`);
				}
				continue;
			}
			const ext = f.name.includes('.') ? `.${f.name.split('.').pop()!.toLowerCase()}` : '';
			if (acceptedExts.length === 0 || acceptedExts.includes(ext) || ext === '.txt') {
				validFiles.push(f);
			} else {
				toast.error(`Skipped "${f.name}" — expected ${acceptedExts.join(', ')}`);
			}
		}

		if (validFiles.length === 0) return;

		slot.files = validFiles;
		slot.file = validFiles[0];
		slot.restored = false;

		const allContents: string[] = [];
		for (const f of validFiles) {
			try { allContents.push(await f.text()); } catch { /* skip unreadable */ }
		}
		const combinedContent = allContents.join('\n');
		slot.warning = null;
		this.fileInsights[key] = computeInsight(key, combinedContent);
		this.conventionHints[key] = computeConventionHints(key, combinedContent);
		this.validations[key] = computeValidation(key, combinedContent);
		if (REF_KEYS.includes(key)) saveRefFile(key, validFiles.map((f) => f.name).join(','), combinedContent);

		const count = validFiles.length;
		toast.success(`${count} file${count > 1 ? 's' : ''} loaded for ${slot.label}`);
	}

	clearFile(key: DropZoneKey, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		this.slots[key].file = null;
		this.slots[key].files = [];
		this.slots[key].restored = false;
		this.slots[key].warning = null;
		delete this.conventionHints[key];
		delete this.validations[key];
		if (REF_KEYS.includes(key)) clearRefFile(key);
	}

	resetSlots() {
		for (const key of ALL_KEYS) {
			this.slots[key].file = null;
			this.slots[key].files = [];
			this.slots[key].restored = false;
			this.slots[key].warning = null;
		}
		clearAllStorage();
		this.swatches = [];
		this.fileInsights = {};
		this.conventionHints = {};
		this.validations = {};
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
		const dt = e.dataTransfer;
		if (!dt?.files.length) return;
		if (this.slots[key].multiFile && dt.files.length > 1) {
			this.assignMultipleFiles(key, Array.from(dt.files));
		} else if (this.slots[key].multiFile && dt.files[0].name.toLowerCase().endsWith('.zip')) {
			this.assignMultipleFiles(key, [dt.files[0]]);
		} else {
			this.assignFile(key, dt.files[0]);
		}
	}

	handleFileInput(key: DropZoneKey, e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		if (this.slots[key].multiFile && input.files.length > 1) {
			this.assignMultipleFiles(key, Array.from(input.files));
		} else if (this.slots[key].multiFile && input.files[0].name.toLowerCase().endsWith('.zip')) {
			this.assignMultipleFiles(key, [input.files[0]]);
		} else if (input.files[0]) {
			this.assignFile(key, input.files[0]);
		}
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
