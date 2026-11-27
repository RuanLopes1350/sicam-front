import type { CreateRunBody, RunStatus } from '@/types/api';

export interface AnalysisPipelineStep {
	key: 'queued' | 'fetching_bands' | 'processing_ndvi' | 'vectorizing' | 'ready_for_review';
	title: string;
	defaultPct: number;
	description: string;
}

export const ANALYSIS_PIPELINE_STEPS: readonly AnalysisPipelineStep[] = [
	{
		key: 'queued',
		title: 'Fila de Execução',
		defaultPct: 0,
		description: 'Aguardando worker analítico disponível',
	},
	{
		key: 'fetching_bands',
		title: 'Leitura COG Sentinel-2',
		defaultPct: 25,
		description: 'Download parcial HTTP Range das bandas T0/T1 e alinhamento 10m',
	},
	{
		key: 'processing_ndvi',
		title: 'Cálculo ΔNDVI & Máscara SCL',
		defaultPct: 60,
		description: 'Normalização BOA, máscara de nuvens/sombras e classificação espectral',
	},
	{
		key: 'vectorizing',
		title: 'Morfologia, CCL & Evidências PNG',
		defaultPct: 85,
		description: 'Abertura 3×3, filtro MMU, vetorização SIRGAS 2000 e 5 rasters P2–P98',
	},
	{
		key: 'ready_for_review',
		title: 'Pronta para Curadoria',
		defaultPct: 100,
		description: 'Feições persistidas no PostGIS e abertas para revisão pericial',
	},
] as const;

export function isTerminalAnalysisStatus(status: RunStatus): boolean {
	return status === 'ready_for_review' || status === 'frozen' || status === 'failed';
}

export function resolvePipelineStepIndex(status: RunStatus): number {
	switch (status) {
		case 'queued':
			return 0;
		case 'fetching_bands':
			return 1;
		case 'processing_ndvi':
			return 2;
		case 'vectorizing':
			return 3;
		case 'ready_for_review':
		case 'exporting':
		case 'frozen':
			return 4;
		case 'failed':
			return -1;
	}
}

export function resolveDefaultProgressForStatus(status: RunStatus): {
	progressPct: number;
	stepText: string;
} {
	switch (status) {
		case 'queued':
			return { progressPct: 0, stepText: 'Aguardando worker disponível' };
		case 'fetching_bands':
			return { progressPct: 25, stepText: 'Lendo bandas COG Sentinel-2 (T0/T1)' };
		case 'processing_ndvi':
			return { progressPct: 60, stepText: 'Calculando Delta-NDVI e aplicando máscara SCL' };
		case 'vectorizing':
			return { progressPct: 85, stepText: 'Vetorizando polígonos e gerando evidências PNG' };
		case 'ready_for_review':
			return { progressPct: 100, stepText: 'Análise concluída e pronta para curadoria' };
		case 'exporting':
			return { progressPct: 90, stepText: 'Renderizando Carta-Imagem 300 DPI e pacote técnico' };
		case 'frozen':
			return { progressPct: 100, stepText: 'Pacote técnico emitido e execução congelada' };
		case 'failed':
			return { progressPct: 100, stepText: 'Execução encerrada com falha' };
	}
}

export function deriveIdempotencyFingerprint(
	caseId: string,
	payload: CreateRunBody | null,
): string {
	if (!payload) {
		return `${caseId}::incomplete`;
	}

	const normalizedCustom =
		payload.presetName === 'CUSTOM' && payload.customParams
			? {
					ndviForestMin: payload.customParams.ndviForestMin,
					ndviClearedMax: payload.customParams.ndviClearedMax,
					deforestationDeltaMax: payload.customParams.deforestationDeltaMax,
					degradationDeltaMax: payload.customParams.degradationDeltaMax,
					regrowthStartMax: payload.customParams.regrowthStartMax,
					regrowthEndMin: payload.customParams.regrowthEndMin,
					regrowthDeltaMin: payload.customParams.regrowthDeltaMin,
					morphologicalKernel: payload.customParams.morphologicalKernel,
					minMappingUnitHa: payload.customParams.minMappingUnitHa,
				}
			: null;

	return JSON.stringify({
		caseId,
		t0: {
			provider: payload.t0.provider,
			collection: payload.t0.collection,
			itemIds: payload.t0.itemIds,
		},
		t1: {
			provider: payload.t1.provider,
			collection: payload.t1.collection,
			itemIds: payload.t1.itemIds,
		},
		presetName: payload.presetName,
		customParams: normalizedCustom,
	});
}
