'use client';

import type { Feature, FeatureCollection } from 'geojson';
import {
	Check,
	FileCode2,
	Hand,
	Layers,
	Pentagon,
	Square,
	Trash2,
	Undo2,
} from 'lucide-react';
import type { GeoJSONSource, Map as MapLibreMapInstance, MapMouseEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
	buildClosedPolygonFromVertices,
	buildRectanglePolygon,
	computePolygonBbox,
	roundCoord,
} from '@/lib/geo/aoiGeometry';
import {
	BASEMAP_LABELS,
	type BasemapVariant,
	buildBasemapStyle,
	DEFAULT_RONDONIA_VIEW,
} from '@/lib/geo/mapStyles';
import { cn } from '@/lib/utils/cn';
import type { AoiPolygonGeoJson } from '@/types/api';

export type DrawingToolMode = 'pan' | 'rectangle' | 'polygon';

export interface AoiDrawingMapProps {
	aoi: AoiPolygonGeoJson | null;
	isValidAoi: boolean;
	municipalityBbox: [number, number, number, number] | null;
	focusBounds: [number, number, number, number] | null;
	focusSequence: number;
	onChangeAoi: (nextAoi: AoiPolygonGeoJson | null) => void;
	onOpenGeoJsonModal: () => void;
}

const SOURCE_ID = 'sicam-aoi-draw-source';

function installVectorOverlayLayers(
	map: MapLibreMapInstance,
	emptyData: FeatureCollection,
): void {
	if (map.getSource(SOURCE_ID)) {
		return;
	}

	map.addSource(SOURCE_ID, {
		type: 'geojson',
		data: emptyData,
	});

	map.addLayer({
		id: 'sicam-mun-bbox-outline',
		type: 'line',
		source: SOURCE_ID,
		filter: ['==', ['get', 'kind'], 'mun_bbox'],
		paint: {
			'line-color': '#38bdf8',
			'line-width': 1.75,
			'line-dasharray': [3, 2],
		},
	});

	map.addLayer({
		id: 'sicam-aoi-fill',
		type: 'fill',
		source: SOURCE_ID,
		filter: ['==', ['get', 'kind'], 'aoi_polygon'],
		paint: {
			'fill-color': [
				'case',
				['boolean', ['get', 'valid'], true],
				'#10b981',
				'#ef4444',
			],
			'fill-opacity': 0.25,
		},
	});

	map.addLayer({
		id: 'sicam-aoi-outline',
		type: 'line',
		source: SOURCE_ID,
		filter: ['==', ['get', 'kind'], 'aoi_polygon'],
		paint: {
			'line-color': [
				'case',
				['boolean', ['get', 'valid'], true],
				'#34d399',
				'#f87171',
			],
			'line-width': 2.5,
		},
	});

	map.addLayer({
		id: 'sicam-draft-line',
		type: 'line',
		source: SOURCE_ID,
		filter: ['==', ['get', 'kind'], 'draft_line'],
		paint: {
			'line-color': '#fbbf24',
			'line-width': 2,
			'line-dasharray': [2, 2],
		},
	});

	map.addLayer({
		id: 'sicam-vertex-points',
		type: 'circle',
		source: SOURCE_ID,
		filter: ['==', ['get', 'kind'], 'vertex'],
		paint: {
			'circle-radius': 4.5,
			'circle-color': '#ffffff',
			'circle-stroke-width': 2,
			'circle-stroke-color': '#0284c7',
		},
	});
}

export function AoiDrawingMap({
	aoi,
	isValidAoi,
	municipalityBbox,
	focusBounds,
	focusSequence,
	onChangeAoi,
	onOpenGeoJsonModal,
}: AoiDrawingMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMapInstance | null>(null);

	const [basemap, setBasemap] = useState<BasemapVariant>('satellite');
	const [toolMode, setToolMode] = useState<DrawingToolMode>('rectangle');
	const [rectStart, setRectStart] = useState<[number, number] | null>(null);
	const [draftVertices, setDraftVertices] = useState<[number, number][]>([]);
	const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);
	const [webglError, setWebglError] = useState<string | null>(null);

	// Refs espelhadas para handlers imperativos de eventos do MapLibre
	const stateRef = useRef({
		toolMode,
		rectStart,
		draftVertices,
		onChangeAoi,
	});
	stateRef.current = { toolMode, rectStart, draftVertices, onChangeAoi };

	const buildOverlayGeoJson = useCallback((): FeatureCollection => {
		const features: Feature[] = [];

		if (municipalityBbox) {
			const [minLon, minLat, maxLon, maxLat] = municipalityBbox;
			features.push({
				type: 'Feature',
				properties: { kind: 'mun_bbox' },
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[minLon, minLat],
							[maxLon, minLat],
							[maxLon, maxLat],
							[minLon, maxLat],
							[minLon, minLat],
						],
					],
				},
			});
		}

		// Quadrante em arrasto/segundo clique
		const previewRect =
			toolMode === 'rectangle' && rectStart && cursorCoord
				? buildRectanglePolygon(rectStart, cursorCoord)
				: null;

		const activePolygon = previewRect ?? aoi;
		if (activePolygon) {
			features.push({
				type: 'Feature',
				properties: {
					kind: 'aoi_polygon',
					valid: previewRect ? true : isValidAoi,
				},
				geometry: activePolygon,
			});

			const ring = activePolygon.coordinates[0] ?? [];
			for (let i = 0; i < Math.max(0, ring.length - 1); i++) {
				const pt = ring[i];
				if (pt) {
					features.push({
						type: 'Feature',
						properties: { kind: 'vertex' },
						geometry: { type: 'Point', coordinates: pt },
					});
				}
			}
		}

		// Polígono livre em construção
		if (toolMode === 'polygon' && draftVertices.length > 0) {
			const linePts = cursorCoord ? [...draftVertices, cursorCoord] : [...draftVertices];
			if (linePts.length >= 2) {
				features.push({
					type: 'Feature',
					properties: { kind: 'draft_line' },
					geometry: {
						type: 'LineString',
						coordinates: linePts,
					},
				});
			}

			for (const pt of draftVertices) {
				features.push({
					type: 'Feature',
					properties: { kind: 'vertex' },
					geometry: { type: 'Point', coordinates: pt },
				});
			}
		}

		if (toolMode === 'rectangle' && rectStart) {
			features.push({
				type: 'Feature',
				properties: { kind: 'vertex' },
				geometry: { type: 'Point', coordinates: rectStart },
			});
		}

		return {
			type: 'FeatureCollection',
			features,
		};
	}, [aoi, cursorCoord, draftVertices, isValidAoi, municipalityBbox, rectStart, toolMode]);

	const latestOverlayRef = useRef<FeatureCollection>({
		type: 'FeatureCollection',
		features: [],
	});
	latestOverlayRef.current = buildOverlayGeoJson();

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
				if (disposed || !containerRef.current) {
					return;
				}

				instance = new MapLibreMap({
					container: containerRef.current,
					style: buildBasemapStyle('satellite'),
					center: DEFAULT_RONDONIA_VIEW.center,
					zoom: DEFAULT_RONDONIA_VIEW.zoom,
					attributionControl: false,
				});

				instance.addControl(new NavigationControl({ showCompass: true }), 'top-right');
				instance.addControl(
					new ScaleControl({ maxWidth: 120, unit: 'metric' }),
					'bottom-right',
				);

				instance.on('style.load', () => {
					if (!instance) return;
					installVectorOverlayLayers(instance, latestOverlayRef.current);
				});

				instance.on('mousemove', (event: MapMouseEvent) => {
					setCursorCoord([
						roundCoord(event.lngLat.lng),
						roundCoord(event.lngLat.lat),
					]);
				});

				instance.on('click', (event: MapMouseEvent) => {
					const pt: [number, number] = [
						roundCoord(event.lngLat.lng),
						roundCoord(event.lngLat.lat),
					];
					const current = stateRef.current;

					if (current.toolMode === 'rectangle') {
						if (!current.rectStart) {
							setRectStart(pt);
							current.onChangeAoi(null);
						} else {
							const built = buildRectanglePolygon(current.rectStart, pt);
							setRectStart(null);
							if (built) {
								current.onChangeAoi(built);
								setToolMode('pan');
							}
						}
						return;
					}

					if (current.toolMode === 'polygon') {
						setDraftVertices((prev) => [...prev, pt]);
						current.onChangeAoi(null);
					}
				});

				instance.on('dblclick', (event: MapMouseEvent) => {
					const current = stateRef.current;
					if (current.toolMode === 'polygon' && current.draftVertices.length >= 3) {
						event.preventDefault();
						const built = buildClosedPolygonFromVertices(current.draftVertices);
						if (built) {
							setDraftVertices([]);
							current.onChangeAoi(built);
							setToolMode('pan');
						}
					}
				});

				mapRef.current = instance;
			} catch {
				if (!disposed) {
					setWebglError(
						'Contexto WebGL indisponível neste navegador/ambiente. Utilize o botão "Importar GeoJSON" para informar a AOI.',
					);
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

	// Sincroniza estilo base ao trocar satélite / OSM / offline
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		map.setStyle(buildBasemapStyle(basemap));
	}, [basemap]);

	// Sincroniza cursor e doubleClickZoom conforme ferramenta ativa
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		const canvas = map.getCanvas();
		canvas.style.cursor = toolMode === 'pan' ? '' : 'crosshair';
		if (toolMode === 'pan') {
			map.doubleClickZoom.enable();
		} else {
			map.doubleClickZoom.disable();
		}
	}, [toolMode]);

	// Atualiza fonte GeoJSON a cada movimento/clique
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !map.isStyleLoaded()) {
			return;
		}
		installVectorOverlayLayers(map, latestOverlayRef.current);
		const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
		src?.setData(latestOverlayRef.current);
	});

	// Enquadra município IBGE ou GeoJSON recém-importado
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !focusBounds || focusSequence <= 0) {
			return;
		}
		const [minLon, minLat, maxLon, maxLat] = focusBounds;
		map.fitBounds(
			[
				[minLon, minLat],
				[maxLon, maxLat],
			],
			{ padding: 52, maxZoom: 15, duration: 750 },
		);
	}, [focusBounds, focusSequence]);

	function handleFinishPolygon() {
		const built = buildClosedPolygonFromVertices(draftVertices);
		if (built) {
			setDraftVertices([]);
			onChangeAoi(built);
			setToolMode('pan');
		}
	}

	function handleClearAll() {
		setRectStart(null);
		setDraftVertices([]);
		onChangeAoi(null);
	}

	function handleFitCurrentAoi() {
		const bbox = computePolygonBbox(aoi);
		const map = mapRef.current;
		if (!bbox || !map) return;
		map.fitBounds(
			[
				[bbox[0], bbox[1]],
				[bbox[2], bbox[3]],
			],
			{ padding: 56, maxZoom: 15, duration: 600 },
		);
	}

	return (
		<Card className="overflow-hidden">
			<CardHeader className="space-y-3 bg-slate-50/80 pb-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Layers className="h-4 w-4 text-brand-600" aria-hidden="true" />
						Carta WebGL de Delimitação da Área de Interesse (AOI)
					</CardTitle>

					<div className="flex items-center gap-1.5">
						{(Object.keys(BASEMAP_LABELS) as BasemapVariant[]).map((variant) => (
							<button
								key={variant}
								type="button"
								onClick={() => setBasemap(variant)}
								className={cn(
									'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
									basemap === variant
										? 'border-brand-600 bg-brand-600 text-white'
										: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
								)}
							>
								{BASEMAP_LABELS[variant]}
							</button>
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<Button
							size="sm"
							variant={toolMode === 'pan' ? 'secondary' : 'outline'}
							onClick={() => {
								setToolMode('pan');
								setRectStart(null);
							}}
						>
							<Hand className="h-3.5 w-3.5" aria-hidden="true" />
							Navegar
						</Button>

						<Button
							size="sm"
							variant={toolMode === 'rectangle' ? 'primary' : 'outline'}
							onClick={() => {
								setToolMode('rectangle');
								setRectStart(null);
								setDraftVertices([]);
							}}
						>
							<Square className="h-3.5 w-3.5" aria-hidden="true" />
							Quadrante (2 cliques)
						</Button>

						<Button
							size="sm"
							variant={toolMode === 'polygon' ? 'primary' : 'outline'}
							onClick={() => {
								setToolMode('polygon');
								setRectStart(null);
								setDraftVertices([]);
							}}
						>
							<Pentagon className="h-3.5 w-3.5" aria-hidden="true" />
							Polígono Livre
						</Button>

						<Button size="sm" variant="outline" onClick={onOpenGeoJsonModal}>
							<FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
							Importar GeoJSON
						</Button>
					</div>

					<div className="flex flex-wrap items-center gap-1.5">
						{toolMode === 'polygon' && draftVertices.length >= 1 ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() => setDraftVertices((prev) => prev.slice(0, -1))}
							>
								<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
								Desfazer vértice
							</Button>
						) : null}

						{toolMode === 'polygon' && draftVertices.length >= 3 ? (
							<Button size="sm" variant="primary" onClick={handleFinishPolygon}>
								<Check className="h-3.5 w-3.5" aria-hidden="true" />
								Fechar Polígono ({draftVertices.length} pts)
							</Button>
						) : null}

						{aoi ? (
							<Button size="sm" variant="ghost" onClick={handleFitCurrentAoi}>
								Centralizar AOI
							</Button>
						) : null}

						{aoi || draftVertices.length > 0 || rectStart ? (
							<Button size="sm" variant="danger" onClick={handleClearAll}>
								<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
								Limpar
							</Button>
						) : null}
					</div>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{webglError ? (
					<div className="p-4">
						<AlertBanner
							variant="warning"
							title="Modo sem aceleração WebGL"
							message={webglError}
						/>
					</div>
				) : null}

				<div className="relative h-[480px] w-full bg-slate-900">
					<div ref={containerRef} className="h-full w-full" />

					<div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-950/80 px-2.5 py-1 font-mono text-[11px] text-slate-100 shadow">
						<span>
							{cursorCoord
								? `SIRGAS 2000: ${cursorCoord[1].toFixed(5)}°, ${cursorCoord[0].toFixed(5)}°`
								: 'Mova o cursor sobre a carta'}
						</span>
						<span className="text-slate-400">•</span>
						<span className="text-amber-300">
							{toolMode === 'rectangle'
								? rectStart
									? 'Clique no canto oposto para concluir o quadrante'
									: 'Clique no 1º canto do quadrante'
								: toolMode === 'polygon'
									? `Clique nos vértices (${draftVertices.length} adicionados; duplo clique fecha)`
									: 'Arraste para mover ou use o scroll para zoom'}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
