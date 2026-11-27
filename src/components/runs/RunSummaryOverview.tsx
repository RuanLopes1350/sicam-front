'use client';

import { CheckCircle2, Image as ImageIcon, Layers, ShieldAlert } from 'lucide-react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { CASE_STATUS_META } from '@/lib/cases/caseService';
import { RUN_PRESET_LABELS, STAC_PROVIDER_LABELS } from '@/lib/scenes/sceneSelection';
import {
	formatAreaHa,
	formatBytesPtBr,
	formatDateTimePtBr,
	truncateSha256,
} from '@/lib/utils/formatters';
import type { RunDetailResponse, RunPresetName, RunRasterAssetItem } from '@/types/api';

export interface RunSummaryOverviewProps {
	run: RunDetailResponse;
	hideNextStepBanner?: boolean;
}

const RASTER_ASSET_LABELS: Record<RunRasterAssetItem['assetType'], string> = {
	t0_rgb: 'Composição RGB Natural — T0 (Base)',
	t1_rgb: 'Composição RGB Natural — T1 (Alvo)',
	t0_false_color: 'Falsa-Cor Infravermelho — T0 (Base)',
	t1_false_color: 'Falsa-Cor Infravermelho — T1 (Alvo)',
	delta_ndvi_mask: 'Máscara Temática ΔNDVI + Nuvens SCL',
};

export function RunSummaryOverview({
	run,
	hideNextStepBanner = false,
}: RunSummaryOverviewProps) {
	const statusMeta = CASE_STATUS_META[run.status];
	const presetLabel =
		RUN_PRESET_LABELS[run.presetName as RunPresetName] ?? run.presetName;

	return (
		<div className="space-y-5">
			{run.summary.visibilityCompromisedWarning ? (
				<AlertBanner
					variant="warning"
					title="Visibilidade parcialmente comprometida por cobertura de nuvens/sombras"
					message={`Obstrução estimada em ${run.summary.cloudObstructionPct?.toFixed(1) ?? '—'}% da AOI pela máscara SCL. Avalie cuidadosamente as áreas mascaradas antes da emissão.`}
				/>
			) : null}

			{run.seasonalityWarning ? (
				<AlertBanner
					variant="warning"
					title="Execução com defasagem sazonal superior a 60 dias"
					message="As cenas T0 e T1 pertencem a momentos sazonais distintos no ciclo anual."
				/>
			) : null}

			<Card>
				<CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
							Sumário Quantitativo SIRGAS 2000 — Versão v{run.version}
						</CardTitle>
						<CardDescription>
							Áreas calculadas em projeção UTM oficial no PostGIS ({run.summary.activeFeatureCount} feições ativas · {run.summary.dismissedFeatureCount} descartadas como ruído).
						</CardDescription>
					</div>

					<Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
				</CardHeader>

				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						<div className="rounded-lg border border-red-200 bg-red-50/70 p-3.5">
							<p className="text-xs font-semibold text-red-900">
								Desmatamento / Supressão
							</p>
							<p className="mt-1 font-mono text-lg font-bold text-red-700">
								{formatAreaHa(run.summary.deforestationHa, 2)}
							</p>
						</div>

						<div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5">
							<p className="text-xs font-semibold text-amber-900">Degradação</p>
							<p className="mt-1 font-mono text-lg font-bold text-amber-800">
								{formatAreaHa(run.summary.degradationHa, 2)}
							</p>
						</div>

						<div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5">
							<p className="text-xs font-semibold text-emerald-900">
								Regeneração Vegetal
							</p>
							<p className="mt-1 font-mono text-lg font-bold text-emerald-700">
								{formatAreaHa(run.summary.regrowthHa, 2)}
							</p>
						</div>

						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600">
								Área Válida Analisada
							</p>
							<p className="mt-1 font-mono text-sm font-bold text-slate-900">
								{formatAreaHa(run.summary.validAnalyzedHa, 2)}
							</p>
						</div>

						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600">
								Nuvem / Sombra Mascarada (SCL)
							</p>
							<p className="mt-1 font-mono text-sm font-bold text-slate-900">
								{formatAreaHa(run.summary.cloudMaskedHa, 2)} (
								{run.summary.cloudObstructionPct !== null
									? `${run.summary.cloudObstructionPct.toFixed(1)}%`
									: '—'}
								)
							</p>
						</div>

						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600">
								Superfície Estável
							</p>
							<p className="mt-1 font-mono text-sm font-bold text-slate-900">
								{formatAreaHa(run.summary.stableHa, 2)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Layers className="h-4 w-4 text-brand-600" aria-hidden="true" />
							Proveniência das Cenas &amp; Parâmetros
						</CardTitle>
						<CardDescription>
							Executado por {run.executedBy.fullName} ({run.executedBy.registrationCode}) · Motor {run.engineVersion}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-3 text-xs">
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="font-semibold text-slate-800">Cena T0 (Base)</span>
								<Badge variant="neutral">
									{run.t0.isMultiTile
										? `Mosaico (${run.t0.itemIds.length} tiles)`
										: 'Tile único'}
								</Badge>
							</div>
							<p className="mt-1 font-mono text-slate-900">
								{formatDateTimePtBr(run.t0.acquiredAt)} UTC
							</p>
							<p className="mt-0.5 text-slate-600">
								{STAC_PROVIDER_LABELS[run.t0.provider]} · {run.t0.collection} · Nuvem AOI:{' '}
								<strong>{run.t0.aoiCloudPct.toFixed(1)}%</strong>
							</p>
						</div>

						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="font-semibold text-slate-800">Cena T1 (Alvo)</span>
								<Badge variant="neutral">
									{run.t1.isMultiTile
										? `Mosaico (${run.t1.itemIds.length} tiles)`
										: 'Tile único'}
								</Badge>
							</div>
							<p className="mt-1 font-mono text-slate-900">
								{formatDateTimePtBr(run.t1.acquiredAt)} UTC
							</p>
							<p className="mt-0.5 text-slate-600">
								{STAC_PROVIDER_LABELS[run.t1.provider]} · {run.t1.collection} · Nuvem AOI:{' '}
								<strong>{run.t1.aoiCloudPct.toFixed(1)}%</strong>
							</p>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
							<span className="font-semibold text-slate-700">Preset Espectral</span>
							<div className="flex items-center gap-1.5">
								<span className="font-mono font-semibold text-slate-900">
									{presetLabel}
								</span>
								{run.isCustomParams ? (
									<Badge variant="warning">isCustomParams</Badge>
								) : null}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ImageIcon className="h-4 w-4 text-brand-600" aria-hidden="true" />
							Catálogo de Rasters Gerados ({run.rasterAssets.length})
						</CardTitle>
						<CardDescription>
							Evidências lossless P2–P98 persistidas no S3 privado para sobreposição no MapLibre GL.
						</CardDescription>
					</CardHeader>

					<CardContent>
						{run.rasterAssets.length === 0 ? (
							<div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
								<ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
								<span>Nenhum raster catalogado nesta execução.</span>
							</div>
						) : (
							<ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs">
								{run.rasterAssets.map((asset) => (
									<li
										key={asset.id}
										className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
									>
										<div>
											<p className="font-medium text-slate-900">
												{RASTER_ASSET_LABELS[asset.assetType] ?? asset.assetType}
											</p>
											<p className="font-mono text-[11px] text-slate-500">
												{asset.widthPx} × {asset.heightPx} px · {formatBytesPtBr(asset.sizeBytes)}
											</p>
										</div>
										<span
											className="font-mono text-[11px] text-slate-500"
											title={asset.sha256}
										>
											SHA-256: {truncateSha256(asset.sha256, 8, 6)}
										</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>

			{!hideNextStepBanner ? (
				<AlertBanner
					variant="info"
					title="Próxima etapa (WEB-07)"
					message="A Mesa de Inspeção Multitemporal (cortina Before/After Swipe no MapLibre GL) e a Curadoria Auditável de feições serão habilitadas na etapa WEB-07."
				/>
			) : null}
		</div>
	);
}
