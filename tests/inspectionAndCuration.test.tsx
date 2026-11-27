import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DismissFeatureModal } from '@/components/runs/DismissFeatureModal';
import { FeaturesCurationTable } from '@/components/runs/FeaturesCurationTable';
import { MultitemporalSwipeMap } from '@/components/runs/MultitemporalSwipeMap';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { resetTokenStoreForTesting, setAuthSession } from '@/lib/api/tokenStore';
import {
	bounds4674ToImageCoordinates,
	computeFeaturePolygonBbox,
	filterAndSortFeatures,
	validateDismissalReason,
} from '@/lib/runs/curationLogic';
import {
	fetchRunRasterBlob,
	listRunFeaturesGeoJson,
	reviewRunFeature,
} from '@/lib/runs/curationService';
import type { DetectedFeatureGeoJson } from '@/types/api';

const ANALYST_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FEATURE_P1_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const FEATURE_P2_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

const SAMPLE_FEATURES: DetectedFeatureGeoJson[] = [
	{
		type: 'Feature',
		id: FEATURE_P2_ID,
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[-63.91, -8.76],
					[-63.905, -8.76],
					[-63.905, -8.755],
					[-63.91, -8.755],
					[-63.91, -8.76],
				],
			],
		},
		properties: {
			id: FEATURE_P2_ID,
			runId: RUN_ID,
			featureSequence: 2,
			label: 'P2',
			featureClass: 'degradation',
			areaHa: 4.5,
			pixelCount: 450,
			meanNdviT0: 0.68,
			meanNdviT1: 0.45,
			meanDeltaNdvi: -0.23,
			centroid: { lat: -8.7575, lon: -63.9075, utmE: 400100, utmN: 9031500 },
			reviewStatus: 'auto_detected',
			dismissalReason: null,
			reviewedBy: null,
			reviewedAt: null,
			createdAt: '2026-10-12T10:00:00.000Z',
		},
	},
	{
		type: 'Feature',
		id: FEATURE_P1_ID,
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[-63.92, -8.77],
					[-63.91, -8.77],
					[-63.91, -8.76],
					[-63.92, -8.76],
					[-63.92, -8.77],
				],
			],
		},
		properties: {
			id: FEATURE_P1_ID,
			runId: RUN_ID,
			featureSequence: 1,
			label: 'P1',
			featureClass: 'deforestation',
			areaHa: 18.75,
			pixelCount: 1875,
			meanNdviT0: 0.72,
			meanNdviT1: 0.21,
			meanDeltaNdvi: -0.51,
			centroid: { lat: -8.765, lon: -63.915, utmE: 399200, utmN: 9030600 },
			reviewStatus: 'confirmed',
			dismissalReason: null,
			reviewedBy: {
				id: ANALYST_ID,
				fullName: 'Analista Geo RO',
				registrationCode: 'ANA-1042',
			},
			reviewedAt: '2026-10-12T10:05:00.000Z',
			createdAt: '2026-10-12T10:00:00.000Z',
		},
	},
];

describe('WEB-07 — Mesa Swipe T0×T1, Rasters S3 Autenticados e Curadoria Auditável', () => {
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

	it('deve converter coordenadas raster SIRGAS 2000, validar justificativa >= 15 chars e ordenar feições por área', () => {
		expect(bounds4674ToImageCoordinates([-63.95, -8.8, -63.85, -8.7])).toEqual([
			[-63.95, -8.7],
			[-63.85, -8.7],
			[-63.85, -8.8],
			[-63.95, -8.8],
		]);

		expect(computeFeaturePolygonBbox(SAMPLE_FEATURES[1]!.geometry)).toEqual([
			-63.92, -8.77, -63.91, -8.76,
		]);

		expect(validateDismissalReason('')).not.toBeNull();
		expect(validateDismissalReason('   ruído curto  ')).not.toBeNull();
		expect(validateDismissalReason('x'.repeat(601))).not.toBeNull();
		expect(
			validateDismissalReason('Sombra topográfica em vertente íngreme confirmada em RGB.'),
		).toBeNull();

		// Garante ordenação decrescente (P1 antes de P2) sem mutar array original
		const sorted = filterAndSortFeatures(SAMPLE_FEATURES, {
			featureClass: 'all',
			reviewStatus: 'all',
		});
		expect(sorted.map((f) => f.properties.label)).toEqual(['P1', 'P2']);
		expect(SAMPLE_FEATURES[0]?.properties.label).toBe('P2');

		const onlyDegradation = filterAndSortFeatures(SAMPLE_FEATURES, {
			featureClass: 'degradation',
			reviewStatus: 'all',
		});
		expect(onlyDegradation).toHaveLength(1);
		expect(onlyDegradation[0]?.properties.label).toBe('P2');
	});

	it('deve listar GeoJSON, curar feição (bloqueando motivo curto e mapeando 409 frozen) e baixar raster PNG com retry 401', async () => {
		let rasterCalls = 0;
		let refreshCalls = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);

			if (url.pathname === `/api/v1/runs/${RUN_ID}/features` && req.method === 'GET') {
				expect(url.searchParams.get('format')).toBe('geojson');
				expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
				return new Response(
					JSON.stringify({
						type: 'FeatureCollection',
						runId: RUN_ID,
						features: [SAMPLE_FEATURES[1], SAMPLE_FEATURES[0]],
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (
				url.pathname === `/api/v1/runs/${RUN_ID}/features/${FEATURE_P2_ID}/review` &&
				req.method === 'PATCH'
			) {
				const body = (await req.json()) as {
					reviewStatus: string;
					dismissalReason?: string | null;
				};

				if (body.dismissalReason === 'CONGELAR_FROZEN_TESTE') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/frozen',
							title: 'Execução congelada',
							status: 409,
							code: 'ERR_RUN_FROZEN',
							detail: 'A execução já foi congelada.',
							instance: url.pathname,
							correlationId: '14141414-1414-4141-8141-141414141414',
						}),
						{ status: 409, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(body).toEqual({
					reviewStatus: 'dismissed_noise',
					dismissalReason: 'Borda residual de nuvem observada em T1.',
				});

				return new Response(
					JSON.stringify({
						feature: {
							...SAMPLE_FEATURES[0]!.properties,
							reviewStatus: 'dismissed_noise',
							dismissalReason: body.dismissalReason,
							reviewedBy: {
								id: ANALYST_ID,
								fullName: 'Analista Geo RO',
								registrationCode: 'ANA-1042',
							},
							reviewedAt: '2026-10-12T10:10:00.000Z',
						},
						updatedSummary: {
							validAnalyzedHa: 95,
							cloudMaskedHa: 5,
							deforestationHa: 18.75,
							degradationHa: 0,
							regrowthHa: 0,
							stableHa: 76.25,
							cloudObstructionPct: 5,
							visibilityCompromisedWarning: false,
							activeFeatureCount: 1,
							dismissedFeatureCount: 1,
						},
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-refreshed-raster',
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

			if (url.pathname === `/api/v1/runs/${RUN_ID}/rasters/t0_rgb` && req.method === 'GET') {
				rasterCalls += 1;
				if (rasterCalls === 1) {
					expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
					return new Response(
						JSON.stringify({
							type: 'about:blank',
							title: 'Expirado',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'Token expirado.',
							instance: url.pathname,
							correlationId: '15151515-1515-4151-8151-151515151515',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(req.headers.get('authorization')).toBe('Bearer jwt-refreshed-raster');
				return new Response(new Uint8Array([137, 80, 78, 71]), {
					status: 200,
					headers: { 'content-type': 'image/png' },
				});
			}

			return new Response('Not Found', { status: 404 });
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		const fc = await listRunFeaturesGeoJson(RUN_ID, undefined, client);
		expect(fc.features).toHaveLength(2);
		expect(fc.features[0]?.properties.label).toBe('P1');

		// Bloqueia client-side motivo curto sem chamar rede
		const callsBeforeReject = mockFetch.mock.calls.length;
		await expect(
			reviewRunFeature(
				RUN_ID,
				FEATURE_P2_ID,
				{ reviewStatus: 'dismissed_noise', dismissalReason: 'curto' },
				client,
			),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);
		expect(mockFetch.mock.calls.length).toBe(callsBeforeReject);

		const reviewed = await reviewRunFeature(
			RUN_ID,
			FEATURE_P2_ID,
			{
				reviewStatus: 'dismissed_noise',
				dismissalReason: '  Borda residual de nuvem observada em T1.  ',
			},
			client,
		);
		expect(reviewed.feature.reviewStatus).toBe('dismissed_noise');
		expect(reviewed.updatedSummary.degradationHa).toBe(0);
		expect(reviewed.updatedSummary.dismissedFeatureCount).toBe(1);

		await expect(
			reviewRunFeature(
				RUN_ID,
				FEATURE_P2_ID,
				{ reviewStatus: 'dismissed_noise', dismissalReason: 'CONGELAR_FROZEN_TESTE' },
				client,
			),
		).rejects.toSatisfy((err: unknown) => isApiProblemError(err) && err.code === 'ERR_RUN_FROZEN');

		// Guard Anti-SSRF bloqueia runId inválido sem disparar rede
		const callsBeforeSsrf = mockFetch.mock.calls.length;
		await expect(
			fetchRunRasterBlob('invalid-uuid', 't0_rgb', {
				baseUrl: 'https://api.sicam.test',
				fetchImpl: mockFetch,
			}),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);
		expect(mockFetch.mock.calls.length).toBe(callsBeforeSsrf);

		const pngBlob = await fetchRunRasterBlob(RUN_ID, 't0_rgb', {
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});
		expect(refreshCalls).toBe(1);
		expect(rasterCalls).toBe(2);
		expect(pngBlob.size).toBe(4);
	});

	it('deve renderizar MultitemporalSwipeMap, FeaturesCurationTable e DismissFeatureModal em SSR sem erros', () => {
		const swipeHtml = renderToStaticMarkup(
			<MultitemporalSwipeMap
				aoiGeoJson={null}
				t0AcquiredAt="2025-07-10T14:20:00.000Z"
				t1AcquiredAt="2026-07-15T14:20:00.000Z"
				rasters={{}}
				isLoadingRasters={false}
				features={SAMPLE_FEATURES}
				selectedFeatureId={FEATURE_P1_ID}
				focusTargetBounds={null}
				focusSequence={0}
				onSelectFeature={() => undefined}
			/>,
		);
		expect(swipeHtml).toContain('RGB Cor Natural');
		expect(swipeHtml).toContain('Falsa-Cor Infravermelho (NIR)');
		expect(swipeHtml).toContain('Máscara ΔNDVI + SCL');
		expect(swipeHtml).toContain('Posição da cortina comparativa T0 versus T1');

		const tableWritableHtml = renderToStaticMarkup(
			<FeaturesCurationTable
				features={SAMPLE_FEATURES}
				selectedFeatureId={FEATURE_P1_ID}
				canCurate={true}
				busyFeatureId={null}
				onSelectAndZoom={() => undefined}
				onConfirmFeature={() => undefined}
				onOpenDismissModal={() => undefined}
			/>,
		);
		expect(tableWritableHtml).toContain('P1');
		expect(tableWritableHtml).toContain('18,75 ha');
		expect(tableWritableHtml).toContain('Descartar Ruído');

		const tableReadOnlyHtml = renderToStaticMarkup(
			<FeaturesCurationTable
				features={SAMPLE_FEATURES}
				selectedFeatureId={null}
				canCurate={false}
				readOnlyReason="Esta versão está congelada (FROZEN)."
				busyFeatureId={null}
				onSelectAndZoom={() => undefined}
				onConfirmFeature={() => undefined}
				onOpenDismissModal={() => undefined}
			/>,
		);
		expect(tableReadOnlyHtml).toContain('Modo somente leitura');
		expect(tableReadOnlyHtml).not.toContain('Descartar Ruído');

		const modalHtml = renderToStaticMarkup(
			<DismissFeatureModal
				open={true}
				feature={SAMPLE_FEATURES[0]!}
				isSubmitting={false}
				problem={null}
				onClose={() => undefined}
				onConfirmDismiss={() => undefined}
			/>,
		);
		expect(modalHtml).toContain('Descartar Polígono P2 como Falso Positivo');
		expect(modalHtml).toContain('mínimo 15 caracteres');
	});
});
