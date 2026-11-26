import { apiClient, type SicamApiClient, unwrapApiResult } from '@/lib/api/client';
import type {
	CaseDetailResponse,
	CasesListQuery,
	CasesListResponse,
	CaseStatusFilter,
	CreateCaseBody,
	CreateCaseResponse,
	UpdateCaseBody,
	UpdateCaseResponse,
} from '@/types/api';

export interface CaseStatusMeta {
	label: string;
	badgeVariant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'frozen';
}

export const CASE_STATUS_META: Record<CaseStatusFilter, CaseStatusMeta> = {
	no_runs: { label: 'Sem análises', badgeVariant: 'neutral' },
	queued: { label: 'Na fila', badgeVariant: 'info' },
	fetching_bands: { label: 'Baixando bandas COG', badgeVariant: 'info' },
	processing_ndvi: { label: 'Calculando ΔNDVI', badgeVariant: 'info' },
	vectorizing: { label: 'Vetorizando feições', badgeVariant: 'info' },
	ready_for_review: { label: 'Pronto p/ curadoria', badgeVariant: 'warning' },
	exporting: { label: 'Emitindo pacote', badgeVariant: 'info' },
	frozen: { label: 'Congelado (FROZEN)', badgeVariant: 'frozen' },
	failed: { label: 'Falha na execução', badgeVariant: 'danger' },
};

export const CASE_STATUS_FILTER_OPTIONS: ReadonlyArray<{
	value: CaseStatusFilter;
	label: string;
}> = (Object.keys(CASE_STATUS_META) as CaseStatusFilter[]).map((key) => ({
	value: key,
	label: CASE_STATUS_META[key].label,
}));

/**
 * Lista e filtra casos paginados por protocolo, título, UF, município IBGE ou status da última run.
 */
export async function listCases(
	query?: CasesListQuery,
	client: SicamApiClient = apiClient,
): Promise<CasesListResponse> {
	const cleanQuery: CasesListQuery = {};

	if (query?.q?.trim()) {
		cleanQuery.q = query.q.trim();
	}
	if (query?.stateUf?.trim()) {
		cleanQuery.stateUf = query.stateUf.trim().toUpperCase();
	}
	if (query?.municipalityIbge?.trim()) {
		cleanQuery.municipalityIbge = query.municipalityIbge.trim();
	}
	if (query?.bbox?.trim()) {
		cleanQuery.bbox = query.bbox.trim();
	}
	if (query?.status) {
		cleanQuery.status = query.status;
	}
	if (query?.createdBy?.trim()) {
		cleanQuery.createdBy = query.createdBy.trim();
	}
	if (query?.from?.trim()) {
		cleanQuery.from = query.from.trim();
	}
	if (query?.to?.trim()) {
		cleanQuery.to = query.to.trim();
	}
	if (typeof query?.page === 'number' && Number.isFinite(query.page) && query.page >= 1) {
		cleanQuery.page = Math.trunc(query.page);
	}
	if (typeof query?.limit === 'number' && Number.isFinite(query.limit) && query.limit >= 1) {
		cleanQuery.limit = Math.min(100, Math.trunc(query.limit));
	}

	const result = await client.GET('/api/v1/cases', {
		params: {
			...(Object.keys(cleanQuery).length > 0 ? { query: cleanQuery } : {}),
		},
	});

	return unwrapApiResult(result);
}

/**
 * Retorna detalhe completo do caso acompanhado de suas execuções (v1..vN).
 */
export async function getCaseById(
	caseId: string,
	client: SicamApiClient = apiClient,
): Promise<CaseDetailResponse> {
	const result = await client.GET('/api/v1/cases/{caseId}', {
		params: {
			path: { caseId },
		},
	});
	return unwrapApiResult(result);
}

/**
 * Cria um novo Caso de Análise validando topologia e área SIRGAS 2000 UTM no PostGIS (analista apenas).
 */
export async function createCase(
	body: CreateCaseBody,
	client: SicamApiClient = apiClient,
): Promise<CreateCaseResponse> {
	const cleanTitle = body.title.trim();
	const cleanExternalRef = body.externalRef?.trim() ? body.externalRef.trim() : null;
	const cleanDescription = body.description?.trim() ? body.description.trim() : null;

	const result = await client.POST('/api/v1/cases', {
		body: {
			title: cleanTitle,
			externalRef: cleanExternalRef,
			description: cleanDescription,
			aoiGeoJson: body.aoiGeoJson,
		},
	});

	return unwrapApiResult(result);
}

/**
 * Atualiza exclusivamente os metadados textuais de um Caso (AOI e protocolo permanecem imutáveis).
 */
export async function updateCaseMetadata(
	caseId: string,
	body: UpdateCaseBody,
	client: SicamApiClient = apiClient,
): Promise<UpdateCaseResponse> {
	const patch: UpdateCaseBody = {};

	if (body.title !== undefined) {
		patch.title = body.title.trim();
	}
	if (body.externalRef !== undefined) {
		patch.externalRef = body.externalRef?.trim() ? body.externalRef.trim() : null;
	}
	if (body.description !== undefined) {
		patch.description = body.description?.trim() ? body.description.trim() : null;
	}

	const result = await client.PATCH('/api/v1/cases/{caseId}', {
		params: {
			path: { caseId },
		},
		body: patch,
	});

	return unwrapApiResult(result);
}
