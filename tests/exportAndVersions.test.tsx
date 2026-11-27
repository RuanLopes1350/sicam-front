import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FrozenExportCustodyCard } from '@/components/runs/FrozenExportCustodyCard';
import { RequestExportModal } from '@/components/runs/RequestExportModal';
import { RunProgressTracker } from '@/components/runs/RunProgressTracker';
import { RunVersionSelectorBar } from '@/components/runs/RunVersionSelectorBar';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { resetTokenStoreForTesting, setAuthSession } from '@/lib/api/tokenStore';
import {
	buildFallbackExportFilename,
	downloadExportArtifact,
	getRunExportMetadata,
	parseContentDispositionFilename,
	requestRunExport,
} from '@/lib/exports/exportService';
import {
	deriveExportIdempotencyFingerprint,
	EXPORT_PIPELINE_STEPS,
	resolveExportPipelineStepIndex,
} from '@/lib/runs/runStages';
import type { CaseRunSummaryItem, ExportMetadataResponse } from '@/types/api';

const ANALYST_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '77777777-7777-4777-8777-777777777777';
const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EXPORT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const IDEMPOTENCY_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const SAMPLE_EXPORT_META: ExportMetadataResponse = {
	exportId: EXPORT_ID,
	runId: RUN_ID,
	caseId: CASE_ID,
	protocolCode: 'SICAM-2026-00042',
	runVersion: 2,
	paperFormat: 'A3',
	cartographicScale: 25000,
	observations: 'Emissão revisada após descarte de nuvem residual.',
	pdfSizeBytes: 2_450_000,
	pdfSha256: 'a'.repeat(64),
	zipSizeBytes: 4_890_000,
	zipSha256: 'b'.repeat(64),
	generatedAt: '2026-10-12T16:30:00.000Z',
	issuer: {
		id: ANALYST_ID,
		fullName: 'Analista Geo RO',
		registrationCode: 'ANA-1042',
	},
	downloads: {
		pdfUrl: `/api/v1/exports/${EXPORT_ID}/download?artifact=pdf`,
		zipUrl: `/api/v1/exports/${EXPORT_ID}/download?artifact=zip`,
	},
	auditManifest: {
		schemaVersion: '1.0',
		protocolCode: 'SICAM-2026-00042',
		runVersion: 2,
	},
};

const SAMPLE_VERSIONS: CaseRunSummaryItem[] = [
	{
		id: RUN_ID,
		version: 2,
		status: 'frozen',
		presetName: 'TECHNICAL_STANDARD',
		isCustomParams: false,
		seasonalityWarning: false,
		t0AcquiredAt: '2025-07-10T14:20:00.000Z',
		t1AcquiredAt: '2026-07-15T14:20:00.000Z',
		deforestationHa: 18.75,
		degradationHa: 2.1,
		regrowthHa: 0.9,
		cloudMaskedHa: 1.2,
		queuedAt: '2026-10-12T14:00:00.000Z',
		finishedAt: '2026-10-12T14:05:00.000Z',
	},
	{
		id: '99999999-9999-4999-8999-999999999991',
		version: 1,
		status: 'ready_for_review',
		presetName: 'CONSERVATIVE',
		isCustomParams: false,
		seasonalityWarning: true,
		t0AcquiredAt: '2025-07-10T14:20:00.000Z',
		t1AcquiredAt: '2026-07-15T14:20:00.000Z',
		deforestationHa: 14.2,
		degradationHa: 1.5,
		regrowthHa: 0.4,
		cloudMaskedHa: 3.1,
		queuedAt: '2026-10-11T10:00:00.000Z',
		finishedAt: '2026-10-11T10:04:00.000Z',
	},
];

describe('WEB-08 — Emissão Cartográfica A4/A3, Download Autenticado, Selo FROZEN e Versões v1..vN', () => {
	beforeEach(() => {
		resetTokenStoreForTesting();
		setAuthSession({
			accessToken: 'jwt-analyst-token',
			expiresInSeconds: 900,
			user: {
				id: ANALYST_ID,
				fullName: 'Analista Geo RO',
				registrationCode: 'ANA-1042',
				email: 'analista@sicam.gov.br',
				role: 'analyst',
			},
		});
	});

	it('deve gerenciar etapas da fila cartográfica, fingerprint idempotente e nomes seguros de download', () => {
		expect(EXPORT_PIPELINE_STEPS).toHaveLength(4);
		expect(resolveExportPipelineStepIndex(0)).toBe(0);
		expect(resolveExportPipelineStepIndex(25)).toBe(1);
		expect(resolveExportPipelineStepIndex(65)).toBe(2);
		expect(resolveExportPipelineStepIndex(90)).toBe(3);

		const fp1 = deriveExportIdempotencyFingerprint(RUN_ID, 'A3', '  Nota pericial  ');
		const fp2 = deriveExportIdempotencyFingerprint(RUN_ID, 'A3', 'Nota pericial');
		const fpA4 = deriveExportIdempotencyFingerprint(RUN_ID, 'A4', 'Nota pericial');
		expect(fp1).toBe(fp2);
		expect(fp1).not.toBe(fpA4);

		expect(
			parseContentDispositionFilename('attachment; filename="CARTA_IMAGEM_SICAM-2026-00042_v2.pdf"'),
		).toBe('CARTA_IMAGEM_SICAM-2026-00042_v2.pdf');
		expect(
			parseContentDispositionFilename('attachment; filename="../../etc/evil.pdf"'),
		).toBe('evil.pdf');
		expect(buildFallbackExportFilename('SICAM-2026-00042', 2, 'zip')).toBe(
			'PACOTE_SICAM-2026-00042_v2.zip',
		);
	});

	it('deve solicitar exportação com Idempotency-Key (202), ler metadados FROZEN e baixar PDF autenticado com retry 401', async () => {
		let downloadCalls = 0;
		let refreshCalls = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);

			if (url.pathname === `/api/v1/runs/${RUN_ID}/export` && req.method === 'POST') {
				expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
				expect(req.headers.get('idempotency-key')).toBe(IDEMPOTENCY_UUID);

				const body = (await req.json()) as {
					paperFormat: string;
					observations: string | null;
				};
				if (body.paperFormat === 'A4') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/frozen',
							title: 'Versão congelada',
							status: 409,
							code: 'ERR_RUN_FROZEN',
							detail: 'Execução já congelada.',
							instance: url.pathname,
							correlationId: '16161616-1616-4161-8161-161616161616',
						}),
						{ status: 409, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(body.observations).toBe('Observação técnica');
				return new Response(
					JSON.stringify({
						runId: RUN_ID,
						status: 'exporting',
						eventsUrl: `/api/v1/runs/${RUN_ID}/events`,
					}),
					{ status: 202, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === `/api/v1/runs/${RUN_ID}/export` && req.method === 'GET') {
				return new Response(JSON.stringify(SAMPLE_EXPORT_META), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}

			if (url.pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-refreshed-export',
						expiresInSeconds: 900,
						user: {
							id: ANALYST_ID,
							fullName: 'Analista Geo RO',
							registrationCode: 'ANA-1042',
							email: 'analista@sicam.gov.br',
							role: 'analyst',
						},
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === `/api/v1/exports/${EXPORT_ID}/download` && req.method === 'GET') {
				expect(url.searchParams.get('artifact')).toBe('pdf');
				downloadCalls += 1;
				if (downloadCalls === 1) {
					expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
					return new Response(
						JSON.stringify({
							type: 'about:blank',
							title: 'Expirado',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'Token expirado.',
							instance: url.pathname,
							correlationId: '17171717-1717-4171-8171-171717171717',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(req.headers.get('authorization')).toBe('Bearer jwt-refreshed-export');
				return new Response(new Uint8Array([37, 80, 68, 70]), {
					status: 200,
					headers: {
						'content-type': 'application/pdf',
						'content-disposition':
							'attachment; filename="CARTA_IMAGEM_SICAM-2026-00042_v2.pdf"',
						'x-artifact-sha256': 'a'.repeat(64),
					},
				});
			}

			return new Response('Not Found', { status: 404 });
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		const accepted = await requestRunExport(
			RUN_ID,
			{ paperFormat: 'A3', observations: '  Observação técnica  ' },
			IDEMPOTENCY_UUID,
			client,
		);
		expect(accepted.status).toBe('exporting');

		// Bloqueia client-side observações > 600 chars sem chamada de rede
		await expect(
			requestRunExport(
				RUN_ID,
				{ paperFormat: 'A3', observations: 'x'.repeat(601) },
				IDEMPOTENCY_UUID,
				client,
			),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);

		await expect(
			requestRunExport(RUN_ID, { paperFormat: 'A4', observations: null }, IDEMPOTENCY_UUID, client),
		).rejects.toSatisfy((err: unknown) => isApiProblemError(err) && err.code === 'ERR_RUN_FROZEN');

		const meta = await getRunExportMetadata(RUN_ID, client);
		expect(meta.pdfSha256).toBe('a'.repeat(64));
		expect(meta.cartographicScale).toBe(25000);

		// Anti-SSRF bloqueia exportId inválido sem rede
		const callsBeforeSsrf = mockFetch.mock.calls.length;
		await expect(
			downloadExportArtifact(
				'invalid-export-id',
				'pdf',
				{ protocolCode: 'SICAM-2026-00042', runVersion: 2 },
				{ baseUrl: 'https://api.sicam.test', fetchImpl: mockFetch },
			),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);
		expect(mockFetch.mock.calls.length).toBe(callsBeforeSsrf);

		const downloaded = await downloadExportArtifact(
			EXPORT_ID,
			'pdf',
			{ protocolCode: 'SICAM-2026-00042', runVersion: 2 },
			{ baseUrl: 'https://api.sicam.test', fetchImpl: mockFetch },
		);
		expect(refreshCalls).toBe(1);
		expect(downloadCalls).toBe(2);
		expect(downloaded.fileName).toBe('CARTA_IMAGEM_SICAM-2026-00042_v2.pdf');
		expect(downloaded.sha256Header).toBe('a'.repeat(64));
		expect(downloaded.blob.size).toBe(4);
	});

	it('deve renderizar FrozenExportCustodyCard, RunVersionSelectorBar, RequestExportModal e tracker exporting em SSR', () => {
		const custodyHtml = renderToStaticMarkup(
			<FrozenExportCustodyCard runId={RUN_ID} initialMetadata={SAMPLE_EXPORT_META} />,
		);
		expect(custodyHtml).toContain('SELO FROZEN');
		expect(custodyHtml).toContain('1:25.000');
		expect(custodyHtml).toContain('a'.repeat(64));
		expect(custodyHtml).toContain('b'.repeat(64));
		expect(custodyHtml).toContain('Baixar Carta-Imagem (.PDF)');
		expect(custodyHtml).toContain('Baixar Pacote Técnico (.ZIP)');

		const selectorHtml = renderToStaticMarkup(
			<RunVersionSelectorBar
				caseId={CASE_ID}
				runs={SAMPLE_VERSIONS}
				currentRunId={RUN_ID}
				isAnalyst={true}
			/>,
		);
		expect(selectorHtml).toContain('v1');
		expect(selectorHtml).toContain('v2');
		expect(selectorHtml).toContain('Nova Versão (v3)');
		expect(selectorHtml).toContain('Congelado (FROZEN)');

		const modalHtml = renderToStaticMarkup(
			<RequestExportModal
				open={true}
				runId={RUN_ID}
				runVersion={1}
				activeFeatureCount={5}
				dismissedFeatureCount={2}
				onClose={() => undefined}
				onExportRequested={() => undefined}
			/>,
		);
		expect(modalHtml).toContain('Emitir Carta-Imagem &amp; Congelar Versão v1');
		expect(modalHtml).toContain('Prancha A3 Paisagem');
		expect(modalHtml).toContain('Prancha A4 Paisagem');
		expect(modalHtml).toContain('Idempotency-Key ativa');

		const exportingHtml = renderToStaticMarkup(
			<RunProgressTracker
				caseId={CASE_ID}
				runVersion={2}
				seasonalityWarning={false}
				connectionState="streaming"
				status="exporting"
				progressPct={60}
				stepText="Renderizando Carta-Imagem 300 DPI"
				timeline={[]}
				failureInfo={null}
				lastHeartbeatAt={null}
				streamProblem={null}
			/>,
		);
		expect(exportingHtml).toContain('Emissão Cartográfica 300 DPI em Tempo Real');
		expect(exportingHtml).toContain('Pacote .ZIP &amp; Selo FROZEN');
	});
});
