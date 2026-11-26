import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenRoleView } from '@/components/auth/ForbiddenRoleView';
import { LoginForm } from '@/components/auth/LoginForm';
import { Input } from '@/components/ui/Input';
import { AuthProvider } from '@/contexts/AuthContext';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import {
	getAccessToken,
	getStoredOperator,
	resetTokenStoreForTesting,
	setAuthSession,
} from '@/lib/api/tokenStore';
import {
	loginWithCredentials,
	logoutSession,
	restoreSessionFromCookie,
} from '@/lib/auth/authService';
import {
	getDefaultLandingRoute,
	getVisibleNavigationItems,
	hasRequiredRole,
	ROLE_LABELS,
	sanitizeInternalRedirect,
} from '@/lib/auth/rbac';
import type { AuthenticatedOperator } from '@/types/api';

const ANALYST_USER: AuthenticatedOperator = {
	id: '11111111-1111-4111-8111-111111111111',
	fullName: 'Analista Geo RO',
	registrationCode: 'ANA-1042',
	email: 'analista@sicam.gov.br',
	role: 'analyst',
};

describe('WEB-02 — Autenticação em Memória, RBAC, Anti-Open-Redirect e Renderização SSR', () => {
	beforeEach(() => {
		resetTokenStoreForTesting();
	});

	it('deve aplicar matriz RBAC e rotas padrão corretas por perfil', () => {
		expect(ROLE_LABELS.analyst).toBe('Analista');
		expect(ROLE_LABELS.auditor).toBe('Auditor');
		expect(ROLE_LABELS.admin).toBe('Administrador');

		expect(hasRequiredRole(null, ['analyst'])).toBe(false);
		expect(hasRequiredRole('analyst')).toBe(true);
		expect(hasRequiredRole('analyst', ['admin', 'auditor'])).toBe(false);
		expect(hasRequiredRole('auditor', ['admin', 'auditor'])).toBe(true);
		expect(hasRequiredRole('admin', ['admin'])).toBe(true);

		expect(getDefaultLandingRoute('analyst')).toBe('/cases');
		expect(getDefaultLandingRoute('auditor')).toBe('/cases');
		expect(getDefaultLandingRoute('admin')).toBe('/admin/users');

		expect(getVisibleNavigationItems('analyst').map((i) => i.id)).toEqual([
			'cases',
			'integrity',
		]);
		expect(getVisibleNavigationItems('auditor').map((i) => i.id)).toEqual([
			'cases',
			'integrity',
			'audit-logs',
		]);
		expect(getVisibleNavigationItems('admin').map((i) => i.id)).toEqual([
			'cases',
			'integrity',
			'audit-logs',
			'admin-users',
		]);
	});

	it('deve neutralizar Open Redirect e loops para /login preservando caminhos internos válidos', () => {
		expect(sanitizeInternalRedirect(null, '/cases')).toBe('/cases');
		expect(sanitizeInternalRedirect('https://evil.local/phishing', '/cases')).toBe('/cases');
		expect(sanitizeInternalRedirect('//evil.local/phishing', '/cases')).toBe('/cases');
		expect(sanitizeInternalRedirect('/\\evil.local', '/cases')).toBe('/cases');
		expect(sanitizeInternalRedirect('javascript:alert(1)', '/cases')).toBe('/cases');
		expect(sanitizeInternalRedirect('/login?next=/cases', '/admin/users')).toBe('/admin/users');
		expect(sanitizeInternalRedirect('/cases/123?tab=features#p1', '/cases')).toBe(
			'/cases/123?tab=features#p1',
		);
	});

	it('deve autenticar, restaurar sessão em single-flight na RAM e encerrar sessão com segurança no logout', async () => {
		let refreshCalls = 0;
		let logoutCalls = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const pathname = new URL(req.url).pathname;

			if (pathname === '/api/v1/auth/login') {
				const body = (await req.json()) as { email: string; password: string };
				if (body.password !== 'SenhaForte@2026') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/unauthorized',
							title: 'Credenciais inválidas',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'E-mail ou senha incorretos.',
							instance: pathname,
							correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(body.email).toBe('analista@sicam.gov.br');
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-eddsa-login',
						expiresInSeconds: 900,
						user: ANALYST_USER,
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				await new Promise((resolve) => setTimeout(resolve, 20));
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-eddsa-restored',
						expiresInSeconds: 900,
						user: ANALYST_USER,
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (pathname === '/api/v1/auth/logout') {
				logoutCalls += 1;
				expect(req.headers.get('authorization')).toBe('Bearer jwt-eddsa-restored');
				return new Response(JSON.stringify({ revoked: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}

			return new Response('Not Found', { status: 404 });
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		// Login inválido lança ApiProblemError
		await expect(
			loginWithCredentials({ email: 'ANALISTA@SICAM.GOV.BR', password: 'errada' }, client),
		).rejects.toSatisfy((err: unknown) => isApiProblemError(err) && err.code === 'ERR_UNAUTHORIZED');

		// Login válido normaliza e-mail e popula RAM
		const loginData = await loginWithCredentials(
			{ email: '  Analista@SICAM.gov.br ', password: 'SenhaForte@2026' },
			client,
		);
		expect(loginData.user.role).toBe('analyst');
		expect(getAccessToken()).toBe('jwt-eddsa-login');
		expect(getStoredOperator()?.registrationCode).toBe('ANA-1042');

		// Simula F5 no navegador (RAM zerada, cookie HttpOnly presente) + StrictMode chamando 3x concorrentes
		resetTokenStoreForTesting();
		const restoredAll = await Promise.all([
			restoreSessionFromCookie({ baseUrl: 'https://api.sicam.test', fetchImpl: mockFetch }),
			restoreSessionFromCookie({ baseUrl: 'https://api.sicam.test', fetchImpl: mockFetch }),
			restoreSessionFromCookie({ baseUrl: 'https://api.sicam.test', fetchImpl: mockFetch }),
		]);
		expect(refreshCalls).toBe(1);
		expect(getAccessToken()).toBe('jwt-eddsa-restored');
		expect(getStoredOperator()?.id).toBe(ANALYST_USER.id);
		expect(restoredAll[0]?.user.email).toBe('analista@sicam.gov.br');

		// Logout revoga no servidor e limpa RAM
		await logoutSession(client);
		expect(logoutCalls).toBe(1);
		expect(getAccessToken()).toBeNull();
		expect(getStoredOperator()).toBeNull();
	});

	it('deve renderizar markup SSR acessível de Input, ForbiddenRoleView e LoginForm', () => {
		const inputHtml = renderToStaticMarkup(
			<Input label="Matrícula" error="Campo obrigatório" name="regCode" />,
		);
		expect(inputHtml).toContain('Matrícula');
		expect(inputHtml).toContain('aria-invalid="true"');
		expect(inputHtml).toContain('Campo obrigatório');

		const forbiddenHtml = renderToStaticMarkup(
			<ForbiddenRoleView
				userRole="analyst"
				requiredRoles={['admin']}
				userName="Analista Teste"
			/>,
		);
		expect(forbiddenHtml).toContain('Acesso Restrito por Perfil RBAC (403)');
		expect(forbiddenHtml).toContain('Analista Teste');
		expect(forbiddenHtml).toContain('Administrador');
		expect(forbiddenHtml).toContain('href="/cases"');

		setAuthSession({
			accessToken: 'jwt-ssr-test',
			expiresInSeconds: 900,
			user: ANALYST_USER,
		});

		const loginHtml = renderToStaticMarkup(
			<AuthProvider>
				<LoginForm nextPath="/cases" />
			</AuthProvider>,
		);
		expect(loginHtml).toContain('Acesso Institucional ao SICAM');
		expect(loginHtml).toContain('E-mail funcional');
		expect(loginHtml).toContain('Entrar no Sistema');
	});
});
