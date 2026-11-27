'use client';

import { ArrowLeft, Layers, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RunInspectionWorkbench } from '@/components/runs/RunInspectionWorkbench';
import { RunProgressTracker } from '@/components/runs/RunProgressTracker';
import { RunVersionSelectorBar } from '@/components/runs/RunVersionSelectorBar';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import {
	type RunFailureInfo,
	useRunEventsStream,
} from '@/hooks/useRunEventsStream';
import { useSystemCapabilities } from '@/hooks/useSystemCapabilities';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { CASE_STATUS_META, getCaseById } from '@/lib/cases/caseService';
import { getRunById } from '@/lib/runs/runService';
import { isTerminalAnalysisStatus } from '@/lib/runs/runStages';
import { formatAreaHa } from '@/lib/utils/formatters';
import type { CaseDetailResponse, RunDetailResponse } from '@/types/api';

function RunWorkspaceContent() {
	const params = useParams<{ caseId: string; runId: string }>();
	const caseId = typeof params?.caseId === 'string' ? params.caseId : '';
	const runId = typeof params?.runId === 'string' ? params.runId : '';
	const { user } = useAuth();
	const { capabilities } = useSystemCapabilities(Boolean(user));

	const [caseData, setCaseData] = useState<CaseDetailResponse | null>(null);
	const [runData, setRunData] = useState<RunDetailResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);
	const [autoTransitionMessage, setAutoTransitionMessage] = useState<string | null>(null);
	const [exportFailureBanner, setExportFailureBanner] = useState<RunFailureInfo | null>(null);

	const loadInitial = useCallback(async () => {
		if (!caseId || !runId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setProblem(null);
		setGenericError(null);

		try {
			const [caseRes, runRes] = await Promise.all([
				getCaseById(caseId),
				getRunById(runId),
			]);
			setCaseData(caseRes);
			setRunData(runRes);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setGenericError('Não foi possível carregar os dados da execução.');
			}
		} finally {
			setIsLoading(false);
		}
	}, [caseId, runId]);

	const refreshRunAndCase = useCallback(async () => {
		if (!runId) return;
		setIsRefreshing(true);
		try {
			const [freshCase, freshRun] = await Promise.all([
				caseId ? getCaseById(caseId) : Promise.resolve(null),
				getRunById(runId),
			]);
			if (freshCase) {
				setCaseData(freshCase);
			}
			setRunData(freshRun);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			}
		} finally {
			setIsRefreshing(false);
		}
	}, [caseId, runId]);

	useEffect(() => {
		void loadInitial();
	}, [loadInitial]);

	const shouldStream = Boolean(runData && !isTerminalAnalysisStatus(runData.status));

	const stream = useRunEventsStream({
		runId,
		initialStatus: runData?.status ?? 'queued',
		enabled: shouldStream,
		onTerminalStatus: (finalStatus, failure) => {
			if (failure) {
				setAutoTransitionMessage(null);
				setExportFailureBanner(failure);
			} else if (finalStatus === 'ready_for_review') {
				setExportFailureBanner(null);
				setAutoTransitionMessage(
					'O motor científico concluiu o processamento na fila geo-analysis e realizou a transição automática para a visualização de resultados.',
				);
			} else if (finalStatus === 'frozen') {
				setExportFailureBanner(null);
				setAutoTransitionMessage(
					'A emissão cartográfica (300 DPI + pacote .zip) foi concluída em tempo real e a versão foi congelada com selo FROZEN.',
				);
			}
			void refreshRunAndCase();
		},
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-600">
				<Spinner size="md" />
				<span>Conectando à execução analítica...</span>
			</div>
		);
	}

	if (problem || genericError || !runData) {
		return (
			<div className="space-y-4">
				<Link
					href={caseId ? `/cases/${caseId}` : '/cases'}
					className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
				>
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
					Voltar ao dossiê do caso
				</Link>
				{problem ? <AlertBanner problem={problem} /> : null}
				{genericError ? (
					<AlertBanner variant="error" title="Erro ao carregar execução" message={genericError} />
				) : null}
			</div>
		);
	}

	const effectiveStatus = isTerminalAnalysisStatus(runData.status)
		? runData.status
		: stream.status;
	const statusMeta = CASE_STATUS_META[effectiveStatus];
	const effectiveFailure =
		stream.failureInfo ??
		(runData.status === 'failed' && runData.errorCode
			? {
					errorCode: runData.errorCode,
					message: runData.errorDetail ?? 'Falha durante a execução da análise.',
				}
			: null);

	const showSummary =
		runData.status === 'ready_for_review' || runData.status === 'frozen';

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<Link
						href={`/cases/${caseId}`}
						className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
					>
						<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
						Voltar ao dossiê do caso
					</Link>

					<div className="flex flex-wrap items-center gap-2 pt-1">
						{caseData ? (
							<span className="rounded bg-brand-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
								{caseData.protocolCode}
							</span>
						) : null}
						<Badge variant="neutral">Execução v{runData.version}</Badge>
						<Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
					</div>

					<h1 className="flex items-center gap-2 pt-1 text-lg font-bold text-slate-900">
						<Layers className="h-5 w-5 text-brand-700" aria-hidden="true" />
						{caseData ? caseData.title : 'Acompanhamento de Execução Multitemporal'}
					</h1>
				</div>

				<Button
					size="sm"
					variant="outline"
					isLoading={isRefreshing}
					onClick={() => void refreshRunAndCase()}
				>
					<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
					Atualizar Estado
				</Button>
			</div>

			{caseData ? (
				<Card className="bg-slate-50/70">
					<CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs text-slate-600">
						<span>
							Área da AOI:{' '}
							<strong className="font-mono text-slate-900">
								{formatAreaHa(caseData.aoiAreaHa)}
							</strong>
						</span>
						<span>
							Município:{' '}
							<strong className="text-slate-900">
								{caseData.primaryMunicipality
									? `${caseData.primaryMunicipality.name} - ${caseData.primaryMunicipality.ufCode}`
									: caseData.stateUf ?? '—'}
							</strong>
						</span>
						<span className="font-mono text-slate-500">Run ID: {runData.id}</span>
					</CardContent>
				</Card>
			) : null}

			{caseData ? (
				<RunVersionSelectorBar
					caseId={caseId}
					runs={caseData.runs}
					currentRunId={runData.id}
					isAnalyst={user?.role === 'analyst'}
				/>
			) : null}

			{autoTransitionMessage ? (
				<AlertBanner
					variant="success"
					title="Conclusão em tempo real"
					message={autoTransitionMessage}
				/>
			) : null}

			{exportFailureBanner ? (
				<AlertBanner
					variant="error"
					title={`Falha na emissão (${exportFailureBanner.errorCode})`}
					message={exportFailureBanner.message}
				/>
			) : null}

			{showSummary ? (
				<RunInspectionWorkbench
					run={runData}
					aoiGeoJson={caseData?.aoiGeoJson ?? null}
					userRole={user?.role ?? null}
					defaultPaperFormat={capabilities?.export.defaultPaperFormat ?? 'A3'}
					supportedPaperFormats={capabilities?.export.supportedPaperFormats ?? ['A3', 'A4']}
					onRunSummaryUpdated={(updatedSummary) =>
						setRunData((prev) =>
							prev ? { ...prev, summary: updatedSummary } : null,
						)
					}
					onExportStarted={() => {
						setAutoTransitionMessage(null);
						setExportFailureBanner(null);
						setRunData((prev) =>
							prev ? { ...prev, status: 'exporting' } : null,
						);
					}}
				/>
			) : (
				<RunProgressTracker
					caseId={caseId}
					runVersion={runData.version}
					seasonalityWarning={runData.seasonalityWarning}
					connectionState={stream.connectionState}
					status={effectiveStatus}
					progressPct={stream.progressPct}
					stepText={stream.stepText}
					timeline={stream.timeline}
					failureInfo={effectiveFailure}
					lastHeartbeatAt={stream.lastHeartbeatAt}
					streamProblem={stream.streamProblem}
					canRetryNewRun={user?.role === 'analyst'}
				/>
			)}
		</div>
	);
}

export default function CaseRunDetailPage() {
	return (
		<RequireAuth allowedRoles={['analyst', 'auditor', 'admin']}>
			<RunWorkspaceContent />
		</RequireAuth>
	);
}
