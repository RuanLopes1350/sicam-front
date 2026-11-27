'use client';

import type { FeatureCollection } from 'geojson';
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
	type AoiOverlayToolMode,
	buildAoiOverlayFeatureCollection,
} from '@/lib/geo/aoiDraftOverlay';
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

export type DrawingToolMode = AoiOverlayToolMode;

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
const CLOSE_SNAP_THRESHOLD_PX = 14;

function installVectorOverlayLayers(
	map: MapLibreMapInstance,
	initialData: FeatureCollection,
): void {
	if (!map.getSource(SOURCE_ID)) {
		map.addSource(SOURCE_ID, {
			type: 'geojson',
			data: initialData,
		});
	}

	if (!map.getLayer('sicam-mun-bbox-outline')) {
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
	}

	if (!map.getLayer('sicam-aoi-fill')) {
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
	}

	if (!map.getLayer('sicam-aoi-outline-casing')) {
		map.addLayer({
			id: 'sicam-aoi-outline-casing',
			type: 'line',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'aoi_polygon'],
			paint: {
				'line-color': '#0f172a',
				'line-width': 4.5,
				'line-opacity': 0.85,
			},
		});
	}

	if (!map.getLayer('sicam-aoi-outline')) {
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
	}

	if (!map.getLayer('sicam-draft-fill')) {
		map.addLayer({
			id: 'sicam-draft-fill',
			type: 'fill',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'draft_fill'],
			paint: {
				'fill-color': '#facc15',
				'fill-opacity': 0.18,
			},
		});
	}

	if (!map.getLayer('sicam-draft-solid-casing')) {
		map.addLayer({
			id: 'sicam-draft-solid-casing',
			type: 'line',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'draft_solid_line'],
			layout: {
				'line-cap': 'round',
				'line-join': 'round',
			},
			paint: {
				'line-color': '#0f172a',
				'line-width': 5,
				'line-opacity': 0.85,
			},
		});
	}

	if (!map.getLayer('sicam-draft-solid-line')) {
		map.addLayer({
			id: 'sicam-draft-solid-line',
			type: 'line',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'draft_solid_line'],
			layout: {
				'line-cap': 'round',
				'line-join': 'round',
			},
			paint: {
				'line-color': '#facc15',
				'line-width': 2.75,
			},
		});
	}

	if (!map.getLayer('sicam-draft-rubber-casing')) {
		map.addLayer({
			id: 'sicam-draft-rubber-casing',
			type: 'line',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'draft_rubber_line'],
			paint: {
				'line-color': '#0f172a',
				'line-width': 4,
				'line-opacity': 0.75,
			},
		});
	}

	if (!map.getLayer('sicam-draft-rubber-line')) {
		map.addLayer({
			id: 'sicam-draft-rubber-line',
			type: 'line',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'draft_rubber_line'],
			paint: {
				'line-color': '#fde047',
				'line-width': 2.25,
				'line-dasharray': [2, 2],
			},
		});
	}

	if (!map.getLayer('sicam-vertex-points')) {
		map.addLayer({
			id: 'sicam-vertex-points',
			type: 'circle',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'vertex'],
			paint: {
				'circle-radius': 5,
				'circle-color': '#ffffff',
				'circle-stroke-width': 2.25,
				'circle-stroke-color': '#0284c7',
			},
		});
	}

	if (!map.getLayer('sicam-first-vertex-point')) {
		map.addLayer({
			id: 'sicam-first-vertex-point',
			type: 'circle',
			source: SOURCE_ID,
			filter: ['==', ['get', 'kind'], 'first_vertex'],
			paint: {
				'circle-radius': 7,
				'circle-color': '#facc15',
				'circle-stroke-width': 2.5,
				'circle-stroke-color': '#0f172a',
			},
		});
	}
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
	const styleReadyRef = useRef(false);
	const prevBasemapRef = useRef<BasemapVariant>('satellite');

	const [basemap, setBasemap] = useState<BasemapVariant>('satellite');
	const [toolMode, setToolMode] = useState<DrawingToolMode>('polygon');
	const [rectStart, setRectStart] = useState<[number, number] | null>(null);
	const [draftVertices, setDraftVertices] = useState<[number, number][]>([]);
	const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);
	const [webglError, setWebglError] = useState<string | null>(null);

	const stateRef = useRef({
		toolMode,
		aoi,
		isValidAoi,
		municipalityBbox,
		rectStart,
		draftVertices,
		cursorCoord,
		onChangeAoi,
	});
	stateRef.current = {
		toolMode,
		aoi,
		isValidAoi,
		municipalityBbox,
		rectStart,
		draftVertices,
		cursorCoord,
		onChangeAoi,
	};

	const buildOverlayGeoJson = useCallback(
		(overrides?: Partial<{
			toolMode: DrawingToolMode;
			aoi: AoiPolygonGeoJson | null;
			rectStart: [number, number] | null;
			draftVertices: ReadonlyArray<[number, number]>;
			cursorCoord: [number, number] | null;
		}>): FeatureCollection => {
			return buildAoiOverlayFeatureCollection({
				toolMode: overrides?.toolMode ?? toolMode,
				aoi: overrides && 'aoi' in overrides ? (overrides.aoi ?? null) : aoi,
				isValidAoi,
				municipalityBbox,
				rectStart:
					overrides && 'rectStart' in overrides ? (overrides.rectStart ?? null) : rectStart,
				draftVertices: overrides?.draftVertices ?? draftVertices,
				cursorCoord:
					overrides && 'cursorCoord' in overrides
						? (overrides.cursorCoord ?? null)
						: cursorCoord,
			});
		},
		[aoi, cursorCoord, draftVertices, isValidAoi, municipalityBbox, rectStart, toolMode],
	);

	const latestOverlayRef = useRef<FeatureCollection>({
		type: 'FeatureCollection',
		features: [],
	});
	latestOverlayRef.current = buildOverlayGeoJson();

	const syncMapOverlayNow = useCallback(
		(map: MapLibreMapInstance | null, collection: FeatureCollection) => {
			latestOverlayRef.current = collection;
			if (!map) return;
			try {
				if (!map.getSource(SOURCE_ID)) {
					if (!styleReadyRef.current) {
						return;
					}
					installVectorOverlayLayers(map, collection);
				}
				const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
				src?.setData(collection);
			} catch {
				// Estilo em transição: os eventos style.load/styledata reaplicam latestOverlayRef.current
			}
		},
		[],
	);

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

				const ensureLayersAndSync = () => {
					if (!instance) return;
					styleReadyRef.current = true;
					try {
						installVectorOverlayLayers(instance, latestOverlayRef.current);
						const src = instance.getSource(SOURCE_ID) as GeoJSONSource | undefined;
						src?.setData(latestOverlayRef.current);
					} catch {
						// Aguarda conclusão da árvore de estilo caso chamada durante styledata inicial
					}
				};

				instance.on('style.load', ensureLayersAndSync);
				instance.on('load', ensureLayersAndSync);
				instance.on('styledata', () => {
					if (!instance || styleReadyRef.current) return;
					if (instance.getStyle()) {
						ensureLayersAndSync();
					}
				});

				instance.on('mousemove', (event: MapMouseEvent) => {
					const pt: [number, number] = [
						roundCoord(event.lngLat.lng),
						roundCoord(event.lngLat.lat),
					];
					const current = stateRef.current;

					if (
						current.toolMode === 'rectangle' &&
						current.rectStart !== null
					) {
						const nextOverlay = buildAoiOverlayFeatureCollection({
							toolMode: current.toolMode,
							aoi: current.aoi,
							isValidAoi: current.isValidAoi,
							municipalityBbox: current.municipalityBbox,
							rectStart: current.rectStart,
							draftVertices: current.draftVertices,
							cursorCoord: pt,
						});
						syncMapOverlayNow(instance, nextOverlay);
					} else if (
						current.toolMode === 'polygon' &&
						current.draftVertices.length > 0
					) {
						const nextOverlay = buildAoiOverlayFeatureCollection({
							toolMode: current.toolMode,
							aoi: current.aoi,
							isValidAoi: current.isValidAoi,
							municipalityBbox: current.municipalityBbox,
							rectStart: current.rectStart,
							draftVertices: current.draftVertices,
							cursorCoord: pt,
						});
						syncMapOverlayNow(instance, nextOverlay);
					}

					setCursorCoord(pt);
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
							syncMapOverlayNow(
								instance,
								buildAoiOverlayFeatureCollection({
									toolMode: 'rectangle',
									aoi: null,
									isValidAoi: true,
									municipalityBbox: current.municipalityBbox,
									rectStart: pt,
									draftVertices: [],
									cursorCoord: pt,
								}),
							);
						} else {
							const built = buildRectanglePolygon(current.rectStart, pt);
							setRectStart(null);
							if (built) {
								current.onChangeAoi(built);
								setToolMode('pan');
								syncMapOverlayNow(
									instance,
									buildAoiOverlayFeatureCollection({
										toolMode: 'pan',
										aoi: built,
										isValidAoi: true,
										municipalityBbox: current.municipalityBbox,
										rectStart: null,
										draftVertices: [],
										cursorCoord: pt,
									}),
								);
							}
						}
						return;
					}

					if (current.toolMode === 'polygon') {
						if (current.draftVertices.length >= 3 && instance) {
							const firstProjected = instance.project(current.draftVertices[0]!);
							const distPx = Math.hypot(
								firstProjected.x - event.point.x,
								firstProjected.y - event.point.y,
							);
							if (distPx <= CLOSE_SNAP_THRESHOLD_PX) {
								const built = buildClosedPolygonFromVertices(current.draftVertices);
								if (built) {
									setDraftVertices([]);
									current.onChangeAoi(built);
									setToolMode('pan');
									syncMapOverlayNow(
										instance,
										buildAoiOverlayFeatureCollection({
											toolMode: 'pan',
											aoi: built,
											isValidAoi: true,
											municipalityBbox: current.municipalityBbox,
											rectStart: null,
											draftVertices: [],
											cursorCoord: pt,
										}),
									);
									return;
								}
							}
						}

						const nextVertices = [...current.draftVertices, pt];
						setDraftVertices(nextVertices);
						current.onChangeAoi(null);
						syncMapOverlayNow(
							instance,
							buildAoiOverlayFeatureCollection({
								toolMode: 'polygon',
								aoi: null,
								isValidAoi: true,
								municipalityBbox: current.municipalityBbox,
								rectStart: null,
								draftVertices: nextVertices,
								cursorCoord: pt,
							}),
						);
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
							syncMapOverlayNow(
								instance,
								buildAoiOverlayFeatureCollection({
									toolMode: 'pan',
									aoi: built,
									isValidAoi: true,
									municipalityBbox: current.municipalityBbox,
									rectStart: null,
									draftVertices: [],
									cursorCoord: current.cursorCoord,
								}),
							);
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
			styleReadyRef.current = false;
			if (instance) {
				instance.remove();
				mapRef.current = null;
			}
		};
	}, [syncMapOverlayNow]);

	// Troca estilo base somente quando usuário alterna Satélite / OSM / Grade Offline
	useEffect(() => {
		if (prevBasemapRef.current === basemap) {
			return;
		}
		prevBasemapRef.current = basemap;
		const map = mapRef.current;
		if (!map) return;
		styleReadyRef.current = false;
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

	// Atualiza fonte GeoJSON reativamente sem depender de map.isStyleLoaded() (tiles raster externos podem estar pendentes)
	useEffect(() => {
		const nextCollection = buildOverlayGeoJson();
		syncMapOverlayNow(mapRef.current, nextCollection);
	}, [buildOverlayGeoJson, syncMapOverlayNow]);

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
									? draftVertices.length >= 3
										? `Clique nos vértices (${draftVertices.length} pts; clique no ponto inicial ou duplo clique para fechar)`
										: `Clique nos vértices (${draftVertices.length} adicionados)`
									: 'Arraste para mover ou use o scroll para zoom'}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
