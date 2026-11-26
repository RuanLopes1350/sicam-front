import createClient, { type Client } from 'openapi-fetch';
import { clientEnv } from '@/config/env';
import type { AuthenticatedOperator } from '@/types/api';
import type { paths } from '@/types/generated/openapi';
import { parseProblemResponse } from './problemDetails';
import {
	clearAccessToken,
	getAccessToken,
	notifySessionExpired,
	setAccessToken,
	setAuthSession,
} from './tokenStore';

export type SicamApiClient = Client<paths>;

export interface CreateSicamApiClientOptions {
	baseUrl?: string;
	fetchImpl?: (input: Request) => Promise<Response>;
}

let refreshInFlight: Promise<string | null> | null = null;

function generateRequestId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return '00000000-0000-4000-8000-000000000000';
}

function resolveDefaultFetch(): (input: Request) => Promise<Response> {
	return (input: Request) => globalThis.fetch.call(globalThis, input);
}

// Single-flight refresh evita disparo paralelo de POST /auth/refresh que acionaria detecção de reuso
export async function refreshSessionSingleFlight(
	options?: CreateSicamApiClientOptions,
): Promise<string | null> {
	if (refreshInFlight) {
		return refreshInFlight;
	}

	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl = options?.fetchImpl ?? resolveDefaultFetch();

	refreshInFlight = (async () => {
		try {
			const refreshReq = new Request(`${baseUrl}/api/v1/auth/refresh`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					'x-request-id': generateRequestId(),
				},
			});

			const response = await fetchImpl(refreshReq);
			if (!response.ok) {
				notifySessionExpired();
				return null;
			}

			const payload = (await response.json()) as {
				accessToken?: string;
				expiresInSeconds?: number;
				user?: AuthenticatedOperator;
			};

			if (typeof payload?.accessToken !== 'string' || !payload.accessToken) {
				clearAccessToken();
				notifySessionExpired();
				return null;
			}

			if (
				payload.user &&
				typeof payload.user === 'object' &&
				typeof payload.user.id === 'string' &&
				typeof payload.user.role === 'string'
			) {
				setAuthSession({
					accessToken: payload.accessToken,
					expiresInSeconds: payload.expiresInSeconds,
					user: payload.user,
				});
			} else {
				setAccessToken(payload.accessToken, payload.expiresInSeconds);
			}
			return payload.accessToken;
		} catch {
			return null;
		} finally {
			refreshInFlight = null;
		}
	})();

	return refreshInFlight;
}

export function createSicamApiClient(
	options?: CreateSicamApiClientOptions,
): SicamApiClient {
	const baseUrl = (options?.baseUrl ?? clientEnv.API_BASE_URL).replace(/\/+$/, '');
	const fetchImpl = options?.fetchImpl ?? resolveDefaultFetch();

	const authAwareFetch = async (inputRequest: Request): Promise<Response> => {
		const pathname = new URL(inputRequest.url, 'http://localhost').pathname;
		const isCredentialEndpoint =
			pathname.endsWith('/api/v1/auth/login') || pathname.endsWith('/api/v1/auth/refresh');
		const skipAutoRefresh =
			isCredentialEndpoint || pathname.endsWith('/api/v1/auth/logout');

		// Clona antes de consumir o stream caso seja necessário repetir a chamada após refresh 401
		const retryTemplate = !skipAutoRefresh ? inputRequest.clone() : null;

		const headers = new Headers(inputRequest.headers);
		if (!headers.has('x-request-id')) {
			headers.set('x-request-id', generateRequestId());
		}
		if (!isCredentialEndpoint) {
			const token = getAccessToken();
			if (token && !headers.has('authorization')) {
				headers.set('authorization', `Bearer ${token}`);
			}
		}

		const firstAttempt = new Request(inputRequest, {
			headers,
			credentials: 'include',
		});

		const firstResponse = await fetchImpl(firstAttempt);
		if (firstResponse.status !== 401 || !retryTemplate) {
			return firstResponse;
		}

		const refreshedToken = await refreshSessionSingleFlight({ baseUrl, fetchImpl });
		if (!refreshedToken) {
			return firstResponse;
		}

		const retryHeaders = new Headers(retryTemplate.headers);
		const correlationId = headers.get('x-request-id');
		if (correlationId) {
			retryHeaders.set('x-request-id', correlationId);
		}
		retryHeaders.set('authorization', `Bearer ${refreshedToken}`);

		const retriedAttempt = new Request(retryTemplate, {
			headers: retryHeaders,
			credentials: 'include',
		});

		return fetchImpl(retriedAttempt);
	};

	return createClient<paths>({
		baseUrl,
		credentials: 'include',
		fetch: authAwareFetch,
	});
}

export function unwrapApiResult<TData>(result: {
	data?: TData;
	error?: unknown;
	response: Response;
}): TData {
	if (result.error !== undefined) {
		throw parseProblemResponse(result.response.status, result.error);
	}
	if (!result.response.ok || result.data === undefined) {
		throw parseProblemResponse(result.response.status, null);
	}
	return result.data;
}

export const apiClient: SicamApiClient = createSicamApiClient();
