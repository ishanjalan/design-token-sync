export type Platform = 'web' | 'ios' | 'android';

export interface BestPracticeAdvice {
	id: string;
	platform: Platform;
	severity: 'info' | 'suggestion' | 'recommended';
	title: string;
	description: string;
	learnMoreUrl?: string;
}

export function analyzeReferenceFiles(
	referenceContent: Record<string, string>,
	platforms: Platform[]
): BestPracticeAdvice[] {
	const advice: BestPracticeAdvice[] = [];

	if (platforms.includes('web')) {
		const webContent = Object.entries(referenceContent)
			.filter(([name]) => /\.(scss|css|ts)$/.test(name))
			.map(([, content]) => content)
			.join('\n');

		if (webContent) {
			if (!/@layer\s+tokens/.test(webContent)) {
				advice.push({
					id: 'web-layer-tokens',
					platform: 'web',
					severity: 'recommended',
					title: 'Wrap CSS tokens in @layer',
					description: 'Wrap CSS custom properties in `@layer tokens { ... }` for cascade control. This prevents specificity conflicts when consumers override token values.'
				});
			}

			if (!/light-dark\s*\(/.test(webContent)) {
				advice.push({
					id: 'web-light-dark',
					platform: 'web',
					severity: 'suggestion',
					title: 'Use light-dark() for themes',
					description: 'The `light-dark()` CSS function (Baseline 2024) simplifies theme-aware custom properties. Replace `@media (prefers-color-scheme)` with `light-dark()` in `:root`.'
				});
			}

			if (!/@property\s+--/.test(webContent)) {
				advice.push({
					id: 'web-property',
					platform: 'web',
					severity: 'suggestion',
					title: 'Add @property declarations',
					description: 'CSS `@property` with `syntax: "<color>"` enables transitions on custom properties and provides browser DevTools type info.'
				});
			}

			if (/#[0-9a-fA-F]{6}/.test(webContent) && /\$[\w-]+/.test(webContent)) {
				const hexCount = (webContent.match(/#[0-9a-fA-F]{6}/g) || []).length;
				const varCount = (webContent.match(/\$[\w-]+/g) || []).length;
				if (hexCount > varCount * 0.3) {
					advice.push({
						id: 'web-hardcoded-hex',
						platform: 'web',
						severity: 'info',
						title: 'Replace hardcoded hex values',
						description: 'Many raw hex values detected in semantic layer. Reference primitive token variables instead for consistency and maintainability.'
					});
				}
			}
		}
	}

	if (platforms.includes('ios')) {
		const swiftContent = Object.entries(referenceContent)
			.filter(([name]) => /\.swift$/.test(name))
			.map(([, content]) => content)
			.join('\n');

		if (swiftContent) {
			if (!/DynamicTypeSize|@ScaledMetric|calculateFontSize/.test(swiftContent)) {
				advice.push({
					id: 'ios-dynamic-type',
					platform: 'ios',
					severity: 'recommended',
					title: 'Support Dynamic Type',
					description: 'Add Dynamic Type support for accessibility. Use `@ScaledMetric`, `DynamicTypeSize`, or a custom `calculateFontSize` method to scale fonts with system settings.'
				});
			}

			const fileCount = Object.keys(referenceContent).filter((n) => /\.swift$/.test(n)).length;
			if (fileCount <= 1) {
				advice.push({
					id: 'ios-split-layers',
					platform: 'ios',
					severity: 'suggestion',
					title: 'Split into primitive/semantic layers',
					description: 'Consider splitting colors into primitive and semantic layers for better maintainability and reuse across themes.'
				});
			}
		}
	}

	if (platforms.includes('android')) {
		const kotlinContent = Object.entries(referenceContent)
			.filter(([name]) => /\.kt$/.test(name))
			.map(([, content]) => content)
			.join('\n');

		if (kotlinContent) {
			if (!/@Immutable|@Stable/.test(kotlinContent)) {
				advice.push({
					id: 'android-stability',
					platform: 'android',
					severity: 'recommended',
					title: 'Add Compose stability annotations',
					description: 'Add `@Immutable` or `@Stable` annotations to token classes for better Compose recomposition performance.'
				});
			}

			if (!/compositionLocalOf|CompositionLocal/.test(kotlinContent)) {
				advice.push({
					id: 'android-composition-local',
					platform: 'android',
					severity: 'suggestion',
					title: 'Use CompositionLocal for theming',
					description: 'Use `compositionLocalOf` to propagate the token theme through the Compose tree. This is the idiomatic approach for Material3 custom themes.'
				});
			}

			const ktFileCount = Object.keys(referenceContent).filter((n) => /\.kt$/.test(n)).length;
			if (ktFileCount <= 1) {
				advice.push({
					id: 'android-split-categories',
					platform: 'android',
					severity: 'suggestion',
					title: 'Split semantic colors into categories',
					description: 'Consider splitting semantic colors into category files (text, fill, icon, border) for better modularity and reduced merge conflicts.'
				});
			}
		}
	}

	return advice;
}
