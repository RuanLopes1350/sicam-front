import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AoiDrawingMap } from '@/components/cases/AoiDrawingMap';
import { AoiMetricsPanel } from '@/components/cases/AoiMetricsPanel';
import { CasesListTable } from '@/components/cases/CasesListTable';
import { CasesOverviewMap } from '@/components/cases/CasesOverviewMap';
import { CreateCaseForm } from '@/components/cases/CreateCaseForm';
import { createSicamApiClient } from '@/lib/api/client';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { resetTokenStoreForTesting, setAuthSession } from '@/lib/api/tokenStore';
import {
	CASE_STATUS_META,
	createCase,
	getCaseById,
	listCases,
	updateCaseMetadata,
} from '@/lib/cases/caseService';
import {
	buildClosedPolygonFromVertices,
	buildRectanglePolygon,
	evaluateAoiAgainstCapabilities,
	hasSelfIntersection,
	parseGeoJsonPolygonInput,
	resolveSirgas2000UtmZoneAndSrid,
} from '@/lib/geo/aoiGeometry';
import { buildAoiOverlayFeatureCollection } from '@/lib/geo/aoiDraftOverlay';
import { buildBasemapStyle } from '@/lib/geo/mapStyles';
import {
	listTerritoryStates,
	searchMunicipalities,
} from '@/lib/territories/territoryService';
import type { CaseListItem } from '@/types/api';

const ANALYST_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '77777777-7777-4777-8777-777777777777';

const SAMPLE_AOI = buildRectanglePolygon([-63.905, -8.765], [-63.8959, -8.75595])!;

const SAMPLE_CASE_ITEM: CaseListItem = {
	id: CASE_ID,
	protocolCode: 'SICAM-2026-00042',
	externalRef: 'SEI-0029.100/2026',
	title: 'Monitoramento Gleba Rio Jamari',
	description: 'Área sob fiscalização ambiental em Rondônia',
	aoiAreaHa: 100.25,
	aoiPerimeterM: 4005.12,
	utmSrid: 31980,
	stateUf: 'RO',
	primaryMunicipality: {
		ibgeCode: '1100205',
		name: 'Porto Velho',
		ufCode: 'RO',
	},
	intersectedMunicipalities: [
		{
			ibgeCode: '1100205',
			name: 'Porto Velho',
			ufCode: 'RO',
			overlapHa: 100.25,
			overlapPct: 100,
		},
	],
	aoiGeoJson: SAMPLE_AOI,
	createdBy: {
		id: ANALYST_ID,
		fullName: 'Analista Geo RO',
		registrationCode: 'ANA-1042',
	},
	createdAt: '2026-10-12T12:00:00.000Z',
	updatedAt: '2026-10-12T12:00:00.000Z',
	runsCount: 1,
	latestRunStatus: 'ready_for_review',
};

describe('WEB-04 — Geodésia AOI SIRGAS 2000, Territórios IBGE, Casos e MapLibre SSR', () => {
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

	it('deve calcular área UTM SIRGAS 2000 precisa e rejeitar autointerseções, buracos e áreas fora dos limites', () => {
		const roUtm = resolveSirgas2000UtmZoneAndSrid(-62.5, -10.8);
		expect(roUtm.zone).toBe(20);
		expect(roUtm.isSouth).toBe(true);
		expect(roUtm.srid).toBe(31980);

		const rrUtm = resolveSirgas2000UtmZoneAndSrid(-60.67, 2.82);
		expect(rrUtm.zone).toBe(20);
		expect(rrUtm.isSouth).toBe(false);
		expect(rrUtm.srid).toBe(31974);

		// Quadrante de ~1 km x 1 km (~100 ha) em Porto Velho - RO
		const validEval = evaluateAoiAgainstCapabilities(SAMPLE_AOI, {
			minAreaHa: 0.5,
			maxAreaHa: 50_000,
			maxVertices: 500,
		});
		expect(validEval.isValid).toBe(true);
		expect(validEval.distinctVertices).toBe(4);
		expect(validEval.utmSrid).toBe(31980);
		expect(validEval.areaHa).toBeGreaterThan(95);
		expect(validEval.areaHa).toBeLessThan(105);
		expect(validEval.perimeterM).toBeGreaterThan(3900);
		expect(validEval.perimeterM).toBeLessThan(4100);

		// Área minúscula (< 0.5 ha)
		const tinyRect = buildRectanglePolygon([-63.9, -8.76], [-63.8998, -8.7598])!;
		const tinyEval = evaluateAoiAgainstCapabilities(tinyRect, {
			minAreaHa: 0.5,
			maxAreaHa: 50_000,
			maxVertices: 500,
		});
		expect(tinyEval.isValid).toBe(false);
		expect(tinyEval.issues.some((msg) => msg.includes('inferior ao mínimo'))).toBe(true);

		// Área gigantesca (> 50.000 ha)
		const hugeRect = buildRectanglePolygon([-63.9, -9.5], [-63.0, -8.5])!;
		const hugeEval = evaluateAoiAgainstCapabilities(hugeRect, {
			minAreaHa: 0.5,
			maxAreaHa: 50_000,
			maxVertices: 500,
		});
		expect(hugeEval.isValid).toBe(false);
		expect(hugeEval.issues.some((msg) => msg.includes('superior ao teto'))).toBe(true);

		// Autointerseção (gravata-borboleta)
		const bowtie = buildClosedPolygonFromVertices([
			[-63.91, -8.77],
			[-63.89, -8.75],
			[-63.91, -8.75],
			[-63.89, -8.77],
		])!;
		expect(hasSelfIntersection(bowtie.coordinates[0]!)).toBe(true);
		const bowtieEval = evaluateAoiAgainstCapabilities(bowtie);
		expect(bowtieEval.isValid).toBe(false);
		expect(bowtieEval.issues.some((msg) => msg.includes('autointerseção'))).toBe(true);

		// Fora do Brasil (Europa)
		const foreignRect = buildRectanglePolygon([2.34, 48.85], [2.36, 48.87])!;
		const foreignEval = evaluateAoiAgainstCapabilities(foreignRect);
		expect(foreignEval.isValid).toBe(false);
		expect(foreignEval.issues.some((msg) => msg.includes('fora dos limites'))).toBe(true);

		// Excesso de vértices configurado dinamicamente
		const overVerticesEval = evaluateAoiAgainstCapabilities(SAMPLE_AOI, {
			minAreaHa: 0.5,
			maxAreaHa: 50_000,
			maxVertices: 3,
		});
		expect(overVerticesEval.isValid).toBe(false);
		expect(overVerticesEval.issues.some((msg) => msg.includes('excedendo o máximo'))).toBe(
			true,
		);
	});

	it('deve fazer parse seguro de GeoJSON Polygon, Feature e FeatureCollection bloqueando buracos e MultiPolygon', () => {
		// Auto-fecha anel caso último vértice não repita o primeiro
		const fromUnclosedFeature = parseGeoJsonPolygonInput(
			JSON.stringify({
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[-63.905, -8.765],
							[-63.895, -8.765],
							[-63.895, -8.755],
							[-63.905, -8.755],
						],
					],
				},
			}),
		);
		expect(fromUnclosedFeature.type).toBe('Polygon');
		expect(fromUnclosedFeature.coordinates[0]).toHaveLength(5);

		const fromCollection = parseGeoJsonPolygonInput(
			JSON.stringify({
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						geometry: SAMPLE_AOI,
						properties: {},
					},
				],
			}),
		);
		expect(fromCollection.coordinates[0]).toHaveLength(5);

		// Rejeita polígono com buracos
		expect(() =>
			parseGeoJsonPolygonInput(
				JSON.stringify({
					type: 'Polygon',
					coordinates: [
						SAMPLE_AOI.coordinates[0],
						[
							[-63.902, -8.762],
							[-63.901, -8.762],
							[-63.901, -8.761],
							[-63.902, -8.762],
						],
					],
				}),
			),
		).toThrow(/buracos/);

		// Rejeita MultiPolygon
		expect(() =>
			parseGeoJsonPolygonInput(
				JSON.stringify({
					type: 'MultiPolygon',
					coordinates: [],
				}),
			),
		).toThrow();
	});

	it('deve consumir rotas de territórios IBGE e CRUD de casos mapeando erros 422 RFC 9457', async () => {
		expect(Object.keys(CASE_STATUS_META)).toHaveLength(9);

		const mockFetch = vi.fn(async (req: Request) => {
			const url = new URL(req.url);
			expect(req.headers.get('authorization')).toBe('Bearer jwt-analyst-token');

			if (url.pathname === '/api/v1/territories/states') {
				return new Response(
					JSON.stringify({
						items: [
							{
								ufCode: 'RO',
								ibgeStateId: 11,
								name: 'Rondônia',
								datasetVersion: 'IBGE-2024',
								importedAt: '2026-01-01T00:00:00.000Z',
							},
						],
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === '/api/v1/territories/municipalities') {
				expect(url.searchParams.get('uf')).toBe('RO');
				expect(url.searchParams.get('q')).toBe('Porto');
				return new Response(
					JSON.stringify({
						items: [
							{
								ibgeCode: '1100205',
								name: 'Porto Velho',
								ufCode: 'RO',
								centroid: { lat: -8.76, lon: -63.9 },
								bbox: [-66.8, -10.0, -63.5, -7.9],
							},
						],
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === '/api/v1/cases' && req.method === 'GET') {
				expect(url.searchParams.get('stateUf')).toBe('RO');
				expect(url.searchParams.get('status')).toBe('ready_for_review');
				expect(url.searchParams.get('page')).toBe('1');
				return new Response(
					JSON.stringify({
						items: [SAMPLE_CASE_ITEM],
						pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === '/api/v1/cases' && req.method === 'POST') {
				const body = (await req.json()) as {
					title: string;
					externalRef: string | null;
					description: string | null;
				};
				if (body.title === 'Fora da UF') {
					return new Response(
						JSON.stringify({
							type: 'https://api.sicam.local/problems/uf-not-covered',
							title: 'UF não coberta',
							status: 422,
							code: 'ERR_UF_NOT_COVERED',
							detail: 'AOI fora da malha carregada.',
							instance: url.pathname,
							correlationId: '88888888-8888-4888-8888-888888888888',
						}),
						{ status: 422, headers: { 'content-type': 'application/json' } },
					);
				}

				expect(body.title).toBe('Novo Caso RO');
				expect(body.externalRef).toBeNull();
				const { runsCount: _rc, latestRunStatus: _ls, ...caseRecord } = SAMPLE_CASE_ITEM;
				return new Response(
					JSON.stringify({
						...caseRecord,
						title: body.title,
						externalRef: null,
					}),
					{ status: 201, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === `/api/v1/cases/${CASE_ID}` && req.method === 'GET') {
				const { runsCount: _rc, latestRunStatus: _ls, ...caseRecord } = SAMPLE_CASE_ITEM;
				return new Response(
					JSON.stringify({
						...caseRecord,
						runs: [],
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}

			if (url.pathname === `/api/v1/cases/${CASE_ID}` && req.method === 'PATCH') {
				const patch = (await req.json()) as { title?: string };
				const { runsCount: _rc, latestRunStatus: _ls, ...caseRecord } = SAMPLE_CASE_ITEM;
				return new Response(
					JSON.stringify({
						...caseRecord,
						title: patch.title ?? caseRecord.title,
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

		const states = await listTerritoryStates(client);
		expect(states.items[0]?.ufCode).toBe('RO');

		const muns = await searchMunicipalities({ uf: 'ro', q: 'Porto', limit: 20 }, client);
		expect(muns.items[0]?.ibgeCode).toBe('1100205');

		const casesPage = await listCases(
			{ stateUf: 'ro', status: 'ready_for_review', page: 1, limit: 15 },
			client,
		);
		expect(casesPage.items[0]?.protocolCode).toBe('SICAM-2026-00042');

		await expect(
			createCase(
				{
					title: 'Fora da UF',
					aoiGeoJson: SAMPLE_AOI,
				},
				client,
			),
		).rejects.toSatisfy(
			(err: unknown) => isApiProblemError(err) && err.code === 'ERR_UF_NOT_COVERED',
		);

		const created = await createCase(
			{
				title: '  Novo Caso RO  ',
				externalRef: '   ',
				aoiGeoJson: SAMPLE_AOI,
			},
			client,
		);
		expect(created.title).toBe('Novo Caso RO');

		const detail = await getCaseById(CASE_ID, client);
		expect(detail.protocolCode).toBe('SICAM-2026-00042');
		expect(detail.runs).toEqual([]);

		const updated = await updateCaseMetadata(
			CASE_ID,
			{ title: 'Título Revisado' },
			client,
		);
		expect(updated.title).toBe('Título Revisado');
	});

	it('deve construir estilos MapLibre v8 e renderizar componentes espaciais sem falha em SSR', () => {
		expect(buildBasemapStyle('satellite').version).toBe(8);
		expect(buildBasemapStyle('osm').version).toBe(8);
		expect(buildBasemapStyle('offline_dark').version).toBe(8);

		const evaluation = evaluateAoiAgainstCapabilities(SAMPLE_AOI);

		const metricsHtml = renderToStaticMarkup(
			<AoiMetricsPanel
				evaluation={evaluation}
				aoiCapabilities={{
					minAreaHa: 0.5,
					maxAreaHa: 50_000,
					maxVertices: 500,
					enforceLoadedUfs: true,
					loadedUfs: [{ ufCode: 'RO', name: 'Rondônia', datasetVersion: 'IBGE-2024' }],
				}}
				hasGeometry={true}
			/>,
		);
		expect(metricsHtml).toContain('Topologia e área válidas');
		expect(metricsHtml).toContain('EPSG:31980');
		expect(metricsHtml).toContain('RO');

		const tableHtml = renderToStaticMarkup(
			<CasesListTable
				items={[SAMPLE_CASE_ITEM]}
				pagination={{ page: 1, limit: 15, total: 1, totalPages: 1 }}
				selectedCaseId={CASE_ID}
				isLoading={false}
				onPageChange={() => undefined}
			/>,
		);
		expect(tableHtml).toContain('SICAM-2026-00042');
		expect(tableHtml).toContain('Porto Velho - RO');
		expect(tableHtml).toContain('Pronto p/ curadoria');
		expect(tableHtml).toContain(`href="/cases/${CASE_ID}"`);

		const formHtml = renderToStaticMarkup(
			<CreateCaseForm
				aoi={SAMPLE_AOI}
				evaluation={evaluation}
				isSubmitting={false}
				onSubmitCase={() => undefined}
			/>,
		);
		expect(formHtml).toContain('Protocolar Caso e Gravar AOI (SIRGAS 2000)');

		const drawMapHtml = renderToStaticMarkup(
			<AoiDrawingMap
				aoi={SAMPLE_AOI}
				isValidAoi={true}
				municipalityBbox={null}
				focusBounds={null}
				focusSequence={0}
				onChangeAoi={() => undefined}
				onOpenGeoJsonModal={() => undefined}
			/>,
		);
		expect(drawMapHtml).toContain('Quadrante (2 cliques)');
		expect(drawMapHtml).toContain('Polígono Livre');
		expect(drawMapHtml).toContain('Importar GeoJSON');

		const overviewMapHtml = renderToStaticMarkup(
			<CasesOverviewMap
				cases={[
					{
						id: CASE_ID,
						protocolCode: SAMPLE_CASE_ITEM.protocolCode,
						title: SAMPLE_CASE_ITEM.title,
						aoiGeoJson: SAMPLE_AOI,
					},
				]}
				selectedCaseId={CASE_ID}
			/>,
		);
		expect(overviewMapHtml).toContain('Distribuição Espacial das AOIs');
	});

	it('deve construir feições GeoJSON imediatas (linha elástica, aresta sólida e fechamento) ao desenhar AOI', () => {
		const step1 = buildAoiOverlayFeatureCollection({
			toolMode: 'polygon',
			aoi: null,
			isValidAoi: true,
			municipalityBbox: null,
			rectStart: null,
			draftVertices: [[-60.12, -12.71]],
			cursorCoord: [-60.118, -12.71],
		});
		expect(step1.features.some((f) => f.properties?.kind === 'draft_rubber_line')).toBe(true);
		expect(step1.features.some((f) => f.properties?.kind === 'vertex')).toBe(true);

		const step3 = buildAoiOverlayFeatureCollection({
			toolMode: 'polygon',
			aoi: null,
			isValidAoi: true,
			municipalityBbox: null,
			rectStart: null,
			draftVertices: [
				[-60.12, -12.71],
				[-60.118, -12.71],
				[-60.118, -12.712],
			],
			cursorCoord: [-60.12, -12.712],
		});
		expect(step3.features.some((f) => f.properties?.kind === 'draft_fill')).toBe(true);
		expect(step3.features.some((f) => f.properties?.kind === 'draft_solid_line')).toBe(true);
		expect(step3.features.some((f) => f.properties?.kind === 'draft_rubber_line')).toBe(true);
		expect(step3.features.some((f) => f.properties?.kind === 'first_vertex')).toBe(true);

		const rectPreview = buildAoiOverlayFeatureCollection({
			toolMode: 'rectangle',
			aoi: null,
			isValidAoi: true,
			municipalityBbox: null,
			rectStart: [-60.12, -12.71],
			cursorCoord: [-60.115, -12.715],
			draftVertices: [],
		});
		expect(rectPreview.features.some((f) => f.properties?.kind === 'aoi_polygon')).toBe(true);
		expect(rectPreview.features.some((f) => f.properties?.kind === 'first_vertex')).toBe(true);
	});
});
