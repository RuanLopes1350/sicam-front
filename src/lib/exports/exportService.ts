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
import type {
	ExportArtifactType,
	ExportMetadataResponse,
	PaperFormat,
	RequestExportAcceptedResponse,
	RequestExportBody,
} from '@/types/api';

export const MAX_EXPORT_OBSERVATIONS_LENGTH = 600;

export const PAPER_FORMAT_LABELS: Record<
	PaperFormat,
	{ title: string; dimensionsLabel: string }
> = {
	A3: {
		title: 'Prancha A3 Paisagem (Padrão Pericial)',
		dimensionsLabel: '420 × 297 mm · 300 DPI',
	},
	A4: {
		title: 'Prancha A4 Paisagem (Compacta)',
		dimensionsLabel: '297 × 210 mm · 300 DPI',
	},
};

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

export function parseContentDispositionFilename(headerVal: string | null): string | null {
	if (!headerVal) {
		return null;
	}
	const quotedMatch = /filename="([^"]+)"/i.exec(headerVal);
	const rawMatch = quotedMatch?.[1] ?? /filename=([^;]+)/i.exec(headerVal)?.[1];
	if (!rawMatch) {
		return null;
	}
	const sanitized = rawMatch
		.trim()
		.replace(/^["']|["']$/g, '')
		.split(/[/\\]/)
		.pop()
		?.trim();
	return sanitized && sanitized.length > 0 ? sanitized : null;
}

export function buildFallbackExportFilename(
	protocolCode: string,
	runVersion: number,
	artifact: ExportArtifactType,
): string {
	return artifact === 'pdf'
		? `CARTA_IMAGEM_${protocolCode}_v${runVersion}.pdf`
		: `PACOTE_${protocolCode}_v${runVersion}.zip`;
}

/**
 * Dispara geração assíncrona da Carta-Imagem PDF 300 DPI e Pacote Técnico .zip (analista apenas, 202 Accepted).
 */
export async function requestRunExport(
	runId: string,
	body: RequestExportBody,
	idempotencyKey: string,
	client: SicamApiClient = apiClient,
): Promise<RequestExportAcceptedResponse> {
	const cleanKey = idempotencyKey.trim();
	if (!isValidUuid(cleanKey)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Chave de idempotência inválida',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'Idempotency-Key deve ser um UUID válido para solicitar a exportação.',
			instance: `/api/v1/runs/${runId}/export`,
			correlationId: '',
			invalidParams: [{ field: 'idempotency-key', reason: 'INVALID_UUID' }],
		});
	}

	const trimmedObs = body.observations?.trim() ?? '';
	if (trimmedObs.length > MAX_EXPORT_OBSERVATIONS_LENGTH) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Observações excedem o limite permitido',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: `As observações técnicas devem ter no máximo ${MAX_EXPORT_OBSERVATIONS_LENGTH} caracteres.`,
			instance: `/api/v1/runs/${runId}/export`,
			correlationId: '',
			invalidParams: [{ field: 'observations', reason: 'MAX_LENGTH_600_EXCEEDED' }],
		});
	}

	const normalizedBody: RequestExportBody = {
		paperFormat: body.paperFormat ?? 'A3',
		observations: trimmedObs.length > 0 ? trimmedObs : null,
		...(body.t0WaybackReleaseNum !== undefined
			? { t0WaybackReleaseNum: body.t0WaybackReleaseNum }
			: {}),
		...(body.t1WaybackReleaseNum !== undefined
			? { t1WaybackReleaseNum: body.t1WaybackReleaseNum }
			: {}),
	};

	const result = await client.POST('/api/v1/runs/{runId}/export', {
		params: {
			path: { runId },
			header: { 'idempotency-key': cleanKey },
		},
		body: normalizedBody,
	});

	return unwrapApiResult(result);
}

/**
 * Consulta metadados, cadeia de hashes SHA-256 e manifesto de auditoria da execução congelada.
 */
export async function getRunExportMetadata(
	runId: string,
	client: SicamApiClient = apiClient,
): Promise<ExportMetadataResponse> {
	const result = await client.GET('/api/v1/runs/{runId}/export', {
		params: {
			path: { runId },
		},
	});
	return unwrapApiResult(result);
}

/**
 * Faz download autenticado em streaming (Bearer + audit log export_downloaded) do PDF ou Pacote ZIP no S3 privado.
 */
export async function downloadExportArtifact(
	exportId: string,
	artifact: ExportArtifactType,
	fallbackMeta: { protocolCode: string; runVersion: number },
	options?: CreateSicamApiClientOptions,
): Promise<{ blob: Blob; fileName: string; sha256Header: string | null }> {
	if (!isValidUuid(exportId) || (artifact !== 'pdf' && artifact !== 'zip')) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Parâmetros de download inválidos',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'exportId ou tipo de artefato inválido.',
			instance: '/api/v1/exports/download',
			correlationId: '',
			invalidParams: [{ field: 'exportId', reason: 'INVALID_DOWNLOAD_REQUEST' }],
		});
	}

	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl =
		options?.fetchImpl ?? ((input: Request) => globalThis.fetch.call(globalThis, input));
	const correlationId = generateRequestId();
	const url = `${baseUrl}/api/v1/exports/${exportId.trim()}/download?artifact=${artifact}`;

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

	const fileName =
		parseContentDispositionFilename(response.headers.get('content-disposition')) ??
		buildFallbackExportFilename(fallbackMeta.protocolCode, fallbackMeta.runVersion, artifact);
	const sha256Header = response.headers.get('x-artifact-sha256');
	const blob = await response.blob();

	return { blob, fileName, sha256Header };
}

export function triggerBrowserBlobDownload(blob: Blob, fileName: string): void {
	if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
		return;
	}
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = objectUrl;
	anchor.download = fileName;
	anchor.rel = 'noopener noreferrer';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => {
		URL.revokeObjectURL(objectUrl);
	}, 1500);
}
