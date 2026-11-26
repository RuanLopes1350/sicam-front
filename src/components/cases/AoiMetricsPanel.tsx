'use client';

import { AlertTriangle, CheckCircle2, Compass, Ruler, Shapes } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DEFAULT_AOI_LIMITS, type AoiEvaluationResult } from '@/lib/geo/aoiGeometry';
import { formatAreaHa } from '@/lib/utils/formatters';
import type { SystemCapabilitiesResponse } from '@/types/api';

export interface AoiMetricsPanelProps {
	evaluation: AoiEvaluationResult;
	aoiCapabilities: SystemCapabilitiesResponse['aoi'] | null;
	hasGeometry: boolean;
}

export function AoiMetricsPanel({
	evaluation,
	aoiCapabilities,
	hasGeometry,
}: AoiMetricsPanelProps) {
	const minAreaHa = aoiCapabilities?.minAreaHa ?? DEFAULT_AOI_LIMITS.minAreaHa;
	const maxAreaHa = aoiCapabilities?.maxAreaHa ?? DEFAULT_AOI_LIMITS.maxAreaHa;
	const maxVertices = aoiCapabilities?.maxVertices ?? DEFAULT_AOI_LIMITS.maxVertices;

	const perimeterKm =
		evaluation.perimeterM > 0
			? `${(evaluation.perimeterM / 1000).toLocaleString('pt-BR', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})} km`
			: '—';

	return (
		<div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
					Telemetria Geodésica da AOI (SIRGAS 2000 UTM)
				</p>
				{!hasGeometry ? (
					<Badge variant="neutral">Aguardando delimitação</Badge>
				) : evaluation.isValid ? (
					<Badge variant="success">Topologia e área válidas</Badge>
				) : (
					<Badge variant="danger">Ajuste necessário na geometria</Badge>
				)}
			</div>

			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
				<div className="rounded-lg border border-slate-200 bg-white p-3">
					<div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
						<Ruler className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
						Área Estimada
					</div>
					<p
						className={`mt-1 font-mono text-sm font-bold ${
							!hasGeometry
								? 'text-slate-700'
								: evaluation.areaHa >= minAreaHa && evaluation.areaHa <= maxAreaHa
									? 'text-emerald-700'
									: 'text-red-700'
						}`}
					>
						{hasGeometry ? formatAreaHa(evaluation.areaHa, 2) : '—'}
					</p>
					<p className="mt-0.5 text-[11px] text-slate-500">
						Limite: {formatAreaHa(minAreaHa, 1)} a {formatAreaHa(maxAreaHa, 0)}
					</p>
				</div>

				<div className="rounded-lg border border-slate-200 bg-white p-3">
					<div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
						<Shapes className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
						Vértices Distintos
					</div>
					<p
						className={`mt-1 font-mono text-sm font-bold ${
							evaluation.distinctVertices > maxVertices ? 'text-red-700' : 'text-slate-900'
						}`}
					>
						{hasGeometry ? `${evaluation.distinctVertices} / ${maxVertices}` : `0 / ${maxVertices}`}
					</p>
					<p className="mt-0.5 text-[11px] text-slate-500">Perímetro: {perimeterKm}</p>
				</div>

				<div className="rounded-lg border border-slate-200 bg-white p-3">
					<div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
						<Compass className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
						Projeção Oficial
					</div>
					<p className="mt-1 font-mono text-xs font-bold text-slate-900">
						{evaluation.utmSrid ? `EPSG:${evaluation.utmSrid}` : '—'}
					</p>
					<p className="mt-0.5 truncate text-[11px] text-slate-500" title={evaluation.utmZoneLabel ?? undefined}>
						{evaluation.utmZoneLabel ?? 'Calculado automaticamente pelo centroide'}
					</p>
				</div>
			</div>

			{hasGeometry && evaluation.isValid ? (
				<div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
					<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
					<span>
						Geometria simples sem buracos validada localmente. O PostGIS recalculará a área exata ao registrar o caso.
					</span>
				</div>
			) : null}

			{evaluation.issues.length > 0 ? (
				<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
						<ul className="list-disc space-y-0.5 pl-4">
							{evaluation.issues.map((issue, idx) => (
								<li key={idx}>{issue}</li>
							))}
						</ul>
					</div>
				</div>
			) : null}

			{aoiCapabilities?.enforceLoadedUfs ? (
				<p className="text-[11px] text-slate-500">
					UFs habilitadas na base IBGE:{' '}
					<span className="font-mono font-semibold text-slate-700">
						{aoiCapabilities.loadedUfs.length > 0
							? aoiCapabilities.loadedUfs.map((u) => u.ufCode).join(', ')
							: 'Nenhuma UF importada (importe via pnpm ibge:import no backend)'}
					</span>
				</p>
			) : null}
		</div>
	);
}
