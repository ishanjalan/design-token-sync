import { extractKotlinColorClassInfo } from '$lib/transformers/shared.js';

export type RefEntry = { filename: string; content: string };

export function classifyWebColorFiles(entries: RefEntry[] | undefined): {
	primitivesScss?: string;
	colorsScss?: string;
	primitivesTs?: string;
	colorsTs?: string;
} {
	if (!entries?.length) return {};
	const result: Record<string, string | undefined> = {};
	for (const { filename, content } of entries) {
		const ext = filename.split('.').pop()?.toLowerCase();
		const isScss = ext === 'scss' || ext === 'css';
		const isTs = ext === 'ts';
		const isPrimitive = /\$[\w-]+-\d+:|--[\w-]+-\d+:|_[A-Z]+_\d+\s*=/.test(content)
			|| /export\s+const\s+[A-Z]+_\d+/.test(content)
			|| filename.toLowerCase().includes('primitive');
		if (isScss) {
			if (isPrimitive) result.primitivesScss = content;
			else result.colorsScss = content;
		} else if (isTs) {
			if (isPrimitive) result.primitivesTs = content;
			else result.colorsTs = content;
		}
	}
	return result;
}

export function classifyKotlinRefFiles(entries: RefEntry[] | undefined): {
	hasPrimitives: boolean;
	hasSemantics: boolean;
	semanticCategories: string[];
	classificationWarning?: string;
} {
	if (!entries?.length) return { hasPrimitives: false, hasSemantics: false, semanticCategories: [] };
	let hasPrimitives = false,
		hasSemantics = false;
	const categories: string[] = [];
	const allContent = entries.map((e) => e.content).join('\n');
	for (const { content } of entries) {
		if (
			/\bobject\s+\w+Palette\b/.test(content) ||
			/^val\s+\w+\s*=\s*Color\(/m.test(content) ||
			/\bobject\s+(?:Primitives|.*Primitives)\s*\{/.test(content)
		)
			hasPrimitives = true;
		if (/\bobject\s+(?:Light|Dark)ColorTokens\b/.test(content)) hasSemantics = true;
	}
	const { prefix, categories: detectedCats } = extractKotlinColorClassInfo(allContent);
	if (detectedCats.length > 0) {
		hasSemantics = true;
		categories.push(...detectedCats);
	}

	const hasKotlinColorContent = /\bColor\s*\(/.test(allContent);
	const classificationWarning =
		hasKotlinColorContent && !hasSemantics && !hasPrimitives
			? `Kotlin reference files were uploaded but no color class pattern was detected. ` +
			  `Expected a naming convention like \`class ${prefix}FillColors\`, \`class ${prefix}TextColors\`, etc. ` +
			  `Check that your reference file uses a consistent \`class <Prefix><Category>Colors\` naming pattern.`
			: undefined;

	return { hasPrimitives, hasSemantics, semanticCategories: [...new Set(categories)], classificationWarning };
}

export function classifyKotlinTypographyRefFiles(entries: RefEntry[] | undefined): {
	hasDefinition: boolean;
	hasAccessor: boolean;
	definitionContent?: string;
	definitionFilename?: string;
	accessorClassName?: string;
	accessorContainerRef?: string;
	accessorFilename?: string;
} {
	if (!entries?.length) return { hasDefinition: false, hasAccessor: false };
	let hasDefinition = false, hasAccessor = false;
	let definitionContent: string | undefined;
	let definitionFilename: string | undefined;
	let accessorClassName: string | undefined;
	let accessorContainerRef: string | undefined;
	let accessorFilename: string | undefined;

	for (const { filename, content } of entries) {
		const isEnumAccessor = /\benum\s+class\s+\w+/.test(content) && /MaterialTheme/.test(content);
		if (isEnumAccessor) {
			hasAccessor = true;
			accessorFilename = filename;
			const enumMatch = content.match(/\benum\s+class\s+(\w+)/);
			if (enumMatch) accessorClassName = enumMatch[1];
			const containerMatch = content.match(/MaterialTheme\.(\w+)\./);
			if (containerMatch) accessorContainerRef = containerMatch[1];
			continue;
		}

		const isDefinition =
			(/\bclass\s+\w+/.test(content) && (/@Immutable\b/.test(content) || /internal\s+constructor/.test(content))) ||
			(/\bobject\s+\w+/.test(content) && /\bTextStyle\s*\(/.test(content));
		if (isDefinition) {
			hasDefinition = true;
			definitionContent = content;
			definitionFilename = filename;
		}
	}

	return { hasDefinition, hasAccessor, definitionContent, definitionFilename, accessorClassName, accessorContainerRef, accessorFilename };
}

export function classifyWebTypographyFiles(entries: RefEntry[] | undefined): {
	typoScss?: string;
	typoTs?: string;
} {
	if (!entries?.length) return {};
	const result: Record<string, string | undefined> = {};
	for (const { filename, content } of entries) {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (ext === 'scss' || ext === 'css') result.typoScss = content;
		else if (ext === 'ts') result.typoTs = content;
	}
	return result;
}
