import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
	title: 'SICAM — Sistema de Carta-Imagem e Análise Multitemporal',
	description:
		'Plataforma institucional Zero Trust (SIRGAS 2000 EPSG:4674) para análise multitemporal Sentinel-2, curadoria auditável e emissão de cartas-imagem em 300 DPI.',
	icons: {
		icon: '/favicon.svg',
	},
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="pt-BR">
			<body className="min-h-screen bg-surface-subtle text-slate-900 antialiased">{children}</body>
		</html>
	);
}
