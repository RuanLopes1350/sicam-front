import type {
	AnalysisHardBounds,
	CreateRunBody,
	CustomAlgorithmParams,
	RunPresetName,
	SceneCandidate,
	SceneSearchBody,
	StacProvider,
} from '@/types/api';

export const MAX_WINDOW_SPAN_DAYS = 180;
export const SEASONALITY_THRESHOLD_DAYS = 60;
const DAY_MS = 86_400_000;

export const STAC_PROVIDER_LABELS: Record<StacProvider, string> = {
	aws_earth_search: 'AWS Earth Search (Element84)',
	inpe_bdc: 'INPE Brazil Data Cube',
};

export const RUN_PRESET_LABELS: Record<RunPresetName, string> = {
	TECHNICAL_STANDARD: 'Padrão Técnico',
	CONSERVATIVE: 'Conservador',
	CUSTOM: 'Modo Avançado (Customizado)',
};

export const ALGORITHM_PARAM_LABELS: Record<keyof CustomAlgorithmParams, string> = {
	ndviForestMin: 'NDVI mínimo de floresta',
	ndviClearedMax: 'NDVI máximo de solo exposto',
	deforestationDeltaMax: 'ΔNDVI máximo de desmatamento',
	degradationDeltaMax: 'ΔNDVI máximo de degradação',
	regrowthStartMax: 'NDVI inicial máximo de regeneração',
	regrowthEndMin: 'NDVI final mínimo de regeneração',
	regrowthDeltaMin: 'ΔNDVI mínimo de regeneração',
	morphologicalKernel: 'Kernel morfológico 3×3',
	minMappingUnitHa: 'Unidade mínima de mapeamento (ha)',
};

const NUMERIC_PARAM_KEYS = [
	'ndviForestMin',
	'ndviClearedMax',
	'deforestationDeltaMax',
	'degradationDeltaMax',
	'regrowthStartMax',
	'regrowthEndMin',
	'regrowthDeltaMin',
	'minMappingUnitHa',
] as const;

export function isIsoDateOnly(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function windowRangeMs(w: { from: string; to: string }): { fromMs: number; toMs: number } | null {
	if (!isIsoDateOnly(w.from) || !isIsoDateOnly(w.to)) {
		return null;
	}
	return {
		fromMs: Date.parse(`${w.from}T00:00:00Z`),
		toMs: Date.parse(`${w.to}T23:59:59Z`),
	};
}

export function computeWindowSpanDays(w: { from: string; to: string }): number | null {
	const range = windowRangeMs(w);
	if (!range) {
		return null;
	}
	return (range.toMs - range.fromMs) / DAY_MS;
}

export function validateSceneSearchForm(body: SceneSearchBody): string[] {
	const errors: string[] = [];
	const windows = [
		{ label: 'Janela T0 (base)', value: body.t0Window },
		{ label: 'Janela T1 (alvo)', value: body.t1Window },
	];

	const ranges: Array<{ fromMs: number; toMs: number } | null> = [];
	for (const w of windows) {
		const range = windowRangeMs(w.value);
		ranges.push(range);
		if (!range) {
			errors.push(`${w.label}: informe datas válidas no formato AAAA-MM-DD.`);
			continue;
		}
		if (range.fromMs > range.toMs) {
			errors.push(`${w.label}: a data inicial deve ser anterior ou igual à data final.`);
			continue;
		}
		const span = (range.toMs - range.fromMs) / DAY_MS;
		if (span > MAX_WINDOW_SPAN_DAYS) {
			errors.push(
				`${w.label}: a janela excede o limite máximo de ${MAX_WINDOW_SPAN_DAYS} dias.`,
			);
		}
	}

	const [r0, r1] = ranges;
	if (r0 && r1 && r1.toMs <= r0.fromMs) {
		errors.push('A janela T1 (alvo) deve conter datas posteriores ao início da janela T0 (base).');
	}

	if (!Array.isArray(body.providers) || body.providers.length === 0) {
		errors.push('Selecione ao menos um provedor STAC.');
	}

	const cloud = body.maxGlobalCloudPct;
	if (typeof cloud !== 'number' || !Number.isFinite(cloud) || cloud < 0 || cloud > 100) {
		errors.push('A nuvem global máxima deve estar entre 0 e 100%.');
	}

	const limit = body.limitPerWindow;
	if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 25) {
		errors.push('O limite por janela deve ser um inteiro entre 1 e 25.');
	}

	return errors;
}

function formatUtcDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function buildDefaultSearchWindows(now: Date): {
	t0Window: { from: string; to: string };
	t1Window: { from: string; to: string };
} {
	const nowMs = now.getTime();
	return {
		t1Window: {
			from: formatUtcDate(new Date(nowMs - 90 * DAY_MS)),
			to: formatUtcDate(now),
		},
		t0Window: {
			from: formatUtcDate(new Date(nowMs - (365 + 90) * DAY_MS)),
			to: formatUtcDate(new Date(nowMs - 365 * DAY_MS)),
		},
	};
}

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

// Porte literal de runService.computeSeasonalityWarning do sicam-api
export function computeSeasonalityGap(
	t0Iso: string,
	t1Iso: string,
): { minDiffDays: number; warning: boolean } {
	const d0 = new Date(t0Iso);
	const d1 = new Date(t1Iso);
	const y1 = d1.getUTCFullYear();
	const month0 = d0.getUTCMonth();
	const day0 = d0.getUTCDate();
	const t1Ms = d1.getTime();

	let minDiffDays = Number.POSITIVE_INFINITY;
	for (const candidateYear of [y1 - 1, y1, y1 + 1]) {
		const clampedDay = month0 === 1 && day0 === 29 && !isLeapYear(candidateYear) ? 28 : day0;
		const candidateMs = Date.UTC(
			candidateYear,
			month0,
			clampedDay,
			d0.getUTCHours(),
			d0.getUTCMinutes(),
			d0.getUTCSeconds(),
		);
		const diffDays = Math.abs(t1Ms - candidateMs) / DAY_MS;
		if (diffDays < minDiffDays) {
			minDiffDays = diffDays;
		}
	}

	return { minDiffDays, warning: minDiffDays > SEASONALITY_THRESHOLD_DAYS };
}

export type SceneSortMode = 'aoi_cloud_asc' | 'acquired_desc' | 'coverage_desc';

export const SCENE_SORT_LABELS: Record<SceneSortMode, string> = {
	aoi_cloud_asc: 'Menor % de nuvem real na AOI',
	acquired_desc: 'Data de aquisição (mais recente)',
	coverage_desc: 'Maior cobertura da AOI',
};

export function sortSceneCandidates(
	list: readonly SceneCandidate[],
	mode: SceneSortMode,
): SceneCandidate[] {
	const copy = [...list];
	const byDateDesc = (a: SceneCandidate, b: SceneCandidate) =>
		Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt);

	copy.sort((a, b) => {
		if (mode === 'acquired_desc') {
			return byDateDesc(a, b);
		}
		if (mode === 'coverage_desc') {
			return b.aoiCoveragePct - a.aoiCoveragePct || a.aoiCloudPct - b.aoiCloudPct;
		}
		return (
			a.aoiCloudPct - b.aoiCloudPct ||
			b.aoiCoveragePct - a.aoiCoveragePct ||
			byDateDesc(a, b)
		);
	});

	return copy;
}

function validateItemIds(label: string, ids: readonly string[]): string[] {
	const errors: string[] = [];
	if (ids.length === 0) {
		errors.push(`A cena ${label} não possui itens STAC.`);
	}
	if (ids.length > 8) {
		errors.push(`A cena ${label} excede o máximo de 8 itens STAC.`);
	}
	if (new Set(ids).size !== ids.length) {
		errors.push(`A cena ${label} possui identificadores de item duplicados.`);
	}
	return errors;
}

export function validateSelectionPair(
	t0: SceneCandidate | null,
	t1: SceneCandidate | null,
): string[] {
	const errors: string[] = [];
	if (!t0) {
		errors.push('Selecione a cena T0 (base).');
	}
	if (!t1) {
		errors.push('Selecione a cena T1 (alvo).');
	}
	if (!t0 || !t1) {
		return errors;
	}
	if (Date.parse(t1.acquiredAt) <= Date.parse(t0.acquiredAt)) {
		errors.push('A cena T1 deve ser posterior à cena T0.');
	}
	errors.push(...validateItemIds('T0', t0.itemIds), ...validateItemIds('T1', t1.itemIds));
	return errors;
}

export function validateCustomParams(
	params: CustomAlgorithmParams,
	hardBounds: AnalysisHardBounds,
): Array<{ field: keyof CustomAlgorithmParams; message: string }> {
	const issues: Array<{ field: keyof CustomAlgorithmParams; message: string }> = [];

	for (const key of NUMERIC_PARAM_KEYS) {
		const value = params[key];
		const bound = hardBounds[key];
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			issues.push({ field: key, message: 'Informe um número válido.' });
			continue;
		}
		if (value < bound.min || value > bound.max) {
			issues.push({
				field: key,
				message: `Fora do limite técnico permitido (${bound.min} a ${bound.max}).`,
			});
		}
	}

	if (params.morphologicalKernel !== 0 && params.morphologicalKernel !== 3) {
		issues.push({ field: 'morphologicalKernel', message: 'O kernel deve ser 0 ou 3.' });
	}
	if (params.ndviForestMin <= params.ndviClearedMax) {
		issues.push({
			field: 'ndviForestMin',
			message: 'O NDVI de floresta deve ser maior que o NDVI de solo exposto.',
		});
	}
	if (params.deforestationDeltaMax > params.degradationDeltaMax) {
		issues.push({
			field: 'deforestationDeltaMax',
			message: 'O ΔNDVI de desmatamento deve ser menor ou igual ao de degradação.',
		});
	}
	if (params.regrowthEndMin <= params.regrowthStartMax) {
		issues.push({
			field: 'regrowthEndMin',
			message: 'O NDVI final de regeneração deve ser maior que o inicial.',
		});
	}

	return issues;
}

export function buildCreateRunPayload(input: {
	t0: SceneCandidate;
	t1: SceneCandidate;
	presetName: RunPresetName;
	customParams: CustomAlgorithmParams | null;
}): CreateRunBody {
	if (input.presetName === 'CUSTOM' && !input.customParams) {
		throw new Error('O preset CUSTOM exige parâmetros customizados.');
	}

	return {
		t0: {
			provider: input.t0.provider,
			collection: input.t0.collection,
			itemIds: [...input.t0.itemIds],
		},
		t1: {
			provider: input.t1.provider,
			collection: input.t1.collection,
			itemIds: [...input.t1.itemIds],
		},
		presetName: input.presetName,
		customParams: input.presetName === 'CUSTOM' ? { ...input.customParams! } : null,
	};
}
