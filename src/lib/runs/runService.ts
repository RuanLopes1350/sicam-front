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
import { createSseFrameParser, type ParsedRunSseEvent } from '@/lib/runs/sseParser';
import type { CreateRunAcceptedResponse, CreateRunBody, RunDetailResponse } from '@/types/api';

const UUID_REGEX =
	/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

function isValidUuid(value: string): boolean {
	return UUID_REGEX.test(value.trim());
}

function generateRequestId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return '00000000-0000-4000-8000-000000000000';
}

export function generateIdempotencyKey(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
	return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-8${hex().slice(1)}-${hex()}${hex()}${hex()}`;
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
 * Dispara execução analítica assíncrona com Idempotency-Key obrigatório (202 Accepted).
 */
export async function createRun(
	caseId: string,
	body: CreateRunBody,
	idempotencyKey: string,
	client: SicamApiClient = apiClient,
): Promise<CreateRunAcceptedResponse> {
	const cleanKey = idempotencyKey.trim();
	if (!isValidUuid(cleanKey)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Chave de idempotência inválida',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'O cabeçalho Idempotency-Key deve estar no formato UUID v4 válido.',
			instance: `/api/v1/cases/${caseId}/runs`,
			correlationId: '',
			invalidParams: [{ field: 'idempotency-key', reason: 'INVALID_UUID' }],
		});
	}

	const result = await client.POST('/api/v1/cases/{caseId}/runs', {
		params: {
			path: { caseId },
			header: { 'idempotency-key': cleanKey },
		},
		body,
	});

	return unwrapApiResult(result);
}

/**
 * Busca o estado consolidado atual, proveniência, áreas e catálogo de rasters de uma execução.
 */
export async function getRunById(
	runId: string,
	client: SicamApiClient = apiClient,
): Promise<RunDetailResponse> {
	const result = await client.GET('/api/v1/runs/{runId}', {
		params: {
			path: { runId },
		},
	});
	return unwrapApiResult(result);
}

export interface StreamRunEventsCallbacks {
	onEvent: (event: ParsedRunSseEvent) => void;
	onHeartbeat?: () => void;
}

/**
 * Consome SSE de GET /api/v1/runs/{runId}/events via fetch + Authorization: Bearer (nunca ?token= na URL).
 */
export async function streamRunEvents(
	runId: string,
	callbacks: StreamRunEventsCallbacks,
	options?: CreateSicamApiClientOptions & { signal?: AbortSignal },
): Promise<void> {
	if (!isValidUuid(runId)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Identificador de execução inválido',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'runId deve ser um UUID válido para abrir o stream SSE.',
			instance: '/api/v1/runs/events',
			correlationId: '',
			invalidParams: [{ field: 'runId', reason: 'INVALID_UUID' }],
		});
	}

	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl =
		options?.fetchImpl ?? ((input: Request) => globalThis.fetch.call(globalThis, input));
	const correlationId = generateRequestId();
	const streamUrl = `${baseUrl}/api/v1/runs/${runId.trim()}/events`;

	const openStream = (bearerToken: string | null): Promise<Response> => {
		const headers = new Headers();
		headers.set('accept', 'text/event-stream');
		headers.set('cache-control', 'no-cache');
		headers.set('x-request-id', correlationId);
		if (bearerToken) {
			headers.set('authorization', `Bearer ${bearerToken}`);
		}

		return fetchImpl(
			new Request(streamUrl, {
				method: 'GET',
				credentials: 'include',
				headers,
				signal: options?.signal,
			}),
		);
	};

	let response = await openStream(getAccessToken());
	if (response.status === 401 && !options?.signal?.aborted) {
		const refreshed = await refreshSessionSingleFlight({ baseUrl, fetchImpl });
		if (refreshed) {
			response = await openStream(refreshed);
		}
	}

	if (!response.ok) {
		throw parseProblemResponse(response.status, await readBodySafely(response));
	}

	if (!response.body) {
		return;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	const parser = createSseFrameParser({
		onEvent: callbacks.onEvent,
		onComment: () => callbacks.onHeartbeat?.(),
	});

	try {
		while (true) {
			if (options?.signal?.aborted) {
				break;
			}
			const { value, done } = await reader.read();
			if (done) {
				parser.feed(decoder.decode());
				parser.flush();
				break;
			}
			if (value) {
				parser.feed(decoder.decode(value, { stream: true }));
			}
		}
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			return;
		}
		if (options?.signal?.aborted) {
			return;
		}
		throw err;
	} finally {
		try {
			await reader.cancel();
		} catch {
			// Stream já encerrada ou cancelada
		}
	}
}
