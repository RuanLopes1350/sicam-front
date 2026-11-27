import { clientEnv } from '@/config/env';
import {
	apiClient,
	type CreateSicamApiClientOptions,
	refreshSessionSingleFlight,
	type SicamApiClient,
	unwrapApiResult,
} from '@/lib/api/client';
import { ApiProblemError, parseProblemResponse } from '@/lib/api/problemDetails';
import { getAccessToken } from '@/lib/api/tokenStore';
import { validateDismissalReason } from '@/lib/runs/curationLogic';
import type {
	ReviewFeatureBody,
	ReviewFeatureResponse,
	RunFeaturesGeoJsonResponse,
	RunFeaturesQuery,
	RunRasterAssetType,
} from '@/types/api';

const UUID_REGEX =
	/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

export const ALLOWED_RASTER_TYPES: ReadonlySet<RunRasterAssetType> = new Set([
	't0_rgb',
	't1_rgb',
	't0_false_color',
	't1_false_color',
	'delta_ndvi_mask',
]);

function isValidUuid(value: string): boolean {
	return UUID_REGEX.test(value.trim());
}

function generateRequestId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return '00000000-0000-4000-8000-000000000000';
}

async function readBodySafely(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

/**
 * Carrega polígonos vetorizados da execução em formato GeoJSON FeatureCollection para o MapLibre GL e curadoria.
 */
export async function listRunFeaturesGeoJson(
	runId: string,
	query?: Omit<RunFeaturesQuery, 'format'>,
	client: SicamApiClient = apiClient,
): Promise<RunFeaturesGeoJsonResponse> {
	const result = await client.GET('/api/v1/runs/{runId}/features', {
		params: {
			path: { runId },
			query: {
				format: 'geojson',
				limit: query?.limit ?? 500,
				...(query?.class ? { class: query.class } : {}),
				...(query?.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
			},
		},
	});

	const data = unwrapApiResult(result);
	if (!('type' in data) || data.type !== 'FeatureCollection') {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Resposta espacial inesperada',
			status: 500,
			code: 'ERR_INVALID_FEATURES_PAYLOAD',
			detail: 'O servidor não retornou uma FeatureCollection GeoJSON válida.',
			instance: `/api/v1/runs/${runId}/features`,
			correlationId: '',
		});
	}

	return data;
}

/**
 * Confirma ou descarta polígono como ruído (dismissed_noise >= 15 chars) com recálculo imediato no PostGIS.
 */
export async function reviewRunFeature(
	runId: string,
	featureId: string,
	body: ReviewFeatureBody,
	client: SicamApiClient = apiClient,
): Promise<ReviewFeatureResponse> {
	let normalizedBody: ReviewFeatureBody;

	if (body.reviewStatus === 'dismissed_noise') {
		const rawReason = body.dismissalReason ?? '';
		const validationMsg = validateDismissalReason(rawReason);
		if (validationMsg) {
			throw new ApiProblemError({
				type: 'about:blank',
				title: 'Justificativa de descarte inválida',
				status: 400,
				code: 'ERR_VALIDATION_FAILED',
				detail: validationMsg,
				instance: `/api/v1/runs/${runId}/features/${featureId}/review`,
				correlationId: '',
				invalidParams: [{ field: 'dismissalReason', reason: 'MIN_LENGTH_15_REQUIRED' }],
			});
		}
		normalizedBody = {
			reviewStatus: 'dismissed_noise',
			dismissalReason: rawReason.trim(),
		};
	} else {
		normalizedBody = {
			reviewStatus: body.reviewStatus,
			dismissalReason: null,
		};
	}

	const result = await client.PATCH('/api/v1/runs/{runId}/features/{featureId}/review', {
		params: {
			path: { runId, featureId },
		},
		body: normalizedBody,
	});

	return unwrapApiResult(result);
}

/**
 * Faz download autenticado em streaming (Bearer) da evidência PNG armazenada no bucket S3 privado.
 */
export async function fetchRunRasterBlob(
	runId: string,
	assetType: RunRasterAssetType,
	options?: CreateSicamApiClientOptions & { signal?: AbortSignal },
): Promise<Blob> {
	if (!isValidUuid(runId) || !ALLOWED_RASTER_TYPES.has(assetType)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Parâmetros de raster inválidos',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'runId ou tipo de raster inválido para consulta autenticada.',
			instance: '/api/v1/runs/rasters',
			correlationId: '',
			invalidParams: [{ field: 'assetType', reason: 'INVALID_RASTER_REQUEST' }],
		});
	}

	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl =
		options?.fetchImpl ?? ((input: Request) => globalThis.fetch.call(globalThis, input));
	const correlationId = generateRequestId();
	const url = `${baseUrl}/api/v1/runs/${runId.trim()}/rasters/${assetType}`;

	const send = (bearerToken: string | null): Promise<Response> => {
		const headers = new Headers();
		headers.set('x-request-id', correlationId);
		if (bearerToken) {
			headers.set('authorization', `Bearer ${bearerToken}`);
		}
		return fetchImpl(
			new Request(url, {
				method: 'GET',
				credentials: 'include',
				headers,
				signal: options?.signal,
			}),
		);
	};

	let response = await send(getAccessToken());
	if (response.status === 401 && !options?.signal?.aborted) {
		const refreshed = await refreshSessionSingleFlight({ baseUrl, fetchImpl });
		if (refreshed) {
			response = await send(refreshed);
		}
	}

	if (!response.ok) {
		throw parseProblemResponse(response.status, await readBodySafely(response));
	}

	return response.blob();
}
