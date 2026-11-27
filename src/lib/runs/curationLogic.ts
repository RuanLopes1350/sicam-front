import type {
	DetectedFeatureGeoJson,
	FeatureClass,
	FeatureReviewStatus,
	RunRasterAssetType,
} from '@/types/api';

export const MIN_DISMISSAL_REASON_LENGTH = 15;
export const MAX_DISMISSAL_REASON_LENGTH = 600;

export const FEATURE_CLASS_META: Record<
	FeatureClass,
	{
		label: string;
		badgeVariant: 'danger' | 'warning' | 'success';
		strokeHex: string;
		fillHex: string;
	}
> = {
	deforestation: {
		label: 'Desmatamento / Supressão',
		badgeVariant: 'danger',
		strokeHex: '#ef4444',
		fillHex: '#ef4444',
	},
	degradation: {
		label: 'Degradação Florestal',
		badgeVariant: 'warning',
		strokeHex: '#f59e0b',
		fillHex: '#f59e0b',
	},
	regrowth: {
		label: 'Regeneração Vegetal',
		badgeVariant: 'success',
		strokeHex: '#10b981',
		fillHex: '#10b981',
	},
};

export const REVIEW_STATUS_META: Record<
	FeatureReviewStatus,
	{
		label: string;
		badgeVariant: 'info' | 'success' | 'neutral';
	}
> = {
	auto_detected: {
		label: 'Auto-detectado',
		badgeVariant: 'info',
	},
	confirmed: {
		label: 'Confirmado',
		badgeVariant: 'success',
	},
	dismissed_noise: {
		label: 'Descartado (Ruído)',
		badgeVariant: 'neutral',
	},
};

export type SpectralCompositionMode = 'rgb' | 'false_color';
export type SwipeVisualMode = 'hires_wayback' | SpectralCompositionMode;

export const WAYBACK_VISUAL_MODE_LABEL = 'Alta Resolução (Linha do Tempo)';

export const SPECTRAL_MODE_ASSETS: Record<
	SpectralCompositionMode,
	{
		label: string;
		t0Asset: RunRasterAssetType;
		t1Asset: RunRasterAssetType;
	}
> = {
	rgb: {
		label: 'RGB Cor Natural',
		t0Asset: 't0_rgb',
		t1Asset: 't1_rgb',
	},
	false_color: {
		label: 'Falsa-Cor Infravermelho (NIR)',
		t0Asset: 't0_false_color',
		t1Asset: 't1_false_color',
	},
};

/**
 * Converte bbox [minLon, minLat, maxLon, maxLat] SIRGAS 2000 para os 4 vértices horários [NW, NE, SE, SW]
 * exigidos por ImageSourceSpecification.coordinates do MapLibre GL.
 */
export function bounds4674ToImageCoordinates(
	bounds4674: readonly [number, number, number, number],
): [[number, number], [number, number], [number, number], [number, number]] {
	const [minLon, minLat, maxLon, maxLat] = bounds4674;
	return [
		[minLon, maxLat],
		[maxLon, maxLat],
		[maxLon, minLat],
		[minLon, minLat],
	];
}

export function computeFeaturePolygonBbox(
	geometry: DetectedFeatureGeoJson['geometry'],
): [number, number, number, number] | null {
	const ring = geometry?.coordinates?.[0];
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

export function validateDismissalReason(rawReason: string): string | null {
	const clean = rawReason.trim();
	if (clean.length < MIN_DISMISSAL_REASON_LENGTH) {
		return `Informe uma justificativa técnica com pelo menos ${MIN_DISMISSAL_REASON_LENGTH} caracteres úteis (atual: ${clean.length}).`;
	}
	if (clean.length > MAX_DISMISSAL_REASON_LENGTH) {
		return `A justificativa técnica não pode exceder ${MAX_DISMISSAL_REASON_LENGTH} caracteres.`;
	}
	return null;
}

export function filterAndSortFeatures(
	features: readonly DetectedFeatureGeoJson[],
	filters: {
		featureClass: 'all' | FeatureClass;
		reviewStatus: 'all' | FeatureReviewStatus;
	},
): DetectedFeatureGeoJson[] {
	const filtered = features.filter((feat) => {
		if (filters.featureClass !== 'all' && feat.properties.featureClass !== filters.featureClass) {
			return false;
		}
		if (filters.reviewStatus !== 'all' && feat.properties.reviewStatus !== filters.reviewStatus) {
			return false;
		}
		return true;
	});

	filtered.sort(
		(a, b) =>
			b.properties.areaHa - a.properties.areaHa ||
			a.properties.featureSequence - b.properties.featureSequence,
	);

	return filtered;
}
