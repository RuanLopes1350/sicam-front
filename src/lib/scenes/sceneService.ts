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
import type { SceneSearchBody, SceneSearchResponse } from '@/types/api';

/**
 * Busca cenas STAC, agrupa mosaicos MGRS e mede % de nuvem real na AOI (analista apenas).
 */
export async function searchScenes(
	caseId: string,
	body: SceneSearchBody,
	client: SicamApiClient = apiClient,
): Promise<SceneSearchResponse> {
	const result = await client.POST('/api/v1/cases/{caseId}/scenes/search', {
		params: { path: { caseId } },
		body,
	});
	return unwrapApiResult(result);
}

export function isSafeScenePreviewPath(previewUrl: string): boolean {
	return (
		previewUrl.startsWith('/api/v1/cases/') &&
		!previewUrl.startsWith('//') &&
		!previewUrl.includes('\\') &&
		previewUrl.includes('/scenes/preview?token=')
	);
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
 * Baixa a miniatura da cena via proxy autenticado (Bearer) do servidor, nunca via <img src> direto.
 */
export async function fetchScenePreviewBlob(
	previewUrl: string,
	options?: CreateSicamApiClientOptions,
): Promise<Blob> {
	if (!isSafeScenePreviewPath(previewUrl)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'URL de miniatura inválida',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'A URL de miniatura deve ser um caminho relativo do proxy de cenas da API SICAM.',
			instance: '/api/v1/cases/scenes/preview',
			correlationId: '',
			invalidParams: [{ field: 'previewUrl', reason: 'UNSAFE_PREVIEW_PATH' }],
		});
	}

	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl =
		options?.fetchImpl ?? ((input: Request) => globalThis.fetch.call(globalThis, input));
	const correlationId = generateRequestId();

	const send = (token: string | null): Promise<Response> => {
		const headers = new Headers();
		headers.set('x-request-id', correlationId);
		if (token) {
			headers.set('authorization', `Bearer ${token}`);
		}
		return fetchImpl(
			new Request(`${baseUrl}${previewUrl}`, {
				method: 'GET',
				credentials: 'include',
				headers,
			}),
		);
	};

	let response = await send(getAccessToken());
	if (response.status === 401) {
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
