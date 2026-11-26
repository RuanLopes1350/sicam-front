import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	esbuild: {
		jsx: 'automatic',
	},
	resolve: {
		alias: {
			'@': path.resolve(rootDir, 'src'),
		},
	},
	test: {
		environment: 'node',
		globals: false,
		include: ['tests/**/*.test.{ts,tsx}'],
		testTimeout: 15000,
	},
});
