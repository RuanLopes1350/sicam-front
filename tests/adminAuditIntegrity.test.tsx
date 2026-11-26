import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogsTable } from '@/components/audit/AuditLogsTable';
import { IntegrityResultCard } from '@/components/integrity/IntegrityResultCard';
import { IntegrityVerifierForm } from '@/components/integrity/IntegrityVerifierForm';
import { UsersTable } from '@/components/users/UsersTable';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { resetTokenStoreForTesting, setAuthSession } from '@/lib/api/tokenStore';
import {
	AUDIT_ACTION_META,
	isValidUuid,
	listAuditLogs,
	toIsoUtcDateTime,
} from '@/lib/audit/auditService';
import {
	isValidSha256Hex,
	verifyIntegrityByFile,
	verifyIntegrityByHash,
} from '@/lib/integrity/integrityService';
import { createUser, listUsers, updateUser } from '@/lib/users/userService';
import { formatBytesPtBr } from '@/lib/utils/formatters';
import type {
	AuditAction,
	AuditLogItem,
	IntegrityVerifyResponse,
	UserAccountItem,
} from '@/types/api';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const ANALYST_ID = '22222222-2222-4222-8222-222222222222';
const SAMPLE_SHA256 = 'a'.repeat(64);

const SAMPLE_USERS: UserAccountItem[] = [
	{
		id: ADMIN_ID,
		fullName: 'Administrador Principal',
		registrationCode: 'ADM-0001',
		email: 'admin@sicam.gov.br',
		role: 'admin',
		active: true,
		lastLoginAt: '2026-10-10T12:00:00.000Z',
		createdAt: '2026-01-01T10:00:00.000Z',
		updatedAt: '2026-10-10T12:00:00.000Z',
	},
	{
		id: ANALYST_ID,
		fullName: 'Analista Geo RO',
		registrationCode: 'ANA-1042',
		email: 'analista@sicam.gov.br',
		role: 'analyst',
		active: true,
		lastLoginAt: null,
		createdAt: '2026-02-01T10:00:00.000Z',
		updatedAt: '2026-02-01T10:00:00.000Z',
	},
];

const SAMPLE_AUDIT_ITEMS: AuditLogItem[] = [
	{
		seqId: 120,
		actorUserId: ADMIN_ID,
		actor: {
			fullName: 'Administrador Principal',
			registrationCode: 'ADM-0001',
		},
		action: 'user_deactivated',
		entityType: 'user',
		entityId: ANALYST_ID,
		ipAddress: '10.20.30.40',
		userAgent: 'Vitest/1.0',
		correlationId: '33333333-3333-4333-8333-333333333333',
		metadata: {
			revokedSessions: 2,
			active: false,
		},
		occurredAt: '2026-10-11T14:25:00.000Z',
	},
];

describe('WEB-03 — Operadores (/admin/users), Auditoria (/audit-logs) e Integridade SHA-256 (/integrity)', () => {
	beforeEach(() => {
		resetTokenStoreForTesting();
		setAuthSession({
			accessToken: 'jwt-admin-token',
			expiresInSeconds: 900,
			user: {
				id: ADMIN_ID,
				fullName: 'Administrador Principal',
				registrationCode: 'ADM-0001',
				email: 'admin@sicam.gov.br',
				role: 'admin',
			},
		});
	});

	it('deve listar, cadastrar (normalizando dados/409) e desativar operadores via API tipada', async () => {
		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);
			expect(req.headers.get('authorization')).toBe('Bearer jwt-admin-token');

			if (url.pathname === '/api/v1/users' && req.method === 'GET') {
				expect(url.searchParams.get('role')).toBe('analyst');
				expect(url.searchParams.get('active')).toBe('true');
				return new Response(JSON.stringify({ items: [SAMPLE_USERS[1]] }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}

			if (url.pathname === '/api/v1/users' && req.method === 'POST') {
				const body = (await req.json()) as {
					fullName: string;
					registrationCode: string;
					email: string;
					password: string;
					role: string;
				};

				if (body.registrationCode === 'DUPLICADA') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/conflict',
							title: 'Conflito de cadastro',
							status: 409,
							code: 'ERR_RESOURCE_CONFLICT',
							detail: 'Matrícula já cadastrada.',
							instance: url.pathname,
							correlationId: '44444444-4444-4444-8444-444444444444',
						}),
						{ status: 409, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(body.fullName).toBe('Maria Geo');
				expect(body.registrationCode).toBe('AUD-900');
				expect(body.email).toBe('maria@sicam.gov.br');
				expect(body.password).toBe('SenhaForte@2026!');

				return new Response(
					JSON.stringify({
						...SAMPLE_USERS[1],
						fullName: body.fullName,
						registrationCode: body.registrationCode,
						email: body.email,
						role: 'auditor',
					}),
					{ status: 201, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === `/api/v1/users/${ANALYST_ID}` && req.method === 'PATCH') {
				const body = (await req.json()) as { active?: boolean };
				expect(body).toEqual({ active: false });
				return new Response(
					JSON.stringify({
						...SAMPLE_USERS[1],
						active: false,
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

		const listed = await listUsers({ role: 'analyst', active: 'true' }, client);
		expect(listed.items).toHaveLength(1);
		expect(listed.items[0]?.registrationCode).toBe('ANA-1042');

		const created = await createUser(
			{
				fullName: '  Maria Geo  ',
				registrationCode: '  AUD-900 ',
				email: '  MARIA@SICAM.GOV.BR ',
				password: 'SenhaForte@2026!',
				role: 'auditor',
			},
			client,
		);
		expect(created.email).toBe('maria@sicam.gov.br');
		expect(created.role).toBe('auditor');

		await expect(
			createUser(
				{
					fullName: 'Duplicado',
					registrationCode: 'DUPLICADA',
					email: 'dup@sicam.gov.br',
					password: 'SenhaForte@2026!',
					role: 'analyst',
				},
				client,
			),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_RESOURCE_CONFLICT',
		);

		const deactivated = await updateUser(ANALYST_ID, { active: false }, client);
		expect(deactivated.active).toBe(false);
	});

	it('deve cobrir todas as 17 ações de auditoria e consultar GET /audit-logs com paginação keyset', async () => {
		const expectedActions: AuditAction[] = [
			'auth_login_success',
			'auth_login_failed',
			'auth_token_revoked',
			'auth_token_reuse_detected',
			'user_created',
			'user_updated',
			'user_deactivated',
			'ibge_state_imported',
			'case_created',
			'run_created',
			'run_completed',
			'run_failed',
			'feature_reviewed',
			'export_requested',
			'export_generated',
			'export_downloaded',
			'integrity_verified',
		];
		expect(Object.keys(AUDIT_ACTION_META)).toHaveLength(17);
		for (const action of expectedActions) {
			expect(AUDIT_ACTION_META[action].label.length).toBeGreaterThan(3);
		}

		expect(isValidUuid(ADMIN_ID)).toBe(true);
		expect(isValidUuid('not-a-uuid')).toBe(false);
		expect(toIsoUtcDateTime('')).toBeUndefined();
		expect(toIsoUtcDateTime('2026-10-10T10:00:00Z')).toBe('2026-10-10T10:00:00.000Z');

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);
			expect(url.pathname).toBe('/api/v1/audit-logs');
			expect(url.searchParams.get('cursorSeqId')).toBe('150');
			expect(url.searchParams.get('limit')).toBe('25');
			expect(url.searchParams.get('action')).toBe('user_deactivated');
			expect(url.searchParams.get('entityType')).toBe('user');

			return new Response(
				JSON.stringify({
					items: SAMPLE_AUDIT_ITEMS,
					nextCursorSeqId: 95,
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			);
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		const page = await listAuditLogs(
			{
				cursorSeqId: 150,
				limit: 25,
				action: 'user_deactivated',
				entityType: 'user',
			},
			client,
		);

		expect(page.items).toHaveLength(1);
		expect(page.nextCursorSeqId).toBe(95);
		expect(page.items[0]?.seqId).toBe(120);
	});

	it('deve validar SHA-256 JSON, executar upload multipart com retry 401 single-flight e bloquear arquivos inválidos', async () => {
		expect(isValidSha256Hex(SAMPLE_SHA256.toUpperCase())).toBe(true);
		expect(isValidSha256Hex('abc')).toBe(false);
		expect(isValidSha256Hex('g'.repeat(64))).toBe(false);

		expect(formatBytesPtBr(null)).toBe('—');
		expect(formatBytesPtBr(0)).toBe('0 B');
		expect(formatBytesPtBr(512)).toBe('512 B');
		expect(formatBytesPtBr(2048)).toBe('2 KB');
		expect(formatBytesPtBr(5 * 1024 * 1024)).toBe('5 MB');

		const authenticResponse: IntegrityVerifyResponse = {
			verified: true,
			matchedArtifact: 'PDF_CARTA_IMAGEM',
			sha256: SAMPLE_SHA256,
			record: {
				exportId: '55555555-5555-4555-8555-555555555555',
				protocolCode: 'SICAM-2026-00012',
				title: 'Desmatamento Rio Machado',
				municipality: 'Ji-Paraná - RO',
				runVersion: 2,
				t0AcquiredAt: '2025-07-10T14:20:00.000Z',
				t1AcquiredAt: '2026-07-15T14:20:00.000Z',
				deforestationHa: 18.42,
				regrowthHa: 2.15,
				cartographicScale: 25000,
				paperFormat: 'A3',
				generatedAt: '2026-10-11T15:00:00.000Z',
				issuer: {
					fullName: 'Analista Geo RO',
					registrationCode: 'ANA-1042',
				},
			},
		};

		let multipartAttempts = 0;
		let refreshCalls = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);

			if (url.pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-refreshed-multipart',
						expiresInSeconds: 900,
						user: {
							id: ADMIN_ID,
							fullName: 'Administrador Principal',
							registrationCode: 'ADM-0001',
							email: 'admin@sicam.gov.br',
							role: 'admin',
						},
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === '/api/v1/integrity/verify') {
				const contentType = req.headers.get('content-type') ?? '';
				if (contentType.includes('application/json')) {
					const payload = (await req.json()) as { sha256: string };
					expect(payload.sha256).toBe(SAMPLE_SHA256);
					return new Response(JSON.stringify(authenticResponse), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					});
				}

				expect(contentType.startsWith('multipart/form-data; boundary=')).toBe(true);
				const parsedForm = await req.formData();
				const uploaded = parsedForm.get('file');
				expect(uploaded).not.toBeNull();

				multipartAttempts += 1;
				if (multipartAttempts === 1) {
					expect(req.headers.get('authorization')).toBe('Bearer jwt-admin-token');
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/unauthorized',
							title: 'Token expirado',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'Expirado.',
							instance: url.pathname,
							correlationId: '66666666-6666-4666-8666-666666666666',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(req.headers.get('authorization')).toBe('Bearer jwt-refreshed-multipart');
				return new Response(
					JSON.stringify({
						verified: false,
						matchedArtifact: null,
						sha256: 'b'.repeat(64),
						record: null,
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

		const hashResult = await verifyIntegrityByHash(SAMPLE_SHA256.toUpperCase(), client);
		expect(hashResult.verified).toBe(true);
		expect(hashResult.record?.protocolCode).toBe('SICAM-2026-00012');

		const emptyBlob = new Blob([], { type: 'application/pdf' });
		await expect(
			verifyIntegrityByFile(emptyBlob, {
				fileName: 'vazio.pdf',
				baseUrl: 'https://api.sicam.test',
				fetchImpl: mockFetch,
			}),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);

		const invalidExtBlob = new Blob(['texto'], { type: 'text/plain' });
		await expect(
			verifyIntegrityByFile(invalidExtBlob, {
				fileName: 'malicioso.exe',
				baseUrl: 'https://api.sicam.test',
				fetchImpl: mockFetch,
			}),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);

		const pdfBlob = new Blob(['%PDF-1.7 test artifact'], { type: 'application/pdf' });
		const uploadResult = await verifyIntegrityByFile(pdfBlob, {
			fileName: 'carta-oficial.pdf',
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		expect(refreshCalls).toBe(1);
		expect(multipartAttempts).toBe(2);
		expect(uploadResult.verified).toBe(false);
		expect(uploadResult.sha256).toBe('b'.repeat(64));
	});

	it('deve renderizar markup SSR completo de UsersTable, AuditLogsTable, IntegrityVerifierForm e IntegrityResultCard', () => {
		const usersHtml = renderToStaticMarkup(
			<UsersTable
				users={SAMPLE_USERS}
				totalCountBeforeSearch={2}
				currentUserId={ADMIN_ID}
				isLoading={false}
				onEdit={() => undefined}
				onToggleStatus={() => undefined}
			/>,
		);
		expect(usersHtml).toContain('Administrador Principal');
		expect(usersHtml).toContain('Sua conta');
		expect(usersHtml).toContain('ANA-1042');
		expect(usersHtml).toContain('disabled=""');

		const auditHtml = renderToStaticMarkup(
			<AuditLogsTable
				items={SAMPLE_AUDIT_ITEMS}
				nextCursorSeqId={99}
				hasCursorActive={true}
				isLoading={false}
				onLoadOlder={() => undefined}
				onResetToLatest={() => undefined}
			/>,
		);
		expect(auditHtml).toContain('#120');
		expect(auditHtml).toContain('Operador desativado');
		expect(auditHtml).toContain('ADM-0001');
		expect(auditHtml).toContain('Carregar anteriores');
		expect(auditHtml).toContain('Voltar aos mais recentes');

		const formHtml = renderToStaticMarkup(
			<IntegrityVerifierForm
				isVerifying={false}
				onVerifyFile={() => undefined}
				onVerifyHash={() => undefined}
			/>,
		);
		expect(formHtml).toContain('Upload de Arquivo (.pdf / .zip)');
		expect(formHtml).toContain('Consultar Hash SHA-256');

		const verifiedHtml = renderToStaticMarkup(
			<IntegrityResultCard
				result={{
					verified: true,
					matchedArtifact: 'ZIP_PACOTE_TECNICO',
					sha256: SAMPLE_SHA256,
					record: {
						exportId: '55555555-5555-4555-8555-555555555555',
						protocolCode: 'SICAM-2026-00012',
						title: 'Desmatamento Rio Machado',
						municipality: 'Ji-Paraná - RO',
						runVersion: 2,
						t0AcquiredAt: '2025-07-10T14:20:00.000Z',
						t1AcquiredAt: '2026-07-15T14:20:00.000Z',
						deforestationHa: 18.42,
						regrowthHa: 2.15,
						cartographicScale: 25000,
						paperFormat: 'A3',
						generatedAt: '2026-10-11T15:00:00.000Z',
						issuer: {
							fullName: 'Analista Geo RO',
							registrationCode: 'ANA-1042',
						},
					},
				}}
			/>,
		);
		expect(verifiedHtml).toContain('DOCUMENTO AUTÊNTICO');
		expect(verifiedHtml).toContain('SICAM-2026-00012');
		expect(verifiedHtml).toContain('Ji-Paraná - RO');
		expect(verifiedHtml).toContain('Pacote Técnico Pericial Completo (.ZIP)');

		const tamperedHtml = renderToStaticMarkup(
			<IntegrityResultCard
				result={{
					verified: false,
					matchedArtifact: null,
					sha256: 'c'.repeat(64),
					record: null,
				}}
			/>,
		);
		expect(tamperedHtml).toContain('NÃO RECONHECIDO OU ADULTERADO');
		expect(tamperedHtml).toContain('c'.repeat(64));
	});
});
