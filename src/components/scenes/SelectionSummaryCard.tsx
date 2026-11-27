'use client';

import { FileJson } from 'lucide-react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
	ALGORITHM_PARAM_LABELS,
	buildCreateRunPayload,
	computeSeasonalityGap,
	RUN_PRESET_LABELS,
	STAC_PROVIDER_LABELS,
	validateCustomParams,
	validateSelectionPair,
} from '@/lib/scenes/sceneSelection';
import { formatDateTimePtBr } from '@/lib/utils/formatters';
import type {
	AnalysisHardBounds,
	CustomAlgorithmParams,
	RunPresetName,
	SceneCandidate,
} from '@/types/api';

export interface SelectionSummaryCardProps {
	t0: SceneCandidate | null;
	t1: SceneCandidate | null;
	presetName: RunPresetName;
	customParams: CustomAlgorithmParams;
	hardBounds: AnalysisHardBounds | null;
}

export function SelectionSummaryCard({
	t0,
	t1,
	presetName,
	customParams,
	hardBounds,
}: SelectionSummaryCardProps) {
	const pairIssues = validateSelectionPair(t0, t1);
	const paramIssues =
		presetName === 'CUSTOM' && hardBounds
			? validateCustomParams(customParams, hardBounds).map(
					(item) => `${ALGORITHM_PARAM_LABELS[item.field]}: ${item.message}`,
				)
			: [];
	const allIssues = [...pairIssues, ...paramIssues];
	const isReady = Boolean(t0 && t1 && allIssues.length === 0);

	const seasonality = t0 && t1 ? computeSeasonalityGap(t0.acquiredAt, t1.acquiredAt) : null;

	const payload =
		isReady && t0 && t1
			? buildCreateRunPayload({
					t0,
					t1,
					presetName,
					customParams: presetName === 'CUSTOM' ? customParams : null,
				})
			: null;

	return (
		<Card>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2">
						<FileJson className="h-4 w-4 text-brand-600" aria-hidden="true" />
						Resumo da Seleção para Execução
					</CardTitle>
					<CardDescription>
						Consolidação das cenas T0/T1 e configuração espectral para envio à fila de análise.
					</CardDescription>
				</div>

				{isReady ? (
					<Badge variant="success">Seleção pronta para disparo</Badge>
				) : (
					<Badge variant="warning">Seleção incompleta</Badge>
				)}
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
					<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
						<p className="font-semibold text-slate-600">Cena T0 (Base)</p>
						{t0 ? (
							<div className="mt-1 space-y-0.5">
								<p className="font-mono font-bold text-slate-900">
									{formatDateTimePtBr(t0.acquiredAt)} UTC
								</p>
								<p className="text-slate-600">
									{STAC_PROVIDER_LABELS[t0.provider]} · {t0.aoiCloudPct.toFixed(1)}% nuvem AOI
								</p>
								<p className="text-slate-500">
									{t0.isMultiTile ? `Mosaico (${t0.itemIds.length} tiles)` : 'Tile único'}
								</p>
							</div>
						) : (
							<p className="mt-1 text-slate-400">Nenhuma cena selecionada</p>
						)}
					</div>

					<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
						<p className="font-semibold text-slate-600">Cena T1 (Alvo)</p>
						{t1 ? (
							<div className="mt-1 space-y-0.5">
								<p className="font-mono font-bold text-slate-900">
									{formatDateTimePtBr(t1.acquiredAt)} UTC
								</p>
								<p className="text-slate-600">
									{STAC_PROVIDER_LABELS[t1.provider]} · {t1.aoiCloudPct.toFixed(1)}% nuvem AOI
								</p>
								<p className="text-slate-500">
									{t1.isMultiTile ? `Mosaico (${t1.itemIds.length} tiles)` : 'Tile único'}
								</p>
							</div>
						) : (
							<p className="mt-1 text-slate-400">Nenhuma cena selecionada</p>
						)}
					</div>

					<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
						<p className="font-semibold text-slate-600">Preset &amp; Sazonalidade</p>
						<p className="mt-1 font-semibold text-slate-900">
							{RUN_PRESET_LABELS[presetName]}
						</p>
						<p className="mt-0.5 text-slate-600">
							{seasonality
								? `Defasagem anual: ${Math.round(seasonality.minDiffDays)} dias`
								: 'Defina T0 e T1 para calcular defasagem'}
						</p>
					</div>
				</div>

				{payload ? (
					<div className="space-y-3">
						<div>
							<p className="mb-1 text-xs font-semibold text-slate-700">
								Payload validado (POST /api/v1/cases/:caseId/runs)
							</p>
							<pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100">
								{JSON.stringify(payload, null, 2)}
							</pre>
						</div>

						<AlertBanner
							variant="info"
							title="Próxima etapa (WEB-06)"
							message="O disparo com Idempotency-Key e o acompanhamento SSE serão habilitados na etapa WEB-06."
						/>
					</div>
				) : (
					<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
						<p className="font-semibold">Pendências para liberar o disparo:</p>
						<ul className="mt-1 list-disc space-y-0.5 pl-4">
							{allIssues.map((issue, idx) => (
								<li key={idx}>{issue}</li>
							))}
						</ul>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
