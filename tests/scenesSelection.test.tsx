import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPresetPanel } from '@/components/scenes/AnalysisPresetPanel';
import { SceneCandidateCard } from '@/components/scenes/SceneCandidateCard';
import { SceneCandidateList } from '@/components/scenes/SceneCandidateList';
import { SeasonalityAlert } from '@/components/scenes/SeasonalityAlert';
import { SelectionSummaryCard } from '@/components/scenes/SelectionSummaryCard';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { resetTokenStoreForTesting, setAuthSession } from '@/lib/api/tokenStore';
import {
	buildCreateRunPayload,
	buildDefaultSearchWindows,
	computeSeasonalityGap,
	computeWindowSpanDays,
	sortSceneCandidates,
	validateCustomParams,
	validateSceneSearchForm,
	validateSelectionPair,
} from '@/lib/scenes/sceneSelection';
import { fetchScenePreviewBlob, searchScenes } from '@/lib/scenes/sceneService';
import type {
	AnalysisHardBounds,
	AnalysisPresets,
	CustomAlgorithmParams,
	SceneCandidate,
} from '@/types/api';

const ANALYST_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '77777777-7777-4777-8777-777777777777';

const MOCK_PRESETS: AnalysisPresets = {
	TECHNICAL_STANDARD: {
		ndviForestMin: 0.55,
		ndviClearedMax: 0.3,
		deforestationDeltaMax: -0.25,
		degradationDeltaMax: -0.12,
		regrowthStartMax: 0.32,
		regrowthEndMin: 0.52,
		regrowthDeltaMin: 0.18,
		morphologicalKernel: 3,
		minMappingUnitHa: 0.5,
	},
	CONSERVATIVE: {
		ndviForestMin: 0.6,
		ndviClearedMax: 0.25,
		deforestationDeltaMax: -0.32,
		degradationDeltaMax: -0.18,
		regrowthStartMax: 0.28,
		regrowthEndMin: 0.58,
		regrowthDeltaMin: 0.22,
		morphologicalKernel: 3,
		minMappingUnitHa: 1.0,
	},
};

const MOCK_HARD_BOUNDS: AnalysisHardBounds = {
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

const CANDIDATE_T0_CLEAN: SceneCandidate = {
	candidateKey: 'aws:2025-07-10:t0',
	provider: 'aws_earth_search',
	collection: 'sentinel-2-l2a',
	itemIds: ['S2A_20LMP_20250710_0_L2A'],
	isMultiTile: false,
	acquiredAt: '2025-07-10T14:20:00.000Z',
	globalCloudPct: 12.4,
	aoiCloudPct: 2.1,
	aoiCoveragePct: 100,
	processingBaseline: '05.11',
	boaOffsetApplied: true,
	previewUrl: `/api/v1/cases/${CASE_ID}/scenes/preview?token=${'a'.repeat(40)}`,
};

const CANDIDATE_T0_CLOUDY_MULTITILE: SceneCandidate = {
	candidateKey: 'inpe:2025-07-20:mosaic',
	provider: 'inpe_bdc',
	collection: 'S2_L2A-1',
	itemIds: ['S2B_20LMP_20250720_L2A', 'S2B_20LMQ_20250720_L2A'],
	isMultiTile: true,
	acquiredAt: '2025-07-20T14:20:00.000Z',
	globalCloudPct: 35.0,
	aoiCloudPct: 18.5,
	aoiCoveragePct: 98.2,
	processingBaseline: null,
	boaOffsetApplied: false,
	previewUrl: `/api/v1/cases/${CASE_ID}/scenes/preview?token=${'b'.repeat(40)}`,
};

const CANDIDATE_T1_SEASONAL_OK: SceneCandidate = {
	candidateKey: 'aws:2026-07-15:t1',
	provider: 'aws_earth_search',
	collection: 'sentinel-2-l2a',
	itemIds: ['S2B_20LMP_20260715_0_L2A'],
	isMultiTile: false,
	acquiredAt: '2026-07-15T14:20:00.000Z',
	globalCloudPct: 8.0,
	aoiCloudPct: 1.5,
	aoiCoveragePct: 100,
	processingBaseline: '05.11',
	boaOffsetApplied: true,
	previewUrl: `/api/v1/cases/${CASE_ID}/scenes/preview?token=${'c'.repeat(40)}`,
};

const CANDIDATE_T1_SEASONAL_WARN: SceneCandidate = {
	...CANDIDATE_T1_SEASONAL_OK,
	candidateKey: 'aws:2026-11-20:t1',
	acquiredAt: '2026-11-20T14:20:00.000Z',
};

describe('WEB-05 — Descoberta STAC, Seleção T0/T1, Sazonalidade e Presets Espectrais', () => {
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

	it('deve validar janelas de até 180 dias, ordem temporal, filtros STAC e calcular janelas padrão', () => {
		const validSpan = computeWindowSpanDays({ from: '2026-01-01', to: '2026-06-29' });
		expect(validSpan).not.toBeNull();
		expect(validSpan!).toBeLessThan(180);

		const okIssues = validateSceneSearchForm({
			t0Window: { from: '2025-01-01', to: '2025-06-29' },
			t1Window: { from: '2026-01-01', to: '2026-06-29' },
			providers: ['aws_earth_search', 'inpe_bdc'],
			maxGlobalCloudPct: 40,
			limitPerWindow: 15,
		});
		expect(okIssues).toEqual([]);

		// 2026-06-30 ultrapassa 180 dias desde 2026-01-01
		const overSpanIssues = validateSceneSearchForm({
			t0Window: { from: '2025-01-01', to: '2025-06-29' },
			t1Window: { from: '2026-01-01', to: '2026-06-30' },
			providers: ['aws_earth_search'],
			maxGlobalCloudPct: 40,
			limitPerWindow: 15,
		});
		expect(overSpanIssues.some((msg) => msg.includes('180'))).toBe(true);

		// from > to e t1 inteiramente antes de t0
		const reversedIssues = validateSceneSearchForm({
			t0Window: { from: '2026-06-01', to: '2026-05-01' },
			t1Window: { from: '2025-01-01', to: '2025-03-01' },
			providers: ['aws_earth_search'],
			maxGlobalCloudPct: 40,
			limitPerWindow: 15,
		});
		expect(reversedIssues.some((msg) => msg.includes('anterior ou igual'))).toBe(true);
		expect(reversedIssues.some((msg) => msg.includes('posteriores ao início'))).toBe(true);

		// Provedor vazio, limitPerWindow > 25 e maxGlobalCloudPct > 100
		const badControls = validateSceneSearchForm({
			t0Window: { from: '2025-05-01', to: '2025-07-01' },
			t1Window: { from: '2026-05-01', to: '2026-07-01' },
			providers: [],
			maxGlobalCloudPct: 101,
			limitPerWindow: 26,
		});
		expect(badControls).toHaveLength(3);

		const defaults = buildDefaultSearchWindows(new Date('2026-11-26T12:00:00Z'));
		expect(defaults.t1Window).toEqual({
			from: '2026-08-28',
			to: '2026-11-26',
		});
	});

	it('deve calcular defasagem sazonal (> 60 dias) inclusive na borda de 29 de fevereiro', () => {
		const ok = computeSeasonalityGap('2025-07-10T14:00:00Z', '2026-07-15T14:00:00Z');
		expect(ok.minDiffDays).toBeCloseTo(5, 1);
		expect(ok.warning).toBe(false);

		const warn = computeSeasonalityGap('2025-07-10T14:00:00Z', '2026-11-20T14:00:00Z');
		expect(warn.minDiffDays).toBeGreaterThan(60);
		expect(warn.warning).toBe(true);

		// Ano bissexto 2024-02-29 comparado contra 2025-03-05 -> clamp para 2025-02-28 (5 dias)
		const leap = computeSeasonalityGap('2024-02-29T10:00:00Z', '2025-03-05T10:00:00Z');
		expect(leap.minDiffDays).toBeCloseTo(5, 1);
		expect(leap.warning).toBe(false);
	});

	it('deve ordenar candidatas sem mutar, validar par T0/T1 e montar payload CreateRunBody', () => {
		const original = [CANDIDATE_T0_CLOUDY_MULTITILE, CANDIDATE_T0_CLEAN];
		const sortedByCloud = sortSceneCandidates(original, 'aoi_cloud_asc');
		expect(sortedByCloud.map((c) => c.candidateKey)).toEqual([
			CANDIDATE_T0_CLEAN.candidateKey,
			CANDIDATE_T0_CLOUDY_MULTITILE.candidateKey,
		]);
		// Array original permanece intacto
		expect(original[0]?.candidateKey).toBe(CANDIDATE_T0_CLOUDY_MULTITILE.candidateKey);

		const sortedByDate = sortSceneCandidates(original, 'acquired_desc');
		expect(sortedByDate[0]?.candidateKey).toBe(CANDIDATE_T0_CLOUDY_MULTITILE.candidateKey);

		// Rejeita T1 anterior ou igual a T0 e itemIds duplicados
		const orderErrs = validateSelectionPair(CANDIDATE_T1_SEASONAL_OK, CANDIDATE_T0_CLEAN);
		expect(orderErrs.some((msg) => msg.includes('posterior à cena T0'))).toBe(true);

		const dupErrs = validateSelectionPair(
			{ ...CANDIDATE_T0_CLEAN, itemIds: ['DUP', 'DUP'] },
			CANDIDATE_T1_SEASONAL_OK,
		);
		expect(dupErrs.some((msg) => msg.includes('duplicados'))).toBe(true);

		// Payload para preset fixo deve enviar customParams: null
		const stdPayload = buildCreateRunPayload({
			t0: CANDIDATE_T0_CLEAN,
			t1: CANDIDATE_T1_SEASONAL_OK,
			presetName: 'TECHNICAL_STANDARD',
			customParams: MOCK_PRESETS.TECHNICAL_STANDARD,
		});
		expect(stdPayload.presetName).toBe('TECHNICAL_STANDARD');
		expect(stdPayload.customParams).toBeNull();

		// Payload para CUSTOM envia cópia dos parâmetros customizados
		const customPayload = buildCreateRunPayload({
			t0: CANDIDATE_T0_CLEAN,
			t1: CANDIDATE_T1_SEASONAL_OK,
			presetName: 'CUSTOM',
			customParams: MOCK_PRESETS.CONSERVATIVE,
		});
		expect(customPayload.presetName).toBe('CUSTOM');
		expect(customPayload.customParams).toEqual(MOCK_PRESETS.CONSERVATIVE);
		expect(customPayload.customParams).not.toBe(MOCK_PRESETS.CONSERVATIVE);
	});

	it('deve validar hard bounds e invariantes espectrais do modo CUSTOM', () => {
		expect(
			validateCustomParams(MOCK_PRESETS.TECHNICAL_STANDARD, MOCK_HARD_BOUNDS),
		).toEqual([]);

		// Violação de hard bound
		const outOfBound: CustomAlgorithmParams = {
			...MOCK_PRESETS.TECHNICAL_STANDARD,
			minMappingUnitHa: 30,
		};
		expect(
			validateCustomParams(outOfBound, MOCK_HARD_BOUNDS).some(
				(i) => i.field === 'minMappingUnitHa',
			),
		).toBe(true);

		// ndviForestMin <= ndviClearedMax
		const badForest: CustomAlgorithmParams = {
			...MOCK_PRESETS.TECHNICAL_STANDARD,
			ndviForestMin: 0.4,
			ndviClearedMax: 0.42,
		};
		expect(
			validateCustomParams(badForest, MOCK_HARD_BOUNDS).some(
				(i) => i.field === 'ndviForestMin',
			),
		).toBe(true);

		// deforestationDeltaMax > degradationDeltaMax
		const badDelta: CustomAlgorithmParams = {
			...MOCK_PRESETS.TECHNICAL_STANDARD,
			deforestationDeltaMax: -0.15,
			degradationDeltaMax: -0.2,
		};
		expect(
			validateCustomParams(badDelta, MOCK_HARD_BOUNDS).some(
				(i) => i.field === 'deforestationDeltaMax',
			),
		).toBe(true);

		// regrowthEndMin <= regrowthStartMax
		const badRegrowth: CustomAlgorithmParams = {
			...MOCK_PRESETS.TECHNICAL_STANDARD,
			regrowthStartMax: 0.42,
			regrowthEndMin: 0.38,
		};
		expect(
			validateCustomParams(badRegrowth, MOCK_HARD_BOUNDS).some(
				(i) => i.field === 'regrowthEndMin',
			),
		).toBe(true);
	});

	it('deve buscar cenas STAC via API, mapear erro 422 e carregar miniatura com Guard Anti-SSRF e retry 401', async () => {
		let previewCalls = 0;
		let refreshCalls = 0;

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);

			if (url.pathname === `/api/v1/cases/${CASE_ID}/scenes/search` && req.method === 'POST') {
				expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
				const body = (await req.json()) as { t1Window: { from: string } };
				if (body.t1Window.from === '2020-01-01') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/temporal-order',
							title: 'Ordem temporal inválida',
							status: 422,
							code: 'ERR_TEMPORAL_ORDER_INVALID',
							detail: 'Janela T1 deve ser posterior a T0.',
							instance: url.pathname,
							correlationId: '99999999-9999-4999-8999-999999999999',
						}),
						{ status: 422, headers: { 'content-type': 'application/json' } },
					);
				}

				return new Response(
					JSON.stringify({
						caseId: CASE_ID,
						t0Candidates: [CANDIDATE_T0_CLEAN, CANDIDATE_T0_CLOUDY_MULTITILE],
						t1Candidates: [CANDIDATE_T1_SEASONAL_OK],
						providerWarnings: [],
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === '/api/v1/auth/refresh') {
				refreshCalls += 1;
				return new Response(
					JSON.stringify({
						accessToken: 'jwt-refreshed',
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

			if (url.pathname === `/api/v1/cases/${CASE_ID}/scenes/preview`) {
				previewCalls += 1;
				if (previewCalls === 1) {
					expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');
					return new Response(
						JSON.stringify({
							type: 'about:blank',
							title: 'Expirado',
							status: 401,
							code: 'ERR_UNAUTHORIZED',
							detail: 'Expirado.',
							instance: url.pathname,
							correlationId: '12121212-1212-4121-8121-121212121212',
						}),
						{ status: 401, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(req.headers.get('authorization')).toBe('Bearer jwt-refreshed');
				return new Response(new Uint8Array([255, 216, 255]), {
					status: 200,
					headers: { 'content-type': 'image/jpeg' },
				});
			}

			return new Response('Not Found', { status: 404 });
		});

		const client = createSicamApiClient({
			baseUrl: 'https://api.sicam.test',
			fetchImpl: mockFetch,
		});

		const found = await searchScenes(
			CASE_ID,
			{
				t0Window: { from: '2025-07-01', to: '2025-08-31' },
				t1Window: { from: '2026-07-01', to: '2026-08-31' },
				providers: ['aws_earth_search', 'inpe_bdc'],
				maxGlobalCloudPct: 40,
				limitPerWindow: 15,
			},
			client,
		);
		expect(found.t0Candidates).toHaveLength(2);
		expect(found.t1Candidates).toHaveLength(1);

		await expect(
			searchScenes(
				CASE_ID,
				{
					t0Window: { from: '2025-07-01', to: '2025-08-31' },
					t1Window: { from: '2020-01-01', to: '2020-02-01' },
				},
				client,
			),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_TEMPORAL_ORDER_INVALID',
		);

		// URL absoluta externa deve ser rejeitada pelo Guard Anti-SSRF sem disparar rede
		const callsBeforeSsrf = mockFetch.mock.calls.length;
		await expect(
			fetchScenePreviewBlob('https://evil.example/x', {
				baseUrl: 'https://api.sicam.test',
				fetchImpl: mockFetch,
			}),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_VALIDATION_FAILED',
		);
		expect(mockFetch.mock.calls.length).toBe(callsBeforeSsrf);

		const blob = await fetchScenePreviewBlob(
			`/api/v1/cases/${CASE_ID}/scenes/preview?token=${'x'.repeat(40)}`,
			{
				baseUrl: 'https://api.sicam.test',
				fetchImpl: mockFetch,
			},
		);
		expect(refreshCalls).toBe(1);
		expect(previewCalls).toBe(2);
		expect(blob.size).toBe(3);
	});

	it('deve renderizar SceneCandidateCard, SceneCandidateList, SeasonalityAlert, AnalysisPresetPanel e SelectionSummaryCard em SSR', () => {
		const cardHtml = renderToStaticMarkup(
			<SceneCandidateCard
				candidate={CANDIDATE_T0_CLOUDY_MULTITILE}
				selected={false}
				slotLabel="T0"
				onSelect={() => undefined}
			/>,
		);
		expect(cardHtml).toContain('Mosaico multi-tile');
		expect(cardHtml).toContain('Cobertura parcial');

		const listHtml = renderToStaticMarkup(
			<SceneCandidateList
				slot="T0"
				title="Candidatas T0"
				candidates={[CANDIDATE_T0_CLEAN, CANDIDATE_T0_CLOUDY_MULTITILE]}
				selectedKey={CANDIDATE_T0_CLEAN.candidateKey}
				onSelect={() => undefined}
			/>,
		);
		expect(listHtml).toContain('Ordenar por');
		expect(listHtml).toContain('2 cenas');

		const alertHtml = renderToStaticMarkup(
			<SeasonalityAlert t0={CANDIDATE_T0_CLEAN} t1={CANDIDATE_T1_SEASONAL_WARN} />,
		);
		expect(alertHtml).toContain('Alerta de sazonalidade');

		const presetHtml = renderToStaticMarkup(
			<AnalysisPresetPanel
				presets={MOCK_PRESETS}
				hardBounds={MOCK_HARD_BOUNDS}
				presetName="CUSTOM"
				onPresetChange={() => undefined}
				customParams={MOCK_PRESETS.TECHNICAL_STANDARD}
				onCustomParamsChange={() => undefined}
			/>,
		);
		expect(presetHtml).toContain('Modo Avançado');
		expect(presetHtml).toContain('Kernel morfológico 3×3');

		const summaryHtml = renderToStaticMarkup(
			<SelectionSummaryCard
				t0={CANDIDATE_T0_CLEAN}
				t1={CANDIDATE_T1_SEASONAL_OK}
				presetName="TECHNICAL_STANDARD"
				customParams={MOCK_PRESETS.TECHNICAL_STANDARD}
				hardBounds={MOCK_HARD_BOUNDS}
			/>,
		);
		expect(summaryHtml).toContain('Seleção pronta para disparo');
		expect(summaryHtml).toContain('presetName');
		expect(summaryHtml).toContain('WEB-06');
	});
});
