import type { AoiPolygonGeoJson } from '@/types/api';

// Limites geográficos do território nacional (espelhando sicam-api/src/service/caseService.ts)
export const BRAZIL_BOUNDS = {
	minLon: -74.5,
	maxLon: -28.0,
	minLat: -34.0,
	maxLat: 5.5,
} as const;

export const DEFAULT_AOI_LIMITS = {
	minAreaHa: 0.5,
	maxAreaHa: 50_000,
	maxVertices: 500,
} as const;

export interface AoiCapabilitiesBounds {
	minAreaHa: number;
	maxAreaHa: number;
	maxVertices: number;
}

export interface AoiEvaluationResult {
	isValid: boolean;
	areaHa: number;
	perimeterM: number;
	distinctVertices: number;
	utmSrid: number | null;
	utmZoneLabel: string | null;
	bbox: [number, number, number, number] | null;
	issues: string[];
}

// Parâmetros do elipsoide GRS80 adotado pelo SIRGAS 2000
const GRS80_A = 6378137.0;
const GRS80_F = 1 / 298.257222101;
const UTM_K0 = 0.9996;

export function roundCoord(value: number): number {
	return Number(value.toFixed(6));
}

/**
 * Resolve o fuso UTM e o código EPSG oficial SIRGAS 2000 para coordenadas no Brasil.
 */
export function resolveSirgas2000UtmZoneAndSrid(
	lon: number,
	lat: number,
): { zone: number; isSouth: boolean; srid: number; label: string } {
	const rawZone = Math.floor((lon + 180) / 6) + 1;
	const isSouth = lat < 0;

	if (isSouth) {
		const zone = Math.max(18, Math.min(25, rawZone));
		const srid = 31960 + zone;
		return { zone, isSouth: true, srid, label: `SIRGAS 2000 / UTM ${zone}S (EPSG:${srid})` };
	}

	const zone = Math.max(18, Math.min(22, rawZone));
	const srid = 31954 + zone;
	return { zone, isSouth: false, srid, label: `SIRGAS 2000 / UTM ${zone}N (EPSG:${srid})` };
}

/**
 * Projeção Transverse Mercator de 6ª ordem sobre o elipsoide GRS80 (Snyder / SIRGAS 2000),
 * reproduzindo no cliente a métrica oficial do PostGIS fn_calc_area_ha_sirgas.
 */
export function projectLonLatToSirgasUtm(
	lon: number,
	lat: number,
	zone: number,
	isSouth: boolean,
): [number, number] {
	const e2 = 2 * GRS80_F - GRS80_F * GRS80_F;
	const ep2 = e2 / (1 - e2);

	const phi = (lat * Math.PI) / 180;
	const lambda = (lon * Math.PI) / 180;
	const lambda0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;

	const sinPhi = Math.sin(phi);
	const cosPhi = Math.cos(phi);
	const tanPhi = Math.tan(phi);

	const n = GRS80_A / Math.sqrt(1 - e2 * sinPhi * sinPhi);
	const t = tanPhi * tanPhi;
	const c = ep2 * cosPhi * cosPhi;
	const aTerm = cosPhi * (lambda - lambda0);

	const e4 = e2 * e2;
	const e6 = e4 * e2;

	const m =
		GRS80_A *
		((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
			((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
			((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
			((35 * e6) / 3072) * Math.sin(6 * phi));

	const a2 = aTerm * aTerm;
	const a3 = a2 * aTerm;
	const a4 = a2 * a2;
	const a5 = a4 * aTerm;
	const a6 = a3 * a3;

	const easting =
		500_000 +
		UTM_K0 *
			n *
			(aTerm +
				((1 - t + c) * a3) / 6 +
				((5 - 18 * t + t * t + 72 * c - 58 * ep2) * a5) / 120);

	const northing =
		(isSouth ? 10_000_000 : 0) +
		UTM_K0 *
			(m +
				n *
					tanPhi *
					(a2 / 2 +
						((5 - t + 9 * c + 4 * c * c) * a4) / 24 +
						((61 - 58 * t + t * t + 600 * c - 330 * ep2) * a6) / 720));

	return [easting, northing];
}

/**
 * Constrói um polígono retangular fechado (quadrante) a partir de dois vértices opostos.
 */
export function buildRectanglePolygon(
	cornerA: readonly [number, number],
	cornerB: readonly [number, number],
): AoiPolygonGeoJson | null {
	const minLon = roundCoord(Math.min(cornerA[0], cornerB[0]));
	const maxLon = roundCoord(Math.max(cornerA[0], cornerB[0]));
	const minLat = roundCoord(Math.min(cornerA[1], cornerB[1]));
	const maxLat = roundCoord(Math.max(cornerA[1], cornerB[1]));

	if (maxLon - minLon < 0.00001 || maxLat - minLat < 0.00001) {
		return null;
	}

	return {
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
	};
}

/**
 * Constrói um polígono fechado simples a partir da lista de vértices clicados pelo analista.
 */
export function buildClosedPolygonFromVertices(
	vertices: ReadonlyArray<readonly [number, number]>,
): AoiPolygonGeoJson | null {
	const deduped: [number, number][] = [];
	for (const pt of vertices) {
		const rounded: [number, number] = [roundCoord(pt[0]), roundCoord(pt[1])];
		const prev = deduped[deduped.length - 1];
		if (!prev || prev[0] !== rounded[0] || prev[1] !== rounded[1]) {
			deduped.push(rounded);
		}
	}

	if (deduped.length > 1) {
		const first = deduped[0]!;
		const last = deduped[deduped.length - 1]!;
		if (first[0] === last[0] && first[1] === last[1]) {
			deduped.pop();
		}
	}

	if (deduped.length < 3) {
		return null;
	}

	const first = deduped[0]!;
	return {
		type: 'Polygon',
		coordinates: [[...deduped, [first[0], first[1]]]],
	};
}

export function computePolygonBbox(
	aoi: AoiPolygonGeoJson | null | undefined,
): [number, number, number, number] | null {
	const ring = aoi?.coordinates?.[0];
	if (!ring || ring.length === 0) {
		return null;
	}

	let minLon = Number.POSITIVE_INFINITY;
	let minLat = Number.POSITIVE_INFINITY;
	let maxLon = Number.NEGATIVE_INFINITY;
	let maxLat = Number.NEGATIVE_INFINITY;

	for (const [lon, lat] of ring) {
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
			return null;
		}
		if (lon < minLon) minLon = lon;
		if (lon > maxLon) maxLon = lon;
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
	}

	return [minLon, minLat, maxLon, maxLat];
}

function orientation(
	p: readonly [number, number],
	q: readonly [number, number],
	r: readonly [number, number],
): number {
	const cross = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
	if (Math.abs(cross) < 1e-12) {
		return 0;
	}
	return cross > 0 ? 1 : 2;
}

function onSegment(
	p: readonly [number, number],
	q: readonly [number, number],
	r: readonly [number, number],
): boolean {
	return (
		q[0] <= Math.max(p[0], r[0]) + 1e-12 &&
		q[0] >= Math.min(p[0], r[0]) - 1e-12 &&
		q[1] <= Math.max(p[1], r[1]) + 1e-12 &&
		q[1] >= Math.min(p[1], r[1]) - 1e-12
	);
}

function segmentsIntersect(
	p1: readonly [number, number],
	q1: readonly [number, number],
	p2: readonly [number, number],
	q2: readonly [number, number],
): boolean {
	const o1 = orientation(p1, q1, p2);
	const o2 = orientation(p1, q1, q2);
	const o3 = orientation(p2, q2, p1);
	const o4 = orientation(p2, q2, q1);

	if (o1 !== o2 && o3 !== o4) {
		return true;
	}
	if (o1 === 0 && onSegment(p1, p2, q1)) return true;
	if (o2 === 0 && onSegment(p1, q2, q1)) return true;
	if (o3 === 0 && onSegment(p2, p1, q2)) return true;
	if (o4 === 0 && onSegment(p2, q1, q2)) return true;

	return false;
}

/**
 * Detecta autointerseções (laços / gravata-borboleta) em um anel fechado.
 */
export function hasSelfIntersection(closedRing: ReadonlyArray<readonly [number, number]>): boolean {
	const edgeCount = closedRing.length - 1;
	if (edgeCount < 3) {
		return false;
	}

	// Verifica também vértices duplicados não adjacentes no interior do anel
	for (let i = 0; i < edgeCount; i++) {
		for (let j = i + 1; j < edgeCount; j++) {
			const pi = closedRing[i]!;
			const pj = closedRing[j]!;
			if (Math.abs(pi[0] - pj[0]) < 1e-11 && Math.abs(pi[1] - pj[1]) < 1e-11) {
				return true;
			}
		}
	}

	for (let i = 0; i < edgeCount; i++) {
		const a1 = closedRing[i]!;
		const a2 = closedRing[i + 1]!;

		for (let j = i + 2; j < edgeCount; j++) {
			// Ignora o par de arestas adjacentes no ponto de fechamento (0 e edgeCount - 1)
			if (i === 0 && j === edgeCount - 1) {
				continue;
			}
			const b1 = closedRing[j]!;
			const b2 = closedRing[j + 1]!;
			if (segmentsIntersect(a1, a2, b1, b2)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Avalia topologia, limites de vértices, território nacional e área SIRGAS 2000 UTM
 * frente aos limites dinâmicos de /api/v1/system/capabilities.
 */
export function evaluateAoiAgainstCapabilities(
	aoi: AoiPolygonGeoJson | null | undefined,
	capabilities?: AoiCapabilitiesBounds | null,
): AoiEvaluationResult {
	const limits = capabilities ?? DEFAULT_AOI_LIMITS;

	if (!aoi || aoi.type !== 'Polygon' || !Array.isArray(aoi.coordinates)) {
		return {
			isValid: false,
			areaHa: 0,
			perimeterM: 0,
			distinctVertices: 0,
			utmSrid: null,
			utmZoneLabel: null,
			bbox: null,
			issues: ['Desenhe um quadrante, polígono ou importe um GeoJSON na carta para definir a AOI.'],
		};
	}

	const issues: string[] = [];

	if (aoi.coordinates.length === 0) {
		return {
			isValid: false,
			areaHa: 0,
			perimeterM: 0,
			distinctVertices: 0,
			utmSrid: null,
			utmZoneLabel: null,
			bbox: null,
			issues: ['O polígono da AOI não possui anel de coordenadas.'],
		};
	}

	if (aoi.coordinates.length > 1) {
		issues.push('Polígonos com buracos (anéis internos) não são permitidos na AOI.');
	}

	const ring = aoi.coordinates[0]!;
	if (ring.length < 4) {
		return {
			isValid: false,
			areaHa: 0,
			perimeterM: 0,
			distinctVertices: Math.max(0, ring.length - 1),
			utmSrid: null,
			utmZoneLabel: null,
			bbox: computePolygonBbox(aoi),
			issues: [
				...issues,
				'O polígono deve conter pelo menos 3 vértices distintos fechados.',
			],
		};
	}

	const first = ring[0]!;
	const last = ring[ring.length - 1]!;
	const isClosed = first[0] === last[0] && first[1] === last[1];
	if (!isClosed) {
		issues.push('O anel exterior do polígono GeoJSON deve ser fechado.');
	}

	const distinctVertices = isClosed ? ring.length - 1 : ring.length;
	if (distinctVertices > limits.maxVertices) {
		issues.push(
			`O polígono possui ${distinctVertices} vértices, excedendo o máximo permitido de ${limits.maxVertices}.`,
		);
	}

	let sumLon = 0;
	let sumLat = 0;
	let outsideBrazil = false;

	for (let i = 0; i < distinctVertices; i++) {
		const [lon, lat] = ring[i]!;
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
			issues.push('O polígono contém coordenadas não numéricas.');
			break;
		}
		if (
			lon < BRAZIL_BOUNDS.minLon ||
			lon > BRAZIL_BOUNDS.maxLon ||
			lat < BRAZIL_BOUNDS.minLat ||
			lat > BRAZIL_BOUNDS.maxLat
		) {
			outsideBrazil = true;
		}
		sumLon += lon;
		sumLat += lat;
	}

	if (outsideBrazil) {
		issues.push(
			'Uma ou mais coordenadas estão fora dos limites geográficos do território brasileiro (SIRGAS 2000).',
		);
	}

	if (isClosed && hasSelfIntersection(ring)) {
		issues.push('O polígono possui arestas que se cruzam (autointerseção inválida).');
	}

	const centroidLon = sumLon / distinctVertices;
	const centroidLat = sumLat / distinctVertices;
	const utmInfo = resolveSirgas2000UtmZoneAndSrid(centroidLon, centroidLat);

	const projected = ring.map(([lon, lat]) =>
		projectLonLatToSirgasUtm(lon, lat, utmInfo.zone, utmInfo.isSouth),
	);

	let signedDoubleAreaM2 = 0;
	let perimeterM = 0;

	for (let i = 0; i < projected.length - 1; i++) {
		const [x1, y1] = projected[i]!;
		const [x2, y2] = projected[i + 1]!;
		signedDoubleAreaM2 += x1 * y2 - x2 * y1;
		perimeterM += Math.hypot(x2 - x1, y2 - y1);
	}

	const areaHa = Math.abs(signedDoubleAreaM2) / 2 / 10_000;

	if (areaHa < limits.minAreaHa) {
		issues.push(
			`Área estimada (${areaHa.toFixed(2)} ha) inferior ao mínimo operacional de ${limits.minAreaHa} ha.`,
		);
	} else if (areaHa > limits.maxAreaHa) {
		issues.push(
			`Área estimada (${areaHa.toFixed(2)} ha) superior ao teto operacional de ${limits.maxAreaHa.toLocaleString('pt-BR')} ha.`,
		);
	}

	return {
		isValid: issues.length === 0,
		areaHa,
		perimeterM,
		distinctVertices,
		utmSrid: utmInfo.srid,
		utmZoneLabel: utmInfo.label,
		bbox: computePolygonBbox(aoi),
		issues,
	};
}

function extractPolygonGeometry(parsed: unknown): unknown {
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('O conteúdo informado não é um objeto JSON válido.');
	}

	const obj = parsed as Record<string, unknown>;
	if (obj.type === 'Polygon') {
		return obj;
	}
	if (obj.type === 'Feature' && obj.geometry && typeof obj.geometry === 'object') {
		return obj.geometry;
	}
	if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
		if (obj.features.length !== 1) {
			throw new Error(
				`FeatureCollection deve conter exatamente 1 feição Polygon (encontradas: ${obj.features.length}).`,
			);
		}
		const firstFeature = obj.features[0] as Record<string, unknown> | undefined;
		if (firstFeature?.geometry && typeof firstFeature.geometry === 'object') {
			return firstFeature.geometry;
		}
	}

	throw new Error(
		'Formato GeoJSON não suportado. Informe um Polygon, Feature<Polygon> ou FeatureCollection com 1 Polygon.',
	);
}

/**
 * Faz o parse seguro de texto GeoJSON e devolve um AoiPolygonGeoJson normalizado e fechado.
 */
export function parseGeoJsonPolygonInput(rawJson: string): AoiPolygonGeoJson {
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawJson);
	} catch {
		throw new Error('JSON inválido: verifique chaves, vírgulas e aspas do GeoJSON.');
	}

	const geometry = extractPolygonGeometry(parsed) as Record<string, unknown>;
	if (geometry.type !== 'Polygon') {
		throw new Error(
			`A geometria da AOI deve ser estritamente 'Polygon' (recebido: '${String(geometry.type)}').`,
		);
	}

	if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
		throw new Error('O Polygon informado não contém coordenadas.');
	}
	if (geometry.coordinates.length > 1) {
		throw new Error('Polígonos com buracos (anéis internos) não são aceitos como AOI.');
	}

	const rawRing = geometry.coordinates[0];
	if (!Array.isArray(rawRing) || rawRing.length < 3) {
		throw new Error('O anel do polígono deve possuir pelo menos 3 pares [longitude, latitude].');
	}

	const normalizedRing: [number, number][] = [];
	for (let i = 0; i < rawRing.length; i++) {
		const tuple = rawRing[i];
		if (!Array.isArray(tuple) || tuple.length < 2) {
			throw new Error(`Vértice na posição ${i} inválido: esperado par [lon, lat].`);
		}
		const lon = Number(tuple[0]);
		const lat = Number(tuple[1]);
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
			throw new Error(`Coordenadas não numéricas no vértice ${i}.`);
		}
		normalizedRing.push([roundCoord(lon), roundCoord(lat)]);
	}

	const first = normalizedRing[0]!;
	const last = normalizedRing[normalizedRing.length - 1]!;
	if (first[0] !== last[0] || first[1] !== last[1]) {
		normalizedRing.push([first[0], first[1]]);
	}

	if (normalizedRing.length < 4) {
		throw new Error('O polígono precisa ter pelo menos 3 vértices distintos.');
	}

	return {
		type: 'Polygon',
		coordinates: [normalizedRing],
	};
}
