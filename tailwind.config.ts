import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
				mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
			},
			colors: {
				brand: {
					50: '#eff6ff',
					100: '#dbeafe',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					900: '#0f172a',
				},
				surface: {
					DEFAULT: '#ffffff',
					subtle: '#f8fafc',
					muted: '#f1f5f9',
					border: '#e2e8f0',
				},
				deforestation: '#D32F2F',
				degradation: '#F57C00',
				regrowth: '#00C853',
				aoi: '#FFD600',
			},
		},
	},
	plugins: [],
};

export default config;
