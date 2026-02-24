import type { DropZoneKey } from './types.js';
import {
	detectRenamesInReference,
	detectSwiftBugs,
	detectKotlinColorBugs,
	detectKotlinTypoBugs
} from './transformers/shared.js';

export interface ValidationSummary {
	renames: number;
	bugs: string[];
}

const EMPTY: ValidationSummary = { renames: 0, bugs: [] };

export function computeValidation(key: DropZoneKey, content: string): ValidationSummary {
	if (!content.trim()) return EMPTY;

	switch (key) {
		case 'referenceColorsWeb':
		case 'referenceTypographyWeb':
			return webValidation(content);
		case 'referenceColorsSwift':
			return { renames: detectRenamesInReference(content).size, bugs: detectSwiftBugs(content) };
		case 'referenceColorsKotlin':
			return { renames: detectRenamesInReference(content).size, bugs: detectKotlinColorBugs(content) };
		case 'referenceTypographySwift':
			return { renames: 0, bugs: [] };
		case 'referenceTypographyKotlin':
			return { renames: 0, bugs: detectKotlinTypoBugs(content) };
		default:
			return EMPTY;
	}
}

function webValidation(content: string): ValidationSummary {
	return { renames: detectRenamesInReference(content).size, bugs: [] };
}

/**
 * Aggregate validation summaries across all reference slots into a single
 * set of counts for display near the Generate button.
 */
export function aggregateValidation(
	validations: Partial<Record<DropZoneKey, ValidationSummary>>
): { totalRenames: number; totalBugs: number; bugMessages: string[] } {
	let totalRenames = 0;
	let totalBugs = 0;
	const bugMessages: string[] = [];
	for (const v of Object.values(validations)) {
		if (!v) continue;
		totalRenames += v.renames;
		totalBugs += v.bugs.length;
		bugMessages.push(...v.bugs);
	}
	return { totalRenames, totalBugs, bugMessages };
}
