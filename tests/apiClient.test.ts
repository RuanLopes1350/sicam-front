import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSicamApiClient, unwrapApiResult } from '@/lib/api/client';
import { ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import {
	clearAccessToken,
	getAccessToken,
	onSessionExpired,
	resetTokenStoreForTesting,
	setAccessToken,
	subscribeAuthToken,
} from '@/lib/api/tokenStore';
import {
	formatAreaHa,
	formatDateTimePtBr,
	formatScale,
	truncateSha256,
} from '@/lib/utils/formatters';

describe('WEB-01 — Cliente OpenAPI 3.1 Tipado, Token Store em Memória e Refresh Single-Flight', () => {
	beforeEach(() => {
		resetTokenStoreForTesting();
	});

	it('deve manter Access Token estritamente em memória RAM e notificar assinantes sem storage persistente', () => {
		const observedTokens: Array<string | null> = [];
		const unsubscribe = subscribeAuthToken((token) => observedTokens.push(token));

		expect(getAccessToken()).toBeNull();
		setAccessToken('jwt-em-memoria-1', 900);
		expect(getAccessToken()).toBe('jwt-em-memoria-1');

		clearAccessToken();
		expect(getAccessToken()).toBeNull();
		unsubscribe();

		setAccessToken('jwt-apos-unsubscribe');
		expect(observedTokens).toEqual(['jwt-em-memoria-1', null]);
		expect('localStorage' in globalThis).toBe(false);
	});

	it('deve injetar Authorization Bearer, X-Request-Id UUID v4 e credentials include nas requisições', async () => {
		setAccessToken('token-valido-abc', 900);
		let capturedRequest: Request | null = null;

		const mockFetch = vi.fn(async (req: Request) => {
			capturedRequest = req;
			return new Response(
				JSON.stringify({
					aoi: {
						minAreaHa: 0.5,
						maxAreaHa: 50000,
						maxVertices: 500,
						enforceLoadedUfs: true,
						loadedUfs: [],
					},
					analysis: {
						maxActiveRunsPerUser: 2,
						presets: {},
						hardBounds: {},
					},
					export: {
						supportedPaperFormats: ['A4', 'A3'],
						defaultPaperFormat: 'A3',
					},
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			);
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		const result = await client.GET('/api/v1/system/capabilities');
		const data = unwrapApiResult(result);

		expect(data.aoi.maxAreaHa).toBe(50000);
		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest!.headers.get('authorization')).toBe('Bearer token-valido-abc');
		expect(capturedRequest!.headers.get('x-request-id')).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(capturedRequest!.credentials).toBe('include');
	});

	it('deve deduplicar múltiplos 401 simultâneos em exatamente 1 POST /auth/refresh (single-flight) e repetir todas as chamadas', async () => {
		setAccessToken('expired-token-v1', 900);
		let refreshCallCount = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const pathname = new URL(req.url).pathname;

			if (pathname === '/api/v1/auth/refresh') {
				expect(req.method).toBe('POST');
				expect(req.credentials).toBe('include');
				refreshCallCount += 1;
				await new Promise((resolve) => setTimeout(resolve, 25));
				return new Response(
					JSON.stringify({ accessToken: 'rotated-token-v2', expiresInSeconds: 900 }),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (pathname === '/api/v1/cases') {
				const auth = req.headers.get('authorization');
				if (auth !== 'Bearer rotated-token-v2') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/unauthorized',
							title: 'Token expirado',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'Access token expirado.',
							instance: '/api/v1/cases',
							correlationId: '11111111-1111-4111-8111-111111111111',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				return new Response(
					JSON.stringify({
						items: [],
						pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			return new Response('Not Found', { status: 404 });
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		const responses = await Promise.all(
			Array.from({ length: 5 }, () => client.GET('/api/v1/cases')),
		);

		expect(refreshCallCount).toBe(1);
		expect(getAccessToken()).toBe('rotated-token-v2');
		for (const res of responses) {
			expect(res.response.status).toBe(200);
			const data = unwrapApiResult(res);
			expect(data.items).toEqual([]);
		}
	});

	it('deve limpar token e notificar expiração quando refresh falhar, sem entrar em loop em /auth/login', async () => {
		setAccessToken('stale-token', 900);
		let expiredNotifications = 0;
		onSessionExpired(() => {
			expiredNotifications += 1;
		});

		let refreshCalls = 0;
		const mockFetch = vi.fn(async (req: Request) => {
			const pathname = new URL(req.url).pathname;

			if (pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				return new Response(
					JSON.stringify({
						type: 'https://api.sicam.local/problems/token-reuse-detected',
						title: 'Reutilização detectada',
						status: 401,
						code: 'ERR_TOKEN_REUSE_DETECTED',
						detail: 'Cadeia de sessão revogada.',
						instance: '/api/v1/auth/refresh',
						correlationId: '22222222-2222-4222-8222-222222222222',
					}),
					{ status: 401, headers: { 'content-type': 'application/json' } },
				);
			}

			return new Response(
				JSON.stringify({
					type: 'https://api.sicam.local/problems/unauthorized',
					title: 'Autenticação inválida',
					status: 401,
					code: 'ERR_UNAUTHORIZED',
					detail: 'Credenciais inválidas ou sessão revogada.',
					instance: pathname,
					correlationId: '33333333-3333-4333-8333-333333333333',
				}),
				{ status: 401, headers: { 'content-type': 'application/json' } },
			);
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		// Login com 401 nunca deve disparar /auth/refresh
		const loginRes = await client.POST('/api/v1/auth/login', {
			body: { email: 'analista@sicam.gov.br', password: 'senha-errada-123' },
		});
		expect(refreshCalls).toBe(0);
		expect(() => unwrapApiResult(loginRes)).toThrow(ApiProblemError);

		// Rota autenticada com 401 aciona refresh, recebe falha e notifica expiração
		const meRes = await client.GET('/api/v1/auth/me');
		expect(refreshCalls).toBe(1);
		expect(getAccessToken()).toBeNull();
		expect(expiredNotifications).toBe(1);

		try {
			unwrapApiResult(meRes);
			expect.fail('Deveria lançar ApiProblemError');
		} catch (err) {
			expect(isApiProblemError(err)).toBe(true);
			if (isApiProblemError(err)) {
				expect(err.status).toBe(401);
				expect(err.code).toBe('ERR_UNAUTHORIZED');
				expect(err.correlationId).toBe('33333333-3333-4333-8333-333333333333');
			}
		}
	});

	it('deve formatar áreas geodésicas, escalas cartográficas, datas UTC e SHA-256 com fallback seguro', () => {
		expect(formatAreaHa(14.325, 2)).toContain('14,33 ha');
		expect(formatAreaHa(null)).toBe('—');
		expect(formatScale(25000)).toBe('1:25.000');
		expect(formatScale(0)).toBe('—');
		expect(truncateSha256('a'.repeat(64), 8, 6)).toBe('aaaaaaaa...aaaaaa');
		expect(truncateSha256('curto', 8, 6)).toBe('curto');
		expect(formatDateTimePtBr('2026-11-26T18:30:00Z')).toContain('2026');
		expect(formatDateTimePtBr('invalido')).toBe('—');
	});
});
