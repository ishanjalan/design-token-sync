import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	entry: ['src/routes/**/*.svelte', 'src/routes/**/+*.ts'],
	project: ['src/**/*.{ts,svelte}'],
	ignoreDependencies: ['@primer/primitives', '@types/diff']
};

export default config;
