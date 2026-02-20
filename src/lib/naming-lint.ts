/**
 * Naming convention linting.
 *
 * Validates token names against configurable rules per platform.
 * Built-in rule sets for web (kebab-case), iOS (camelCase), Android (camelCase).
 */

import { walkAllTokens } from './resolve-tokens.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LintSeverity = 'error' | 'warning';

export interface NamingRule {
	id: string;
	case?: 'kebab' | 'camel' | 'snake' | 'screaming' | 'pascal';
	pattern?: RegExp;
	prefix?: string;
	maxDepth?: number;
	severity: LintSeverity;
}

export interface NamingRuleConfig {
	rules: NamingRule[];
}

export interface LintResult {
	token: string;
	rule: string;
	message: string;
	severity: LintSeverity;
}

// ─── Built-in Rule Sets ───────────────────────────────────────────────────────

export const WEB_RULES: NamingRule[] = [
	{ id: 'web-kebab', case: 'kebab', severity: 'error' },
	{ id: 'web-no-deep', maxDepth: 5, severity: 'warning' },
];

export const IOS_RULES: NamingRule[] = [
	{ id: 'ios-camel', case: 'camel', severity: 'error' },
	{ id: 'ios-no-deep', maxDepth: 5, severity: 'warning' },
];

export const ANDROID_RULES: NamingRule[] = [
	{ id: 'android-camel', case: 'camel', severity: 'error' },
	{ id: 'android-no-deep', maxDepth: 5, severity: 'warning' },
];

export function getRuleSet(platform: string): NamingRule[] {
	switch (platform) {
		case 'web':
			return WEB_RULES;
		case 'ios':
			return IOS_RULES;
		case 'android':
			return ANDROID_RULES;
		default:
			return WEB_RULES;
	}
}

// ─── Case Validators ──────────────────────────────────────────────────────────

const CASE_PATTERNS: Record<string, RegExp> = {
	kebab: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
	camel: /^[a-z][a-zA-Z0-9]*$/,
	snake: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
	screaming: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
	pascal: /^[A-Z][a-zA-Z0-9]*$/,
};

function matchesCase(name: string, caseType: string): boolean {
	const pattern = CASE_PATTERNS[caseType];
	return pattern ? pattern.test(name) : true;
}

// ─── Lint Engine ──────────────────────────────────────────────────────────────

function tokenPathToName(path: string[]): string {
	return path
		.filter((p) => p.toLowerCase() !== 'standard')
		.map((p) => p.toLowerCase().replace(/\s+/g, '-'))
		.join('-');
}

export function lintTokenNames(
	tokenExport: Record<string, unknown>,
	rules: NamingRule[]
): LintResult[] {
	const results: LintResult[] = [];
	const tokenNames: { name: string; path: string[] }[] = [];

	walkAllTokens(tokenExport, (path, _token, _type) => {
		tokenNames.push({ name: tokenPathToName(path), path });
	});

	for (const { name, path } of tokenNames) {
		for (const rule of rules) {
			if (rule.case && !matchesCase(name, rule.case)) {
				results.push({
					token: name,
					rule: rule.id,
					message: `Token "${name}" does not match ${rule.case} naming convention`,
					severity: rule.severity
				});
			}

			if (rule.pattern && !rule.pattern.test(name)) {
				results.push({
					token: name,
					rule: rule.id,
					message: `Token "${name}" does not match pattern ${rule.pattern}`,
					severity: rule.severity
				});
			}

			if (rule.prefix && !name.startsWith(rule.prefix)) {
				results.push({
					token: name,
					rule: rule.id,
					message: `Token "${name}" missing required prefix "${rule.prefix}"`,
					severity: rule.severity
				});
			}

			if (rule.maxDepth && path.length > rule.maxDepth) {
				results.push({
					token: name,
					rule: rule.id,
					message: `Token "${name}" exceeds max depth of ${rule.maxDepth} (actual: ${path.length})`,
					severity: rule.severity
				});
			}
		}
	}

	return results;
}

export function lintSummary(results: LintResult[]): { errors: number; warnings: number } {
	return {
		errors: results.filter((r) => r.severity === 'error').length,
		warnings: results.filter((r) => r.severity === 'warning').length
	};
}
