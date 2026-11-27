'use client';

import {
	Activity,
	CheckCircle2,
	Clock,
	Radio,
	RotateCcw,
	XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type {
	RunFailureInfo,
	RunTimelineEntry,
	SseConnectionState,
} from '@/hooks/useRunEventsStream';
import type { ApiProblemError } from '@/lib/api/problemDetails';
import {
	ANALYSIS_PIPELINE_STEPS,
	isTerminalAnalysisStatus,
	resolvePipelineStepIndex,
} from '@/lib/runs/runStages';
import { cn } from '@/lib/utils/cn';
import { formatDateTimePtBr } from '@/lib/utils/formatters';
import type { RunStatus } from '@/types/api';

export interface RunProgressTrackerProps {
	caseId: string;
	runVersion: number;
	seasonalityWarning: boolean;
	connectionState: SseConnectionState;
	status: RunStatus;
	progressPct: number;
	stepText: string;
	timeline: readonly RunTimelineEntry[];
	failureInfo: RunFailureInfo | null;
	lastHeartbeatAt: string | null;
	streamProblem: ApiProblemError | string | null;
	canRetryNewRun?: boolean;
}

const CONNECTION_BADGE: Record<
	SseConnectionState,
	{ label: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }
> = {
	idle: { label: 'Aguardando stream', variant: 'neutral' },
	connecting: { label: 'Conectando SSE...', variant: 'info' },
	streaming: { label: 'Conectado via SSE', variant: 'success' },
	reconnecting: { label: 'Reconectando SSE...', variant: 'warning' },
	completed: { label: 'Stream concluído', variant: 'info' },
	error: { label: 'Falha na execução / stream', variant: 'danger' },
};

export function RunProgressTracker({
	caseId,
	runVersion,
	seasonalityWarning,
	connectionState,
	status,
	progressPct,
	stepText,
	timeline,
	failureInfo,
	lastHeartbeatAt,
	streamProblem,
	canRetryNewRun = false,
}: RunProgressTrackerProps) {
	const clampedPct = Math.max(0, Math.min(100, Math.round(progressPct)));
	const activeIdx = resolvePipelineStepIndex(status);
	const isFailed = status === 'failed';
	const badgeInfo = CONNECTION_BADGE[connectionState];

	return (
		<Card>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2">
						<Activity className="h-4 w-4 text-brand-600" aria-hidden="true" />
						Pipeline Analítico em Tempo Real — Versão v{runVersion}
					</CardTitle>
					<CardDescription>
						Streaming seguro (Bearer SSE) dos eventos da fila geo-analysis e transição automática ao concluir.
					</CardDescription>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{lastHeartbeatAt ? (
						<span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
							<Radio className="h-3 w-3 text-emerald-600" aria-hidden="true" />
							Heartbeat: {formatDateTimePtBr(lastHeartbeatAt)} UTC
						</span>
					) : null}
					<Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-5">
				{seasonalityWarning ? (
					<AlertBanner
						variant="warning"
						title="Alerta de sazonalidade (> 60 dias entre T0 e T1)"
						message="A execução compara cenas em períodos distintos do ciclo anual. Avalie possíveis diferenças fenológicas na curadoria."
					/>
				) : null}

				{streamProblem ? (
					typeof streamProblem === 'string' ? (
						<AlertBanner variant="warning" title="Conexão SSE" message={streamProblem} />
					) : (
						<AlertBanner problem={streamProblem} />
					)
				) : null}

				{failureInfo ? (
					<div className="space-y-3">
						<AlertBanner
							variant="error"
							title={`Execução encerrada com falha (${failureInfo.errorCode})`}
							message={failureInfo.message}
						/>
						{canRetryNewRun ? (
							<div>
								<Link
									href={`/cases/${caseId}/analysis/new`}
									className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50"
								>
									<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
									Configurar Nova Execução
								</Link>
							</div>
						) : null}
					</div>
				) : null}

				<div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
					<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
						<span className="font-semibold text-slate-800">{stepText}</span>
						<span className="font-mono text-sm font-bold text-brand-900">
							{clampedPct}%
						</span>
					</div>

					<div
						className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
						role="progressbar"
						aria-valuenow={clampedPct}
						aria-valuemin={0}
						aria-valuemax={100}
					>
						<div
							className={cn(
								'h-full rounded-full transition-all duration-500',
								isFailed
									? 'bg-red-600'
									: clampedPct >= 100
										? 'bg-emerald-600'
										: 'bg-brand-600',
							)}
							style={{ width: `${clampedPct}%` }}
						/>
					</div>
				</div>

				<ol className="grid grid-cols-1 gap-3 md:grid-cols-5">
					{ANALYSIS_PIPELINE_STEPS.map((step, index) => {
						const completed =
							!isFailed &&
							(activeIdx > index ||
								(activeIdx === 4 && index === 4 && isTerminalAnalysisStatus(status)));
						const active = !isFailed && activeIdx === index && !completed;

						return (
							<li
								key={step.key}
								className={cn(
									'flex flex-col justify-between rounded-xl border p-3 text-xs transition-colors',
									completed
										? 'border-emerald-200 bg-emerald-50/70'
										: active
											? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200'
											: isFailed
												? 'border-red-200 bg-red-50/40'
												: 'border-slate-200 bg-white',
								)}
							>
								<div className="flex items-start justify-between gap-2">
									<span className="font-mono text-[11px] font-semibold text-slate-500">
										Etapa {index + 1}
									</span>
									{completed ? (
										<CheckCircle2
											className="h-4 w-4 shrink-0 text-emerald-600"
											aria-hidden="true"
										/>
									) : active ? (
										<Spinner size="sm" />
									) : isFailed ? (
										<XCircle
											className="h-4 w-4 shrink-0 text-red-500"
											aria-hidden="true"
										/>
									) : (
										<Clock
											className="h-4 w-4 shrink-0 text-slate-400"
											aria-hidden="true"
										/>
									)}
								</div>

								<div className="mt-2 space-y-1">
									<p className="font-semibold text-slate-900">{step.title}</p>
									<p className="text-[11px] leading-snug text-slate-600">
										{step.description}
									</p>
								</div>
							</li>
						);
					})}
				</ol>

				{timeline.length > 0 ? (
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Eventos Recebidos nesta Sessão ({timeline.length})
						</p>
						<ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white text-xs">
							{timeline.map((item) => (
								<li
									key={item.key}
									className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
								>
									<div className="min-w-0 flex-1">
										<span className="font-medium text-slate-900">
											{item.message?.trim() ? item.message : item.step}
										</span>
										<span className="ml-2 font-mono text-[11px] text-slate-400">
											({item.status})
										</span>
									</div>
									<div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
										<span>{item.progressPct}%</span>
										<span>{formatDateTimePtBr(item.timestamp)} UTC</span>
									</div>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
