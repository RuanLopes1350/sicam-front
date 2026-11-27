import type { Feature, FeatureCollection } from 'geojson';
import { buildRectanglePolygon } from '@/lib/geo/aoiGeometry';
import type { AoiPolygonGeoJson } from '@/types/api';

export type AoiOverlayToolMode = 'pan' | 'rectangle' | 'polygon';

export interface BuildAoiOverlayParams {
	toolMode: AoiOverlayToolMode;
	aoi: AoiPolygonGeoJson | null;
	isValidAoi: boolean;
	municipalityBbox: [number, number, number, number] | null;
	rectStart: [number, number] | null;
	draftVertices: ReadonlyArray<[number, number]>;
	cursorCoord: [number, number] | null;
}

function samePoint(a: readonly [number, number], b: readonly [number, number]): boolean {
	return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

/**
 * Constrói a coleção GeoJSON de feedback visual imediato para desenho de AOI no MapLibre GL:
 * contorno do município, polígono fechado, área de pré-visualização, linhas sólidas entre vértices,
 * linha elástica até o cursor desde o 1º clique e marcadores de vértices com destaque de fechamento.
 */
export function buildAoiOverlayFeatureCollection(
	params: BuildAoiOverlayParams,
): FeatureCollection {
	const {
		toolMode,
		aoi,
		isValidAoi,
		municipalityBbox,
		rectStart,
		draftVertices,
		cursorCoord,
	} = params;

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

	if (toolMode === 'rectangle' && rectStart) {
		if (!previewRect && cursorCoord && !samePoint(rectStart, cursorCoord)) {
			features.push({
				type: 'Feature',
				properties: { kind: 'draft_solid_line' },
				geometry: {
					type: 'LineString',
					coordinates: [rectStart, cursorCoord],
				},
			});
		}

		features.push({
			type: 'Feature',
			properties: { kind: 'first_vertex' },
			geometry: { type: 'Point', coordinates: rectStart },
		});
	}

	if (toolMode === 'polygon' && draftVertices.length > 0) {
		const firstPt = draftVertices[0]!;
		const lastPt = draftVertices[draftVertices.length - 1]!;
		const hasDistinctCursor = cursorCoord !== null && !samePoint(lastPt, cursorCoord);

		// Área translúcida de pré-visualização a partir de 2 vértices + cursor ou >= 3 vértices
		const previewRingSource =
			hasDistinctCursor && cursorCoord
				? [...draftVertices, cursorCoord]
				: [...draftVertices];
		if (previewRingSource.length >= 3) {
			features.push({
				type: 'Feature',
				properties: { kind: 'draft_fill' },
				geometry: {
					type: 'Polygon',
					coordinates: [[...previewRingSource, firstPt]],
				},
			});
		}

		// Arestas já confirmadas entre os vértices clicados (linha sólida contínua)
		if (draftVertices.length >= 2) {
			features.push({
				type: 'Feature',
				properties: { kind: 'draft_solid_line' },
				geometry: {
					type: 'LineString',
					coordinates: [...draftVertices],
				},
			});
		}

		// Linha elástica tracejada até o cursor (já ativa desde o 1º clique) e retorno ao P1
		if (hasDistinctCursor && cursorCoord) {
			const rubberCoords =
				draftVertices.length >= 2
					? [lastPt, cursorCoord, firstPt]
					: [lastPt, cursorCoord];
			features.push({
				type: 'Feature',
				properties: { kind: 'draft_rubber_line' },
				geometry: {
					type: 'LineString',
					coordinates: rubberCoords,
				},
			});
		} else if (draftVertices.length >= 3) {
			features.push({
				type: 'Feature',
				properties: { kind: 'draft_rubber_line' },
				geometry: {
					type: 'LineString',
					coordinates: [lastPt, firstPt],
				},
			});
		}

		for (let i = 0; i < draftVertices.length; i++) {
			const pt = draftVertices[i]!;
			features.push({
				type: 'Feature',
				properties: {
					kind: i === 0 && draftVertices.length >= 3 ? 'first_vertex' : 'vertex',
				},
				geometry: { type: 'Point', coordinates: pt },
			});
		}
	}

	return {
		type: 'FeatureCollection',
		features,
	};
}
