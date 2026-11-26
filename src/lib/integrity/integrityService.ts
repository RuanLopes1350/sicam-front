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
import type { IntegrityMatchedArtifact, IntegrityVerifyResponse } from '@/types/api';

export const MAX_INTEGRITY_UPLOAD_BYTES = 100 * 1024 * 1024;
export const SHA256_HEX_REGEX = /^[a-fA-F0-9]{64}$/;

export const MATCHED_ARTIFACT_LABELS: Record<IntegrityMatchedArtifact, string> = {
	PDF_CARTA_IMAGEM: 'Carta-Imagem Comparativa Oficial (.PDF — 300 DPI)',
	ZIP_PACOTE_TECNICO: 'Pacote Técnico Pericial Completo (.ZIP)',
};

export function isValidSha256Hex(value: string): boolean {
	return SHA256_HEX_REGEX.test(value.trim());
}

function generateRequestId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return '00000000-0000-4000-8000-000000000000';
}

function resolveFileName(file: File | Blob, explicitName?: string): string {
	if (explicitName?.trim()) {
		return explicitName.trim();
	}
	if (typeof File !== 'undefined' && file instanceof File && file.name.trim()) {
		return file.name.trim();
	}
	return 'documento.pdf';
}

function isAllowedIntegrityExtension(fileName: string): boolean {
	const lower = fileName.trim().toLowerCase();
	return lower.endsWith('.pdf') || lower.endsWith('.zip');
}

async function readProblemBodySafely(response: Response): Promise<unknown> {
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
 * Verifica autenticidade de artefato oficial via hash SHA-256 hexadecimal (JSON).
 */
export async function verifyIntegrityByHash(
	sha256: string,
	client: SicamApiClient = apiClient,
): Promise<IntegrityVerifyResponse> {
	const cleanHash = sha256.trim().toLowerCase();
	if (!isValidSha256Hex(cleanHash)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Hash SHA-256 inválido',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'Informe exatamente 64 caracteres hexadecimais (0-9 e a-f) sem espaços.',
			instance: '/api/v1/integrity/verify',
			correlationId: '',
			invalidParams: [{ field: 'sha256', reason: 'INVALID_SHA256_HEX' }],
		});
	}

	const result = await client.POST('/api/v1/integrity/verify', {
		body: { sha256: cleanHash },
	});

	return unwrapApiResult(result);
}

/**
 * Verifica autenticidade via upload multipart/form-data (.pdf ou .zip até 100 MB),
 * sem definir Content-Type manual para preservar o boundary gerado pelo runtime.
 */
export async function verifyIntegrityByFile(
	file: File | Blob,
	options?: CreateSicamApiClientOptions & { fileName?: string },
): Promise<IntegrityVerifyResponse> {
	const resolvedFileName = resolveFileName(file, options?.fileName);

	if (!isAllowedIntegrityExtension(resolvedFileName)) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Extensão de arquivo não suportada',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'Apenas documentos oficiais .pdf ou pacotes técnicos .zip são aceitos para verificação.',
			instance: '/api/v1/integrity/verify',
			correlationId: '',
			invalidParams: [{ field: 'file', reason: 'UNSUPPORTED_EXTENSION' }],
		});
	}

	if (file.size <= 0) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Arquivo vazio',
			status: 400,
			code: 'ERR_VALIDATION_FAILED',
			detail: 'O arquivo selecionado está vazio (0 bytes) e não pode ser verificado.',
			instance: '/api/v1/integrity/verify',
			correlationId: '',
			invalidParams: [{ field: 'file', reason: 'EMPTY_FILE' }],
		});
	}

	if (file.size > MAX_INTEGRITY_UPLOAD_BYTES) {
		throw new ApiProblemError({
			type: 'about:blank',
			title: 'Arquivo excede o limite permitido',
			status: 413,
			code: 'ERR_PAYLOAD_TOO_LARGE',
			detail: 'O arquivo excede o limite máximo de 100 MB para verificação de integridade.',
			instance: '/api/v1/integrity/verify',
			correlationId: '',
			invalidParams: [{ field: 'file', reason: 'MAX_SIZE_EXCEEDED' }],
		});
	}

	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl = options?.fetchImpl ?? ((input: Request) => globalThis.fetch.call(globalThis, input));
	const correlationId = generateRequestId();

	const sendMultipart = async (bearerToken: string | null): Promise<Response> => {
		const formData = new FormData();
		formData.append('file', file, resolvedFileName);

		const headers = new Headers();
		headers.set('x-request-id', correlationId);
		if (bearerToken) {
			headers.set('authorization', `Bearer ${bearerToken}`);
		}

		const request = new Request(`${baseUrl}/api/v1/integrity/verify`, {
			method: 'POST',
			credentials: 'include',
			headers,
			body: formData,
		});

		return fetchImpl(request);
	};

	let response = await sendMultipart(getAccessToken());
	if (response.status === 401) {
		const refreshedToken = await refreshSessionSingleFlight({ baseUrl, fetchImpl });
		if (refreshedToken) {
			response = await sendMultipart(refreshedToken);
		}
	}

	if (!response.ok) {
		const errorBody = await readProblemBodySafely(response);
		throw parseProblemResponse(response.status, errorBody);
	}

	return (await response.json()) as IntegrityVerifyResponse;
}
