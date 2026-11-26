'use client';

import type { Feature, FeatureCollection } from 'geojson';
import { MapPinned } from 'lucide-react';
import type { GeoJSONSource, Map as MapLibreMapInstance, MapLayerMouseEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { computePolygonBbox } from '@/lib/geo/aoiGeometry';
import {
	BASEMAP_LABELS,
	type BasemapVariant,
	buildBasemapStyle,
	DEFAULT_RONDONIA_VIEW,
} from '@/lib/geo/mapStyles';
import { cn } from '@/lib/utils/cn';
import type { AoiPolygonGeoJson } from '@/types/api';

export interface CasesOverviewMapItem {
	id: string;
	protocolCode: string;
	title: string;
	aoiGeoJson: AoiPolygonGeoJson;
}

export interface CasesOverviewMapProps {
	cases: readonly CasesOverviewMapItem[];
	selectedCaseId?: string | null;
	focusCaseId?: string | null;
	focusTrigger?: number;
	onSelectCase?: (caseId: string) => void;
	title?: string;
	heightClassName?: string;
}

const OVERVIEW_SOURCE_ID = 'sicam-cases-overview-source';

function installCasesOverviewLayers(
	map: MapLibreMapInstance,
	initialData: FeatureCollection,
) {
	if (map.getSource(OVERVIEW_SOURCE_ID)) {
		return;
	}

	map.addSource(OVERVIEW_SOURCE_ID, {
		type: 'geojson',
		data: initialData,
	});

	map.addLayer({
		id: 'sicam-cases-fill',
		type: 'fill',
		source: OVERVIEW_SOURCE_ID,
		paint: {
			'fill-color': [
				'case',
				['boolean', ['get', 'selected'], false],
				'#f59e0b',
				'#0ea5e9',
			],
			'fill-opacity': [
				'case',
				['boolean', ['get', 'selected'], false],
				0.35,
				0.2,
			],
		},
	});

	map.addLayer({
		id: 'sicam-cases-line',
		type: 'line',
		source: OVERVIEW_SOURCE_ID,
		paint: {
			'line-color': [
				'case',
				['boolean', ['get', 'selected'], false],
				'#fbbf24',
				'#38bdf8',
			],
			'line-width': [
				'case',
				['boolean', ['get', 'selected'], false],
				3,
				2,
			],
		},
	});
}

function computeCombinedBounds(
	items: readonly CasesOverviewMapItem[],
): [number, number, number, number] | null {
	let minLon = Number.POSITIVE_INFINITY;
	let minLat = Number.POSITIVE_INFINITY;
	let maxLon = Number.NEGATIVE_INFINITY;
	let maxLat = Number.NEGATIVE_INFINITY;
	let found = false;

	for (const item of items) {
		const bbox = computePolygonBbox(item.aoiGeoJson);
		if (!bbox) continue;
		found = true;
		if (bbox[0] < minLon) minLon = bbox[0];
		if (bbox[1] < minLat) minLat = bbox[1];
		if (bbox[2] > maxLon) maxLon = bbox[2];
		if (bbox[3] > maxLat) maxLat = bbox[3];
	}

	return found ? [minLon, minLat, maxLon, maxLat] : null;
}

export function CasesOverviewMap({
	cases,
	selectedCaseId = null,
	focusCaseId = null,
	focusTrigger = 0,
	onSelectCase,
	title = 'Distribuição Espacial das AOIs',
	heightClassName = 'h-[340px]',
}: CasesOverviewMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMapInstance | null>(null);
	const [basemap, setBasemap] = useState<BasemapVariant>('satellite');
	const [webglUnavailable, setWebglUnavailable] = useState(false);

	const onSelectRef = useRef(onSelectCase);
	onSelectRef.current = onSelectCase;

	const buildFeatureCollection = useCallback((): FeatureCollection => {
		const features: Feature[] = cases.map((item) => ({
			type: 'Feature',
			properties: {
				id: item.id,
				protocolCode: item.protocolCode,
				title: item.title,
				selected: selectedCaseId === item.id,
			},
			geometry: item.aoiGeoJson,
		}));

		return {
			type: 'FeatureCollection',
			features,
		};
	}, [cases, selectedCaseId]);

	const latestDataRef = useRef<FeatureCollection>({
		type: 'FeatureCollection',
		features: [],
	});
	latestDataRef.current = buildFeatureCollection();

	useEffect(() => {
		if (!containerRef.current || typeof window === 'undefined') {
			return;
		}

		let disposed = false;
		let instance: MapLibreMapInstance | null = null;

		void (async () => {
			try {
				const { Map: MapLibreMap, NavigationControl, ScaleControl } = await import(
					'maplibre-gl'
				);
				if (disposed || !containerRef.current) return;

				instance = new MapLibreMap({
					container: containerRef.current,
					style: buildBasemapStyle('satellite'),
					center: DEFAULT_RONDONIA_VIEW.center,
					zoom: DEFAULT_RONDONIA_VIEW.zoom,
					attributionControl: false,
				});

				instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
				instance.addControl(
					new ScaleControl({ maxWidth: 100, unit: 'metric' }),
					'bottom-right',
				);

				instance.on('style.load', () => {
					if (!instance) return;
					installCasesOverviewLayers(instance, latestDataRef.current);
				});

				instance.on('click', 'sicam-cases-fill', (event: MapLayerMouseEvent) => {
					const clickedId = event.features?.[0]?.properties?.id;
					if (typeof clickedId === 'string') {
						onSelectRef.current?.(clickedId);
					}
				});

				instance.on('mouseenter', 'sicam-cases-fill', () => {
					if (instance) instance.getCanvas().style.cursor = 'pointer';
				});

				instance.on('mouseleave', 'sicam-cases-fill', () => {
					if (instance) instance.getCanvas().style.cursor = '';
				});

				mapRef.current = instance;
			} catch {
				if (!disposed) {
					setWebglUnavailable(true);
				}
			}
		})();

		return () => {
			disposed = true;
			if (instance) {
				instance.remove();
				mapRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		map.setStyle(buildBasemapStyle(basemap));
	}, [basemap]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !map.isStyleLoaded()) return;
		installCasesOverviewLayers(map, latestDataRef.current);
		const src = map.getSource(OVERVIEW_SOURCE_ID) as GeoJSONSource | undefined;
		src?.setData(latestDataRef.current);
	});

	// Enquadra todas as AOIs listadas quando o conjunto muda
	useEffect(() => {
		const map = mapRef.current;
		if (!map || cases.length === 0) return;
		const combined = computeCombinedBounds(cases);
		if (!combined) return;
		map.fitBounds(
			[
				[combined[0], combined[1]],
				[combined[2], combined[3]],
			],
			{ padding: 48, maxZoom: 14, duration: 500 },
		);
	}, [cases]);

	// Enquadra caso específico solicitado pelo botão "Mapa" na tabela
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !focusCaseId || focusTrigger <= 0) return;
		const target = cases.find((c) => c.id === focusCaseId);
		const bbox = computePolygonBbox(target?.aoiGeoJson);
		if (!bbox) return;
		map.fitBounds(
			[
				[bbox[0], bbox[1]],
				[bbox[2], bbox[3]],
			],
			{ padding: 56, maxZoom: 15, duration: 650 },
		);
	}, [cases, focusCaseId, focusTrigger]);

	return (
		<Card className="overflow-hidden">
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 bg-slate-50/80 py-3">
				<CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
					<MapPinned className="h-4 w-4 text-brand-600" aria-hidden="true" />
					{title}
				</CardTitle>

				<div className="flex items-center gap-1">
					{(Object.keys(BASEMAP_LABELS) as BasemapVariant[]).map((variant) => (
						<button
							key={variant}
							type="button"
							onClick={() => setBasemap(variant)}
							className={cn(
								'rounded border px-2 py-0.5 text-[11px] font-medium transition-colors',
								basemap === variant
									? 'border-brand-600 bg-brand-600 text-white'
									: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
							)}
						>
							{BASEMAP_LABELS[variant]}
						</button>
					))}
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{webglUnavailable ? (
					<div className="flex items-center justify-center bg-slate-900 px-6 py-10 text-xs text-slate-300">
						Visualização cartográfica WebGL indisponível neste dispositivo ({cases.length} AOI(s) carregada(s)).
					</div>
				) : (
					<div ref={containerRef} className={cn('w-full bg-slate-900', heightClassName)} />
				)}
			</CardContent>
		</Card>
	);
}
