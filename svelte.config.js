import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			runtime: 'nodejs22.x'
		}),
		version: {
			name: new Date().toISOString(),
			pollInterval: 60_000
		}
	}
};

export default config;
