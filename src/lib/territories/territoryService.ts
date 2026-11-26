import { apiClient, type SicamApiClient, unwrapApiResult } from '@/lib/api/client';
import type {
	TerritoryMunicipalitiesQuery,
	TerritoryMunicipalitiesResponse,
	TerritoryStatesResponse,
} from '@/types/api';

/**
 * Lista todas as Unidades Federativas importadas na malha oficial do IBGE.
 */
export async function listTerritoryStates(
	client: SicamApiClient = apiClient,
): Promise<TerritoryStatesResponse> {
	const result = await client.GET('/api/v1/territories/states');
	return unwrapApiResult(result);
}

/**
 * Pesquisa municípios da malha IBGE com centroide e bounding box para navegação rápida no mapa.
 */
export async function searchMunicipalities(
	query?: TerritoryMunicipalitiesQuery,
	client: SicamApiClient = apiClient,
): Promise<TerritoryMunicipalitiesResponse> {
	const cleanQuery: TerritoryMunicipalitiesQuery = {};

	if (query?.uf?.trim()) {
		cleanQuery.uf = query.uf.trim().toUpperCase();
	}
	if (query?.q?.trim()) {
		cleanQuery.q = query.q.trim();
	}
	if (typeof query?.limit === 'number' && Number.isFinite(query.limit) && query.limit >= 1) {
		cleanQuery.limit = Math.min(100, Math.trunc(query.limit));
	}

	const result = await client.GET('/api/v1/territories/municipalities', {
		params: {
			...(Object.keys(cleanQuery).length > 0 ? { query: cleanQuery } : {}),
		},
	});

	return unwrapApiResult(result);
}
