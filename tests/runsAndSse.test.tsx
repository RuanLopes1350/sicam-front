import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunProgressTracker } from '@/components/runs/RunProgressTracker';
import { RunSummaryOverview } from '@/components/runs/RunSummaryOverview';
import { SelectionSummaryCard } from '@/components/scenes/SelectionSummaryCard';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { resetTokenStoreForTesting, setAuthSession } from '@/lib/api/tokenStore';
import {
	createRun,
	generateIdempotencyKey,
	getRunById,
	streamRunEvents,
} from '@/lib/runs/runService';
import {
	ANALYSIS_PIPELINE_STEPS,
	deriveIdempotencyFingerprint,
	isTerminalAnalysisStatus,
	resolvePipelineStepIndex,
} from '@/lib/runs/runStages';
import { createSseFrameParser, type ParsedRunSseEvent } from '@/lib/runs/sseParser';
import type {
	AnalysisHardBounds,
	CreateRunBody,
	CustomAlgorithmParams,
	RunDetailResponse,
	SceneCandidate,
} from '@/types/api';

const ANALYST_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '77777777-7777-4777-8777-777777777777';
const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IDEMPOTENCY_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const SAMPLE_PARAMS: CustomAlgorithmParams = {
	ndviForestMin: 0.55,
	ndviClearedMax: 0.3,
	deforestationDeltaMax: -0.25,
	degradationDeltaMax: -0.12,
	regrowthStartMax: 0.32,
	regrowthEndMin: 0.52,
	regrowthDeltaMin: 0.18,
	morphologicalKernel: 3,
	minMappingUnitHa: 0.5,
};

const SAMPLE_HARD_BOUNDS: AnalysisHardBounds = {
	ndviForestMin: { min: 0.4, max: 0.85 },
	ndviClearedMax: { min: -0.2, max: 0.45 },
	deforestationDeltaMax: { min: -0.8, max: -0.15 },
	degradationDeltaMax: { min: -0.6, max: -0.05 },
	regrowthStartMax: { min: -0.2, max: 0.45 },
	regrowthEndMin: { min: 0.35, max: 0.85 },
	regrowthDeltaMin: { min: 0.1, max: 0.6 },
	morphologicalKernel: [0, 3],
	minMappingUnitHa: { min: 0.2, max: 25 },
};

const SAMPLE_T0: SceneCandidate = {
	candidateKey: 'aws:t0',
	provider: 'aws_earth_search',
	collection: 'sentinel-2-l2a',
	itemIds: ['S2A_T0'],
	isMultiTile: false,
	acquiredAt: '2025-07-10T14:20:00.000Z',
	globalCloudPct: 5,
	aoiCloudPct: 1,
	aoiCoveragePct: 100,
	processingBaseline: '05.11',
	boaOffsetApplied: true,
	previewUrl: `/api/v1/cases/${CASE_ID}/scenes/preview?token=${'a'.repeat(40)}`,
};

const SAMPLE_T1: SceneCandidate = {
	...SAMPLE_T0,
	candidateKey: 'aws:t1',
	itemIds: ['S2B_T1'],
	acquiredAt: '2026-07-15T14:20:00.000Z',
};

const SAMPLE_RUN_BODY: CreateRunBody = {
	t0: { provider: 'aws_earth_search', collection: 'sentinel-2-l2a', itemIds: ['S2A_T0'] },
	t1: { provider: 'aws_earth_search', collection: 'sentinel-2-l2a', itemIds: ['S2B_T1'] },
	presetName: 'TECHNICAL_STANDARD',
	customParams: null,
};

const SAMPLE_RUN_DETAIL: RunDetailResponse = {
	id: RUN_ID,
	caseId: CASE_ID,
	version: 1,
	status: 'ready_for_review',
	t0: {
		provider: 'aws_earth_search',
		collection: 'sentinel-2-l2a',
		itemIds: ['S2A_T0'],
		isMultiTile: false,
		acquiredAt: '2025-07-10T14:20:00.000Z',
		aoiCloudPct: 1,
		aoiCoveragePct: 100,
		globalCloudPct: 5,
		processingBaseline: '05.11',
		boaOffsetApplied: true,
	},
	t1: {
		provider: 'aws_earth_search',
		collection: 'sentinel-2-l2a',
		itemIds: ['S2B_T1'],
		isMultiTile: false,
		acquiredAt: '2026-07-15T14:20:00.000Z',
		aoiCloudPct: 2,
		aoiCoveragePct: 100,
		globalCloudPct: 8,
		processingBaseline: '05.11',
		boaOffsetApplied: true,
	},
	seasonalityWarning: false,
	presetName: 'TECHNICAL_STANDARD',
	isCustomParams: false,
	algorithmParams: SAMPLE_PARAMS,
	engineVersion: 'geo-core/1.0.0',
	summary: {
		validAnalyzedHa: 95.4,
		cloudMaskedHa: 4.6,
		deforestationHa: 12.34,
		degradationHa: 3.21,
		regrowthHa: 1.5,
		stableHa: 78.35,
		cloudObstructionPct: 24.5,
		visibilityCompromisedWarning: true,
		activeFeatureCount: 4,
		dismissedFeatureCount: 1,
	},
	rasterAssets: [
		{
			id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
			assetType: 'delta_ndvi_mask',
			mimeType: 'image/png',
			sizeBytes: 124_000,
			sha256: 'e'.repeat(64),
			widthPx: 1024,
			heightPx: 1024,
			bounds4674: [-63.95, -8.8, -63.85, -8.7],
			url: `/api/v1/runs/${RUN_ID}/rasters/delta_ndvi_mask`,
			createdAt: '2026-07-15T15:00:00.000Z',
		},
	],
	executedBy: {
		id: ANALYST_ID,
		fullName: 'Analista Geo RO',
		registrationCode: 'ANA-1042',
	},
	errorCode: null,
	errorDetail: null,
	queuedAt: '2026-07-15T14:58:00.000Z',
	startedAt: '2026-07-15T14:58:05.000Z',
	finishedAt: '2026-07-15T15:00:00.000Z',
};

describe('WEB-06 — Disparo com Idempotency-Key, Parser SSE, Stream Bearer e Trackers', () => {
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

	it('deve parsear frames SSE fragmentados, CRLF, comentários : ping e todos os eventos terminais', () => {
		const events: ParsedRunSseEvent[] = [];
		const comments: string[] = [];

		const parser = createSseFrameParser({
			onEvent: (ev) => events.push(ev),
			onComment: (c) => comments.push(c),
		});

		const rawStream = [
			`id: 1\r\nevent: snapshot\r\ndata: {"runId":"${RUN_ID}","status":"queued","progressPct":0,"step":"Na fila","updatedAt":"2026-10-10T10:00:00Z"}\r\n\r\n`,
			`: ping\n\n`,
			`id: 2\nevent: prog`,
			`ress\ndata: {"runId":"${RUN_ID}","status":"processing_ndvi","step":"ΔNDVI","progressPct":60,"timestamp":"2026-10-10T10:01:00Z"}\n\n`,
			`id: 3\nevent: run.ready_for_review\ndata: {"runId":"${RUN_ID}","status":"ready_for_review","summary":{"deforestationHa":10,"degradationHa":2,"regrowthHa":1,"cloudMaskedHa":0,"featureCount":3}}\n\n`,
			`id: 4\nevent: run.failed\ndata: {"runId":"${RUN_ID}","status":"failed","errorCode":"ERR_GRID_PIXEL_LIMIT_EXCEEDED","message":"Grade excedeu limite."}\n\n`,
		];

		for (const chunk of rawStream) {
			parser.feed(chunk);
		}
		parser.flush();

		expect(comments).toEqual(['ping']);
		expect(events).toHaveLength(4);
		expect(events[0]?.event).toBe('snapshot');
		expect(events[1]?.event).toBe('progress');
		expect(events[2]?.event).toBe('run.ready_for_review');
		expect(events[3]?.event).toBe('run.failed');
	});

	it('deve manter fingerprint determinístico para Idempotency-Key e mapear etapas da fila', () => {
		expect(ANALYSIS_PIPELINE_STEPS).toHaveLength(5);
		expect(isTerminalAnalysisStatus('queued')).toBe(false);
		expect(isTerminalAnalysisStatus('vectorizing')).toBe(false);
		expect(isTerminalAnalysisStatus('ready_for_review')).toBe(true);
		expect(isTerminalAnalysisStatus('frozen')).toBe(true);
		expect(isTerminalAnalysisStatus('failed')).toBe(true);

		expect(resolvePipelineStepIndex('queued')).toBe(0);
		expect(resolvePipelineStepIndex('fetching_bands')).toBe(1);
		expect(resolvePipelineStepIndex('processing_ndvi')).toBe(2);
		expect(resolvePipelineStepIndex('vectorizing')).toBe(3);
		expect(resolvePipelineStepIndex('ready_for_review')).toBe(4);
		expect(resolvePipelineStepIndex('failed')).toBe(-1);

		const fpA = deriveIdempotencyFingerprint(CASE_ID, SAMPLE_RUN_BODY);
		const fpB = deriveIdempotencyFingerprint(CASE_ID, {
			...SAMPLE_RUN_BODY,
			t0: { ...SAMPLE_RUN_BODY.t0, itemIds: ['S2A_T0'] },
		});
		const fpDifferent = deriveIdempotencyFingerprint(CASE_ID, {
			...SAMPLE_RUN_BODY,
			presetName: 'CONSERVATIVE',
		});

		expect(fpA).toBe(fpB);
		expect(fpA).not.toBe(fpDifferent);

		const generatedKey = generateIdempotencyKey();
		expect(generatedKey).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it('deve disparar execução com Idempotency-Key (202), tratar erro 429 e consultar GET /runs/{runId}', async () => {
		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);
			expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');

			if (url.pathname === `/api/v1/cases/${CASE_ID}/runs` && req.method === 'POST') {
				const idemHeader = req.headers.get('idempotency-key');
				expect(idemHeader).toBe(IDEMPOTENCY_UUID);

				const body = (await req.json()) as CreateRunBody;
				if (body.presetName === 'CONSERVATIVE') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/rate-limit',
							title: 'Limite de concorrência atingido',
							status: 429,
							code: 'ERR_MAX_ACTIVE_RUNS_EXCEEDED',
							detail: 'Máximo de 2 execuções simultâneas.',
							instance: url.pathname,
							correlationId: '12121212-1212-4121-8121-121212121212',
						}),
						{ status: 429, headers: { 'content-type': 'application/json' } },
					);
				}

				return new Response(
					JSON.stringify({
						runId: RUN_ID,
						caseId: CASE_ID,
						version: 1,
						status: 'queued',
						seasonalityWarning: false,
						eventsUrl: `/api/v1/runs/${RUN_ID}/events`,
					}),
					{ status: 202, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === `/api/v1/runs/${RUN_ID}` && req.method === 'GET') {
				return new Response(JSON.stringify(SAMPLE_RUN_DETAIL), {
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

		const accepted = await createRun(CASE_ID, SAMPLE_RUN_BODY, IDEMPOTENCY_UUID, client);
		expect(accepted.runId).toBe(RUN_ID);
		expect(accepted.status).toBe('queued');

		await expect(
			createRun(CASE_ID, { ...SAMPLE_RUN_BODY, presetName: 'CONSERVATIVE' }, IDEMPOTENCY_UUID, client),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_MAX_ACTIVE_RUNS_EXCEEDED',
		);

		const detail = await getRunById(RUN_ID, client);
		expect(detail.summary.deforestationHa).toBe(12.34);
		expect(detail.rasterAssets).toHaveLength(1);
	});

	it('deve consumir SSE com Authorization Bearer sem ?token= na URL, renovar em 401 e bloquear UUID inválido', async () => {
		await expect(
			streamRunEvents('invalid-run-id', { onEvent: () => undefined }),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);

		let sseCalls = 0;
		let refreshCalls = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);

			if (url.pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-refreshed-sse',
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

			if (url.pathname === `/api/v1/runs/${RUN_ID}/events`) {
				// Zero Trust: jamais enviar token na query string
				expect(url.search).toBe('');
				expect(req.headers.get('accept')).toBe('text/event-stream');

				sseCalls += 1;
				if (sseCalls === 1) {
					expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
					return new Response(
						JSON.stringify({
							type: 'about:blank',
							title: 'Expirado',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'Token expirado.',
							instance: url.pathname,
							correlationId: '13131313-1313-4131-8131-131313131313',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(req.headers.get('authorization')).toBe('Bearer jwt-refreshed-sse');
				const encoder = new TextEncoder();
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(
							encoder.encode(
								`id: 1\nevent: snapshot\ndata: {"runId":"${RUN_ID}","status":"queued","progressPct":0,"step":"Na fila","updatedAt":"2026-10-10T10:00:00Z"}\n\n`,
							),
						);
						controller.enqueue(
							encoder.encode(
								`: ping\n\nid: 2\nevent: progress\ndata: {"runId":"${RUN_ID}","status":"fetching_bands","step":"Lendo bandas COG","progressPct":25,"timestamp":"2026-10-10T10:00:05Z"}\n\n`,
							),
						);
						controller.enqueue(
							encoder.encode(
								`id: 3\nevent: run.ready_for_review\ndata: {"runId":"${RUN_ID}","status":"ready_for_review","summary":{"deforestationHa":12.34,"degradationHa":3.21,"regrowthHa":1.5,"cloudMaskedHa":4.6,"featureCount":4}}\n\n`,
							),
						);
						controller.close();
					},
				});

				return new Response(stream, {
					status: 200,
					headers: { 'content-type': 'text/event-stream; charset=utf-8' },
				});
			}

			return new Response('Not Found', { status: 404 });
		});

		const received: ParsedRunSseEvent[] = [];
		let heartbeats = 0;

		await streamRunEvents(
			RUN_ID,
			{
				onEvent: (ev) => received.push(ev),
				onHeartbeat: () => {
					heartbeats += 1;
				},
			},
			{
				baseUrl: 'https://api.sicam.test',
				fetchImpl: mockFetch,
			},
		);

		expect(refreshCalls).toBe(1);
		expect(sseCalls).toBe(2);
		expect(heartbeats).toBe(1);
		expect(received.map((e) => e.event)).toEqual([
			'snapshot',
			'progress',
			'run.ready_for_review',
		]);
	});

	it('deve renderizar RunProgressTracker, RunSummaryOverview e SelectionSummaryCard com gatilho em SSR', () => {
		const trackerHtml = renderToStaticMarkup(
			<RunProgressTracker
				caseId={CASE_ID}
				runVersion={2}
				seasonalityWarning={true}
				connectionState="streaming"
				status="processing_ndvi"
				progressPct={60}
				stepText="Calculando Delta-NDVI e aplicando máscara SCL"
				timeline={[
					{
						key: 't1',
						timestamp: '2026-10-10T10:01:00.000Z',
						status: 'processing_ndvi',
						step: 'Cálculo ΔNDVI',
						progressPct: 60,
					},
				]}
				failureInfo={null}
				lastHeartbeatAt="2026-10-10T10:01:15.000Z"
				streamProblem={null}
			/>,
		);
		expect(trackerHtml).toContain('Versão v2');
		expect(trackerHtml).toContain('Conectado via SSE');
		expect(trackerHtml).toContain('60%');
		expect(trackerHtml).toContain('Alerta de sazonalidade');

		const summaryHtml = renderToStaticMarkup(
			<RunSummaryOverview run={SAMPLE_RUN_DETAIL} />,
		);
		expect(summaryHtml).toContain('12,34 ha');
		expect(summaryHtml).toContain('Visibilidade parcialmente comprometida');
		expect(summaryHtml).toContain('Máscara Temática ΔNDVI');
		expect(summaryHtml).toContain('WEB-07');

		const triggerHtml = renderToStaticMarkup(
			<SelectionSummaryCard
				t0={SAMPLE_T0}
				t1={SAMPLE_T1}
				presetName="TECHNICAL_STANDARD"
				customParams={SAMPLE_PARAMS}
				hardBounds={SAMPLE_HARD_BOUNDS}
				idempotencyKey={IDEMPOTENCY_UUID}
				onTriggerRun={() => undefined}
			/>,
		);
		expect(triggerHtml).toContain('Disparar Análise Multitemporal');
		expect(triggerHtml).toContain(IDEMPOTENCY_UUID);
	});
});
