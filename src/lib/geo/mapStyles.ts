import type { StyleSpecification } from 'maplibre-gl';

export type BasemapVariant = 'satellite' | 'osm' | 'offline_dark';

export const BASEMAP_LABELS: Record<BasemapVariant, string> = {
	satellite: 'Satélite (Mosaico Óptico)',
	osm: 'Cartográfico (OpenStreetMap)',
	offline_dark: 'Grade Vetorial Offline',
};

// Centro padrão inicial focado em Rondônia (SIRGAS 2000 / Amazônia Ocidental)
export const DEFAULT_RONDONIA_VIEW = {
	center: [-62.8, -10.8] as [number, number],
	zoom: 6.2,
} as const;

/**
 * Constrói um StyleSpecification compatível com MapLibre GL sem depender de API keys privadas,
 * incluindo modo offline resiliente quando não houver acesso a servidores de tiles externos.
 */
export function buildBasemapStyle(variant: BasemapVariant): StyleSpecification {
	if (variant === 'offline_dark') {
		return {
			version: 8,
			sources: {},
			layers: [
				{
					id: 'sicam-bg-offline',
					type: 'background',
					paint: {
						'background-color': '#0f172a',
					},
				},
			],
		};
	}

	if (variant === 'osm') {
		return {
			version: 8,
			sources: {
				'sicam-osm-raster': {
					type: 'raster',
					tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
					tileSize: 256,
					maxzoom: 19,
					attribution: '© OpenStreetMap contributors',
				},
			},
			layers: [
				{
					id: 'sicam-bg-osm',
					type: 'background',
					paint: {
						'background-color': '#e2e8f0',
					},
				},
				{
					id: 'sicam-osm-layer',
					type: 'raster',
					source: 'sicam-osm-raster',
				},
			],
		};
	}

	return {
		version: 8,
		sources: {
			'sicam-esri-world-imagery': {
				type: 'raster',
				tiles: [
					'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
				],
				tileSize: 256,
				maxzoom: 18,
				attribution: 'Tiles © Esri — World Imagery',
			},
		},
		layers: [
			{
				id: 'sicam-bg-sat',
				type: 'background',
				paint: {
					'background-color': '#0b1324',
				},
			},
			{
				id: 'sicam-sat-layer',
				type: 'raster',
				source: 'sicam-esri-world-imagery',
			},
		],
	};
}
