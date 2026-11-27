'use client';

import { CheckCircle2, Cloud, Eye, EyeOff, Layers } from 'lucide-react';
import { useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useScenePreview } from '@/hooks/useScenePreview';
import { STAC_PROVIDER_LABELS } from '@/lib/scenes/sceneSelection';
import { cn } from '@/lib/utils/cn';
import { formatDateTimePtBr } from '@/lib/utils/formatters';
import type { SceneCandidate } from '@/types/api';

export interface SceneCandidateCardProps {
	candidate: SceneCandidate;
	selected: boolean;
	slotLabel: 'T0' | 'T1';
	onSelect: () => void;
	disabled?: boolean;
}

function resolveCloudColor(aoiCloudPct: number): string {
	if (aoiCloudPct <= 10) {
		return 'border-emerald-200 bg-emerald-50 text-emerald-800';
	}
	if (aoiCloudPct <= 30) {
		return 'border-amber-200 bg-amber-50 text-amber-800';
	}
	return 'border-red-200 bg-red-50 text-red-800';
}

export function SceneCandidateCard({
	candidate,
	selected,
	slotLabel,
	onSelect,
	disabled = false,
}: SceneCandidateCardProps) {
	const [previewOpen, setPreviewOpen] = useState(false);
	const shouldDisplayPreview = previewOpen || selected;

	const { objectUrl, isLoading, error } = useScenePreview(
		candidate.previewUrl,
		shouldDisplayPreview,
	);

	return (
		<div
			className={cn(
				'space-y-3 rounded-xl border p-4 transition-colors',
				selected
					? 'border-brand-600 bg-brand-50/40 ring-2 ring-brand-200'
					: 'border-slate-200 bg-white hover:border-slate-300',
			)}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="space-y-1">
					<p className="font-mono text-xs font-bold text-slate-900">
						{formatDateTimePtBr(candidate.acquiredAt)} UTC
					</p>
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant="neutral">{STAC_PROVIDER_LABELS[candidate.provider]}</Badge>
						<Badge variant="neutral">{candidate.collection}</Badge>
					</div>
				</div>

				<div
					className={cn(
						'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold',
						resolveCloudColor(candidate.aoiCloudPct),
					)}
				>
					<Cloud className="h-3.5 w-3.5" aria-hidden="true" />
					<span>{candidate.aoiCloudPct.toFixed(1)}% nuvem AOI</span>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
				<span>
					Nuvem global:{' '}
					<strong className="font-mono text-slate-900">
						{candidate.globalCloudPct.toFixed(1)}%
					</strong>
				</span>
				<span className="text-slate-300">•</span>
				<span>
					Cobertura da AOI:{' '}
					<strong className="font-mono text-slate-900">
						{candidate.aoiCoveragePct.toFixed(1)}%
					</strong>
				</span>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{candidate.aoiCoveragePct < 99.5 ? (
					<Badge variant="warning">Cobertura parcial</Badge>
				) : null}

				{candidate.isMultiTile ? (
					<Badge variant="info">
						<Layers className="h-3 w-3" aria-hidden="true" />
						Mosaico multi-tile ({candidate.itemIds.length} tiles)
					</Badge>
				) : null}

				{candidate.processingBaseline ? (
					<Badge variant="neutral">Baseline {candidate.processingBaseline}</Badge>
				) : null}

				{candidate.boaOffsetApplied ? (
					<Badge variant="success">Offset BOA aplicado</Badge>
				) : null}
			</div>

			<p
				className="truncate rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600"
				title={candidate.itemIds.join(', ')}
			>
				{candidate.itemIds.join(' · ')}
			</p>

			{shouldDisplayPreview ? (
				<div className="rounded-lg border border-slate-200 bg-slate-950/5 p-2">
					{isLoading ? (
						<div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-600">
							<Spinner size="sm" />
							<span>Carregando miniatura autenticada...</span>
						</div>
					) : error ? (
						typeof error === 'string' ? (
							<AlertBanner variant="error" title="Erro na miniatura" message={error} />
						) : (
							<AlertBanner problem={error} />
						)
					) : objectUrl ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img
							src={objectUrl}
							alt={`Miniatura da cena ${slotLabel} em ${formatDateTimePtBr(candidate.acquiredAt)}`}
							className="h-44 w-full rounded-md bg-slate-900 object-cover"
						/>
					) : null}
				</div>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
				{selected ? (
					<span className="text-[11px] font-medium text-brand-700">
						Miniatura ativa na seleção
					</span>
				) : (
					<Button
						size="sm"
						variant="ghost"
						onClick={() => setPreviewOpen((prev) => !prev)}
					>
						{previewOpen ? (
							<>
								<EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
								Ocultar miniatura
							</>
						) : (
							<>
								<Eye className="h-3.5 w-3.5" aria-hidden="true" />
								Ver miniatura
							</>
						)}
					</Button>
				)}

				<Button
					size="sm"
					variant={selected ? 'secondary' : 'outline'}
					disabled={disabled}
					onClick={onSelect}
				>
					{selected ? (
						<>
							<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
							Selecionado como {slotLabel}
						</>
					) : (
						`Selecionar como ${slotLabel}`
					)}
				</Button>
			</div>
		</div>
	);
}
