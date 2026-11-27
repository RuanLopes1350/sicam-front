'use client';

import type { FeatureCollection } from 'geojson';
import {
	Crosshair,
	Eye,
	Layers,
	MoveHorizontal,
	Sliders,
} from 'lucide-react';
import type {
	GeoJSONSource,
	ImageSource,
	Map as MapLibreMapInstance,
	MapLayerMouseEvent,
} from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type { LoadedRasterAsset, LoadedRasterMap } from '@/hooks/useRunRasters';
import { computePolygonBbox } from '@/lib/geo/aoiGeometry';
import {
	BASEMAP_LABELS,
	type BasemapVariant,
	buildBasemapStyle,
	DEFAULT_RONDONIA_VIEW,
} from '@/lib/geo/mapStyles';
import {
	bounds4674ToImageCoordinates,
	SPECTRAL_MODE_ASSETS,
	type SpectralCompositionMode,
} from '@/lib/runs/curationLogic';
import { cn } from '@/lib/utils/cn';
import { formatDateTimePtBr } from '@/lib/utils/formatters';
import type { AoiPolygonGeoJson, DetectedFeatureGeoJson } from '@/types/api';

export interface MultitemporalSwipeMapProps {
	aoiGeoJson: AoiPolygonGeoJson | null;
	t0AcquiredAt: string;
	t1AcquiredAt: string;
	rasters: LoadedRasterMap;
	isLoadingRasters: boolean;
	features: readonly DetectedFeatureGeoJson[];
	selectedFeatureId: string | null;
	focusTargetBounds: [number, number, number, number] | null;
	focusSequence: number;
	onSelectFeature: (featureId: string) => void;
}

const IMAGE_SOURCE_ID = 'sicam-scene-raster';
const IMAGE_LAYER_ID = 'sicam-scene-raster-layer';
const MASK_SOURCE_ID = 'sicam-delta-mask';
const MASK_LAYER_ID = 'sicam-delta-mask-layer';
const AOI_SOURCE_ID = 'sicam-case-aoi';
const AOI_LINE_LAYER_ID = 'sicam-case-aoi-line';
const FEATURES_SOURCE_ID = 'sicam-detected-features';
const FEATURES_FILL_LAYER_ID = 'sicam-detected-features-fill';
const FEATURES_LINE_LAYER_ID = 'sicam-detected-features-line';

function syncImageRasterLayer(
	map: MapLibreMapInstance,
	sourceId: string,
	layerId: string,
	asset: LoadedRasterAsset | undefined,
	visible: boolean,
	opacity: number,
	beforeLayerId?: string,
	resampling: 'linear' | 'nearest' = 'linear',
) {
	if (!asset) {
		if (map.getLayer(layerId)) {
			map.setLayoutProperty(layerId, 'visibility', 'none');
		}
		return;
	}

	const coordinates = bounds4674ToImageCoordinates(asset.bounds4674);
	const existing = map.getSource(sourceId) as ImageSource | undefined;

	if (existing) {
		existing.updateImage({ url: asset.objectUrl, coordinates });
	} else {
		map.addSource(sourceId, {
			type: 'image',
			url: asset.objectUrl,
			coordinates,
		});
		map.addLayer(
			{
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-fade-duration': 0,
					'raster-opacity': opacity,
					'raster-resampling': resampling,
				},
			},
			beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined,
		);
	}

	if (map.getLayer(layerId)) {
		map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
		map.setPaintProperty(layerId, 'raster-opacity', opacity);
		map.setPaintProperty(layerId, 'raster-resampling', resampling);
	}
}

function syncMapLayers(
	map: MapLibreMapInstance,
	params: {
		ready: boolean;
		sceneRaster: LoadedRasterAsset | undefined;
		maskRaster: LoadedRasterAsset | undefined;
		showMask: boolean;
		maskOpacity: number;
		showVectors: boolean;
		sceneResampling: 'linear' | 'nearest';
		aoiCollection: FeatureCollection;
		featuresCollection: FeatureCollection;
	},
) {
	// Não depende de map.isStyleLoaded() (que retorna false se algum tile externo falhar)
	if (!params.ready) {
		return;
	}
	try {
		if (!map.getStyle()) {
			return;
		}

	if (!map.getSource(AOI_SOURCE_ID)) {
		map.addSource(AOI_SOURCE_ID, {
			type: 'geojson',
			data: params.aoiCollection,
		});
		map.addLayer({
			id: AOI_LINE_LAYER_ID,
			type: 'line',
			source: AOI_SOURCE_ID,
			paint: {
				'line-color': '#38bdf8',
				'line-width': 2,
				'line-dasharray': [3, 2],
			},
		});
	} else {
		(map.getSource(AOI_SOURCE_ID) as GeoJSONSource).setData(params.aoiCollection);
	}

	if (!map.getSource(FEATURES_SOURCE_ID)) {
		map.addSource(FEATURES_SOURCE_ID, {
			type: 'geojson',
			data: params.featuresCollection,
		});
		map.addLayer({
			id: FEATURES_FILL_LAYER_ID,
			type: 'fill',
			source: FEATURES_SOURCE_ID,
			paint: {
				'fill-color': [
					'match',
					['get', 'featureClass'],
					'deforestation',
					'#ef4444',
					'degradation',
					'#f59e0b',
					'regrowth',
					'#10b981',
					'#38bdf8',
				],
				'fill-opacity': [
					'case',
					['==', ['get', 'reviewStatus'], 'dismissed_noise'],
					0.1,
					['boolean', ['get', 'selected'], false],
					0.4,
					0.24,
				],
			},
		});
		map.addLayer({
			id: FEATURES_LINE_LAYER_ID,
			type: 'line',
			source: FEATURES_SOURCE_ID,
			paint: {
				'line-color': [
					'case',
					['boolean', ['get', 'selected'], false],
					'#ffffff',
					['==', ['get', 'reviewStatus'], 'dismissed_noise'],
					'#94a3b8',
					[
						'match',
						['get', 'featureClass'],
						'deforestation',
						'#ef4444',
						'degradation',
						'#f59e0b',
						'regrowth',
						'#10b981',
						'#38bdf8',
					],
				],
				'line-width': [
					'case',
					['boolean', ['get', 'selected'], false],
					3,
					1.75,
				],
			},
		});
	} else {
		(map.getSource(FEATURES_SOURCE_ID) as GeoJSONSource).setData(params.featuresCollection);
	}

	const visibilityVal = params.showVectors ? 'visible' : 'none';
	if (map.getLayer(FEATURES_FILL_LAYER_ID)) {
		map.setLayoutProperty(FEATURES_FILL_LAYER_ID, 'visibility', visibilityVal);
	}
	if (map.getLayer(FEATURES_LINE_LAYER_ID)) {
		map.setLayoutProperty(FEATURES_LINE_LAYER_ID, 'visibility', visibilityVal);
	}

	// Posiciona camadas raster abaixo dos contornos vetoriais
	syncImageRasterLayer(
		map,
		IMAGE_SOURCE_ID,
		IMAGE_LAYER_ID,
		params.sceneRaster,
		true,
		1,
		AOI_LINE_LAYER_ID,
		params.sceneResampling,
	);
	syncImageRasterLayer(
		map,
		MASK_SOURCE_ID,
		MASK_LAYER_ID,
		params.maskRaster,
		params.showMask,
		params.maskOpacity,
		AOI_LINE_LAYER_ID,
		'nearest',
	);
	} catch {
		// Estilo ainda em transição durante troca de mapa-base
	}
}

export function MultitemporalSwipeMap({
	aoiGeoJson,
	t0AcquiredAt,
	t1AcquiredAt,
	rasters,
	isLoadingRasters,
	features,
	selectedFeatureId,
	focusTargetBounds,
	focusSequence,
	onSelectFeature,
}: MultitemporalSwipeMapProps) {
	const stageRef = useRef<HTMLDivElement | null>(null);
	const containerT0Ref = useRef<HTMLDivElement | null>(null);
	const containerT1Ref = useRef<HTMLDivElement | null>(null);
	const mapT0Ref = useRef<MapLibreMapInstance | null>(null);
	const mapT1Ref = useRef<MapLibreMapInstance | null>(null);
	const styleReadyT0Ref = useRef(false);
	const styleReadyT1Ref = useRef(false);
	const prevBasemapRef = useRef<BasemapVariant>('satellite');
	const isSyncingRef = useRef(false);
	const hasFittedInitialRef = useRef(false);

	const [basemap, setBasemap] = useState<BasemapVariant>('satellite');
	const [spectralMode, setSpectralMode] = useState<SpectralCompositionMode>('rgb');
	const [showMask, setShowMask] = useState(false);
	const [maskOpacity, setMaskOpacity] = useState(0.55);
	const [showVectors, setShowVectors] = useState(true);
	const [rasterResampling, setRasterResampling] = useState<'linear' | 'nearest'>('linear');
	const [isOverZoomed, setIsOverZoomed] = useState(false);
	const [swipePct, setSwipePct] = useState(50);
	const [isDraggingSwipe, setIsDraggingSwipe] = useState(false);
	const [webglUnavailable, setWebglUnavailable] = useState(false);

	const onSelectFeatureRef = useRef(onSelectFeature);
	onSelectFeatureRef.current = onSelectFeature;

	const aoiCollection = useMemo<FeatureCollection>(
		() => ({
			type: 'FeatureCollection',
			features: aoiGeoJson
				? [{ type: 'Feature', properties: {}, geometry: aoiGeoJson }]
				: [],
		}),
		[aoiGeoJson],
	);

	const featuresCollection = useMemo<FeatureCollection>(
		() => ({
			type: 'FeatureCollection',
			features: features.map((feat) => ({
				type: 'Feature',
				id: feat.id,
				geometry: feat.geometry,
				properties: {
					...feat.properties,
					selected: selectedFeatureId === feat.id,
				},
			})),
		}),
		[features, selectedFeatureId],
	);

	const modeAssets = SPECTRAL_MODE_ASSETS[spectralMode];
	const rasterT0 = rasters[modeAssets.t0Asset];
	const rasterT1 = rasters[modeAssets.t1Asset];
	const maskRaster = rasters.delta_ndvi_mask;

	const defaultBounds = useMemo<[number, number, number, number] | null>(() => {
		const aoiBbox = computePolygonBbox(aoiGeoJson);
		if (aoiBbox) return aoiBbox;
		const firstRaster = Object.values(rasters).find(Boolean);
		return firstRaster?.bounds4674 ?? null;
	}, [aoiGeoJson, rasters]);

	const syncBothRef = useRef<() => void>(() => undefined);
	syncBothRef.current = () => {
		if (mapT0Ref.current) {
			syncMapLayers(mapT0Ref.current, {
				ready: styleReadyT0Ref.current,
				sceneRaster: rasterT0,
				maskRaster: undefined,
				showMask: false,
				maskOpacity,
				showVectors,
				sceneResampling: rasterResampling,
				aoiCollection,
				featuresCollection,
			});
		}
		if (mapT1Ref.current) {
			syncMapLayers(mapT1Ref.current, {
				ready: styleReadyT1Ref.current,
				sceneRaster: rasterT1,
				maskRaster,
				showMask,
				maskOpacity,
				showVectors,
				sceneResampling: rasterResampling,
				aoiCollection,
				featuresCollection,
			});
		}
	};

	useEffect(() => {
		if (!containerT0Ref.current || !containerT1Ref.current || typeof window === 'undefined') {
			return;
		}

		let disposed = false;
		let instT0: MapLibreMapInstance | null = null;
		let instT1: MapLibreMapInstance | null = null;

		const mirrorCamera = (src: MapLibreMapInstance, dst: MapLibreMapInstance) => {
			if (isSyncingRef.current) return;
			isSyncingRef.current = true;
			dst.jumpTo({
				center: src.getCenter(),
				zoom: src.getZoom(),
				bearing: src.getBearing(),
				pitch: src.getPitch(),
			});
			isSyncingRef.current = false;
		};

		const bindFeatureInteractions = (map: MapLibreMapInstance) => {
			map.on('click', FEATURES_FILL_LAYER_ID, (event: MapLayerMouseEvent) => {
				const clickedId = event.features?.[0]?.properties?.id;
				if (typeof clickedId === 'string') {
					onSelectFeatureRef.current(clickedId);
				}
			});
			map.on('mouseenter', FEATURES_FILL_LAYER_ID, () => {
				map.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', FEATURES_FILL_LAYER_ID, () => {
				map.getCanvas().style.cursor = '';
			});
		};

		void (async () => {
			try {
				const { Map: MapLibreMap, NavigationControl, ScaleControl } = await import(
					'maplibre-gl'
				);
				if (disposed || !containerT0Ref.current || !containerT1Ref.current) {
					return;
				}

				const baseStyle = buildBasemapStyle('satellite');
				instT1 = new MapLibreMap({
					container: containerT1Ref.current,
					style: baseStyle,
					center: DEFAULT_RONDONIA_VIEW.center,
					zoom: DEFAULT_RONDONIA_VIEW.zoom,
					attributionControl: false,
				});

				instT0 = new MapLibreMap({
					container: containerT0Ref.current,
					style: baseStyle,
					center: DEFAULT_RONDONIA_VIEW.center,
					zoom: DEFAULT_RONDONIA_VIEW.zoom,
					attributionControl: false,
				});

				instT1.addControl(new NavigationControl({ showCompass: false }), 'top-right');
				instT1.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');

				const markReadyT0 = () => {
					styleReadyT0Ref.current = true;
					syncBothRef.current();
				};
				const markReadyT1 = () => {
					styleReadyT1Ref.current = true;
					syncBothRef.current();
				};

				instT0.on('style.load', markReadyT0);
				instT0.on('load', markReadyT0);
				instT0.on('styledata', markReadyT0);
				instT1.on('style.load', markReadyT1);
				instT1.on('load', markReadyT1);
				instT1.on('styledata', markReadyT1);

				instT0.on('move', () => {
					if (instT0 && instT1) mirrorCamera(instT0, instT1);
				});
				instT1.on('move', () => {
					if (instT0 && instT1) mirrorCamera(instT1, instT0);
				});
				instT1.on('zoom', () => {
					if (!instT1) return;
					const nextOverZoom = instT1.getZoom() > 15.2;
					setIsOverZoomed((prev) => (prev === nextOverZoom ? prev : nextOverZoom));
				});

				bindFeatureInteractions(instT0);
				bindFeatureInteractions(instT1);

				mapT0Ref.current = instT0;
				mapT1Ref.current = instT1;
				markReadyT0();
				markReadyT1();
			} catch {
				if (!disposed) {
					setWebglUnavailable(true);
				}
			}
		})();

		return () => {
			disposed = true;
			styleReadyT0Ref.current = false;
			styleReadyT1Ref.current = false;
			instT0?.remove();
			instT1?.remove();
			mapT0Ref.current = null;
			mapT1Ref.current = null;
		};
	}, []);

	useEffect(() => {
		if (prevBasemapRef.current === basemap) {
			return;
		}
		prevBasemapRef.current = basemap;
		const style = buildBasemapStyle(basemap);
		if (mapT0Ref.current) {
			styleReadyT0Ref.current = false;
			mapT0Ref.current.setStyle(style);
		}
		if (mapT1Ref.current) {
			styleReadyT1Ref.current = false;
			mapT1Ref.current.setStyle(style);
		}
	}, [basemap]);

	useEffect(() => {
		syncBothRef.current();
	});

	const fitMapsToBounds = useCallback(
		(bounds: [number, number, number, number], duration = 500, maxZoom = 14.2) => {
			const [minLon, minLat, maxLon, maxLat] = bounds;
			const target: [[number, number], [number, number]] = [
				[minLon, minLat],
				[maxLon, maxLat],
			];
			mapT1Ref.current?.fitBounds(target, { padding: 56, maxZoom, duration });
			mapT0Ref.current?.fitBounds(target, { padding: 56, maxZoom, duration });
		},
		[],
	);

	useEffect(() => {
		if (!hasFittedInitialRef.current && defaultBounds && mapT1Ref.current) {
			hasFittedInitialRef.current = true;
			fitMapsToBounds(defaultBounds, 0);
		}
	}, [defaultBounds, fitMapsToBounds]);

	useEffect(() => {
		if (focusTargetBounds && focusSequence > 0) {
			fitMapsToBounds(focusTargetBounds, 550, 15.2);
		}
	}, [focusTargetBounds, focusSequence, fitMapsToBounds]);

	// Arraste horizontal da cortina Before/After
	const updateSwipeFromClientX = useCallback((clientX: number) => {
		const rect = stageRef.current?.getBoundingClientRect();
		if (!rect || rect.width <= 0) return;
		const pct = ((clientX - rect.left) / rect.width) * 100;
		setSwipePct(Math.max(2, Math.min(98, Math.round(pct))));
	}, []);

	useEffect(() => {
		if (!isDraggingSwipe) {
			return;
		}
		const handleMove = (event: PointerEvent) => {
			updateSwipeFromClientX(event.clientX);
		};
		const handleUp = () => {
			setIsDraggingSwipe(false);
		};
		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', handleUp);
		return () => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', handleUp);
		};
	}, [isDraggingSwipe, updateSwipeFromClientX]);

	return (
		<Card className="overflow-hidden">
			<CardHeader className="space-y-3 bg-slate-50/80 pb-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Eye className="h-4 w-4 text-brand-600" aria-hidden="true" />
						Mesa de Inspeção Multitemporal (Cortina Before / After T0 × T1)
					</CardTitle>

					<div className="flex flex-wrap items-center gap-1.5">
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

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-1.5">
						{(Object.keys(SPECTRAL_MODE_ASSETS) as SpectralCompositionMode[]).map((mode) => (
							<Button
								key={mode}
								size="sm"
								variant={spectralMode === mode ? 'primary' : 'outline'}
								onClick={() => setSpectralMode(mode)}
							>
								<Layers className="h-3.5 w-3.5" aria-hidden="true" />
								{SPECTRAL_MODE_ASSETS[mode].label}
							</Button>
						))}
					</div>

					<div className="flex flex-wrap items-center gap-3 text-xs">
						<label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
							<input
								type="checkbox"
								checked={showMask}
								onChange={(event) => setShowMask(event.target.checked)}
								className="h-4 w-4 rounded border-slate-300 text-brand-600"
							/>
							<span>Máscara ΔNDVI + SCL</span>
						</label>

						{showMask ? (
							<label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
								<Sliders className="h-3 w-3" aria-hidden="true" />
								<input
									type="range"
									min={10}
									max={100}
									value={Math.round(maskOpacity * 100)}
									aria-label="Opacidade da máscara Delta NDVI"
									onChange={(event) =>
										setMaskOpacity(Number(event.target.value) / 100)
									}
									className="w-20 accent-brand-600"
								/>
								<span className="font-mono">{Math.round(maskOpacity * 100)}%</span>
							</label>
						) : null}

						<label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
							<input
								type="checkbox"
								checked={showVectors}
								onChange={(event) => setShowVectors(event.target.checked)}
								className="h-4 w-4 rounded border-slate-300 text-brand-600"
							/>
							<span>Polígonos Vetorizados</span>
						</label>

						<div
							role="group"
							aria-label="Modo de exibição do pixel Sentinel-2"
							className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
						>
							<button
								type="button"
								onClick={() => setRasterResampling('linear')}
								className={cn(
									'px-2 py-1 text-[11px] font-medium transition-colors',
									rasterResampling === 'linear'
										? 'bg-brand-600 text-white'
										: 'text-slate-600 hover:bg-slate-100',
								)}
							>
								Super-Resolução 4×
							</button>
							<button
								type="button"
								onClick={() => setRasterResampling('nearest')}
								className={cn(
									'border-l border-slate-300 px-2 py-1 text-[11px] font-medium transition-colors',
									rasterResampling === 'nearest'
										? 'bg-brand-600 text-white'
										: 'text-slate-600 hover:bg-slate-100',
								)}
							>
								Pixel Nativo 10m
							</button>
						</div>

						{defaultBounds ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() => fitMapsToBounds(defaultBounds, 450)}
							>
								<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
								Enquadrar AOI
							</Button>
						) : null}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-3 p-0">
				{isLoadingRasters ? (
					<div className="flex items-center justify-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
						<Spinner size="sm" />
						<span>Carregando composições PNG autenticadas (T0/T1)...</span>
					</div>
				) : null}

				{webglUnavailable ? (
					<div className="p-4">
						<AlertBanner
							variant="warning"
							title="Visualizador WebGL indisponível neste dispositivo"
							message="As camadas cartográficas continuam disponíveis na tabela e nos pacotes exportados."
						/>
					</div>
				) : null}

				<div
					ref={stageRef}
					className="relative h-[480px] w-full select-none overflow-hidden bg-slate-950"
				>
					{/* Camada base: Cena T1 (Posterior) */}
					<div ref={containerT1Ref} className="absolute inset-0 h-full w-full" />

					{/* Camada comparada recortada pela cortina: Cena T0 (Anterior) */}
					<div
						ref={containerT0Ref}
						className="absolute inset-0 h-full w-full"
						style={{ clipPath: `inset(0 ${100 - swipePct}% 0 0)` }}
					/>

					{/* Linha vertical divisória */}
					<div
						className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(15,23,42,0.9)]"
						style={{ left: `${swipePct}%` }}
					/>

					{/* Alça interativa de arraste da cortina */}
					<button
						type="button"
						aria-label="Arrastar cortina Before After T0 versus T1"
						onPointerDown={(event) => {
							event.preventDefault();
							setIsDraggingSwipe(true);
							updateSwipeFromClientX(event.clientX);
						}}
						style={{ left: `${swipePct}%` }}
						className="absolute top-1/2 z-30 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow-lg hover:bg-brand-600"
					>
						<MoveHorizontal className="h-4 w-4" aria-hidden="true" />
					</button>

					{/* Rótulos fixos T0 / T1 */}
					<div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
						<Badge variant="info" className="bg-slate-950/85 text-white border-slate-700">
							T0 Base · {formatDateTimePtBr(t0AcquiredAt).slice(0, 10)}
						</Badge>
					</div>

					<div className="pointer-events-none absolute right-12 top-3 z-20 flex items-center gap-2">
						<Badge variant="warning" className="bg-slate-950/85 text-amber-200 border-slate-700">
							T1 Alvo · {formatDateTimePtBr(t1AcquiredAt).slice(0, 10)}
						</Badge>
					</div>

					{/* Selo técnico da resolução nativa Sentinel-2 */}
					<div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2">
						<Badge
							variant="neutral"
							className="border-slate-700 bg-slate-950/85 text-[11px] font-medium text-slate-100"
						>
							{rasterResampling === 'linear'
								? 'Sentinel-2 L2A · 10 m/px (Super-resolução 4×)'
								: 'Sentinel-2 L2A · 10 m/px (Pixel Nativo)'}
						</Badge>
					</div>
				</div>

				{isOverZoomed ? (
					<div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-900">
						Zoom acima do detalhamento físico do Sentinel-2 (10 m/px). Reduza o zoom ou clique em{' '}
						<button
							type="button"
							onClick={() => defaultBounds && fitMapsToBounds(defaultBounds, 450)}
							className="font-semibold underline hover:text-amber-700"
						>
							Enquadrar AOI
						</button>{' '}
						para nitidez ideal.
					</div>
				) : null}

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
					<div className="flex flex-1 items-center gap-3">
						<span className="font-semibold text-slate-700">Posição da cortina:</span>
						<input
							type="range"
							min={0}
							max={100}
							value={swipePct}
							aria-label="Posição da cortina comparativa T0 versus T1"
							onChange={(event) => setSwipePct(Number(event.target.value))}
							className="h-2 max-w-xs flex-1 accent-brand-600"
						/>
						<span className="font-mono font-semibold text-slate-900">{swipePct}% T0</span>
					</div>

					<div className="flex flex-wrap items-center gap-2 text-[11px]">
						<span className="inline-flex items-center gap-1">
							<span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Desmatamento
						</span>
						<span className="inline-flex items-center gap-1">
							<span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Degradação
						</span>
						<span className="inline-flex items-center gap-1">
							<span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Regeneração
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
