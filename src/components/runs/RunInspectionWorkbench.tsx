'use client';

import { FileOutput } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DismissFeatureModal } from '@/components/runs/DismissFeatureModal';
import { FeaturesCurationTable } from '@/components/runs/FeaturesCurationTable';
import { FrozenExportCustodyCard } from '@/components/runs/FrozenExportCustodyCard';
import { MultitemporalSwipeMap } from '@/components/runs/MultitemporalSwipeMap';
import { RequestExportModal } from '@/components/runs/RequestExportModal';
import { RunSummaryOverview } from '@/components/runs/RunSummaryOverview';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useRunRasters } from '@/hooks/useRunRasters';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { computeFeaturePolygonBbox } from '@/lib/runs/curationLogic';
import { listRunFeaturesGeoJson, reviewRunFeature } from '@/lib/runs/curationService';
import type {
	AoiPolygonGeoJson,
	DetectedFeatureGeoJson,
	OperatorRole,
	PaperFormat,
	RunAreaSummary,
	RunDetailResponse,
} from '@/types/api';

export interface RunInspectionWorkbenchProps {
	run: RunDetailResponse;
	aoiGeoJson: AoiPolygonGeoJson | null;
	userRole: OperatorRole | null;
	defaultPaperFormat?: PaperFormat;
	supportedPaperFormats?: readonly PaperFormat[];
	onRunSummaryUpdated: (summary: RunAreaSummary) => void;
	onExportStarted?: () => void;
}

export function RunInspectionWorkbench({
	run,
	aoiGeoJson,
	userRole,
	defaultPaperFormat = 'A3',
	supportedPaperFormats = ['A3', 'A4'],
	onRunSummaryUpdated,
	onExportStarted,
}: RunInspectionWorkbenchProps) {
	const [features, setFeatures] = useState<DetectedFeatureGeoJson[]>([]);
	const [isLoadingFeatures, setIsLoadingFeatures] = useState(true);
	const [featuresProblem, setFeaturesProblem] = useState<ApiProblemError | null>(null);
	const [featuresError, setFeaturesError] = useState<string | null>(null);

	const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
	const [focusTargetBounds, setFocusTargetBounds] = useState<
		[number, number, number, number] | null
	>(null);
	const [focusSequence, setFocusSequence] = useState(0);

	const [busyFeatureId, setBusyFeatureId] = useState<string | null>(null);
	const [dismissTarget, setDismissTarget] = useState<DetectedFeatureGeoJson | null>(null);
	const [reviewProblem, setReviewProblem] = useState<ApiProblemError | null>(null);
	const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);
	const [exportModalOpen, setExportModalOpen] = useState(false);

	const { rasters, isLoadingRasters, rasterError } = useRunRasters(
		run.id,
		run.rasterAssets,
		true,
	);

	const loadFeatures = useCallback(async () => {
		setIsLoadingFeatures(true);
		setFeaturesProblem(null);
		setFeaturesError(null);
		try {
			const collection = await listRunFeaturesGeoJson(run.id);
			setFeatures(collection.features);
		} catch (err) {
			if (isApiProblemError(err)) {
				setFeaturesProblem(err);
			} else {
				setFeaturesError('Não foi possível carregar os polígonos detectados desta análise.');
			}
		} finally {
			setIsLoadingFeatures(false);
		}
	}, [run.id]);

	useEffect(() => {
		void loadFeatures();
	}, [loadFeatures]);

	const canCurate = userRole === 'analyst' && run.status === 'ready_for_review';
	const readOnlyReason =
		run.status === 'frozen'
			? 'Esta versão está congelada (FROZEN) após emissão cartográfica e não aceita alterações na curadoria.'
			: userRole !== 'analyst'
				? 'Somente operadores com perfil Analista podem confirmar ou descartar polígonos.'
				: null;

	function applyReviewedFeatureResponse(
		updatedProps: DetectedFeatureGeoJson['properties'],
		updatedSummary: RunAreaSummary,
	) {
		setFeatures((prev) =>
			prev.map((feat) =>
				feat.id === updatedProps.id ? { ...feat, properties: updatedProps } : feat,
			),
		);
		onRunSummaryUpdated(updatedSummary);
	}

	async function handleConfirmOrRestore(feature: DetectedFeatureGeoJson) {
		setBusyFeatureId(feature.id);
		setReviewProblem(null);
		setReviewSuccessMessage(null);
		try {
			const nextStatus =
				feature.properties.reviewStatus === 'dismissed_noise'
					? 'auto_detected'
					: 'confirmed';
			const res = await reviewRunFeature(run.id, feature.id, {
				reviewStatus: nextStatus,
				dismissalReason: null,
			});
			applyReviewedFeatureResponse(res.feature, res.updatedSummary);
			setReviewSuccessMessage(
				nextStatus === 'confirmed'
					? `Polígono ${res.feature.label} confirmado com sucesso.`
					: `Polígono ${res.feature.label} restaurado e áreas recalculadas.`,
			);
		} catch (err) {
			if (isApiProblemError(err)) {
				setReviewProblem(err);
			}
		} finally {
			setBusyFeatureId(null);
		}
	}

	async function handleConfirmDismiss(featureId: string, dismissalReason: string) {
		setBusyFeatureId(featureId);
		setReviewProblem(null);
		setReviewSuccessMessage(null);
		try {
			const res = await reviewRunFeature(run.id, featureId, {
				reviewStatus: 'dismissed_noise',
				dismissalReason,
			});
			applyReviewedFeatureResponse(res.feature, res.updatedSummary);
			setDismissTarget(null);
			setReviewSuccessMessage(
				`Polígono ${res.feature.label} descartado como ruído e áreas recalculadas no PostGIS.`,
			);
		} catch (err) {
			if (isApiProblemError(err)) {
				setReviewProblem(err);
			}
		} finally {
			setBusyFeatureId(null);
		}
	}

	function handleSelectAndZoom(feature: DetectedFeatureGeoJson) {
		setSelectedFeatureId(feature.id);
		const bbox = computeFeaturePolygonBbox(feature.geometry);
		if (bbox) {
			setFocusTargetBounds(bbox);
			setFocusSequence((prev) => prev + 1);
		}
	}

	return (
		<div className="space-y-6">
			<RunSummaryOverview run={run} hideNextStepBanner />

			{rasterError ? (
				typeof rasterError === 'string' ? (
					<AlertBanner variant="warning" title="Rasters PNG" message={rasterError} />
				) : (
					<AlertBanner problem={rasterError} />
				)
			) : null}

			{featuresProblem ? <AlertBanner problem={featuresProblem} /> : null}
			{featuresError ? (
				<AlertBanner variant="error" title="Feições indisponíveis" message={featuresError} />
			) : null}
			{reviewProblem && !dismissTarget ? <AlertBanner problem={reviewProblem} /> : null}
			{reviewSuccessMessage ? (
				<AlertBanner
					variant="success"
					title="Curadoria registrada"
					message={reviewSuccessMessage}
				/>
			) : null}

			<MultitemporalSwipeMap
				aoiGeoJson={aoiGeoJson}
				t0AcquiredAt={run.t0.acquiredAt}
				t1AcquiredAt={run.t1.acquiredAt}
				rasters={rasters}
				isLoadingRasters={isLoadingRasters}
				features={features}
				selectedFeatureId={selectedFeatureId}
				focusTargetBounds={focusTargetBounds}
				focusSequence={focusSequence}
				onSelectFeature={(featureId) => setSelectedFeatureId(featureId)}
			/>

			{isLoadingFeatures ? (
				<div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-600">
					<Spinner size="sm" />
					<span>Carregando feições vetorizadas...</span>
				</div>
			) : (
				<FeaturesCurationTable
					features={features}
					selectedFeatureId={selectedFeatureId}
					canCurate={canCurate}
					readOnlyReason={readOnlyReason}
					busyFeatureId={busyFeatureId}
					onSelectAndZoom={handleSelectAndZoom}
					onConfirmFeature={(feat) => void handleConfirmOrRestore(feat)}
					onOpenDismissModal={(feat) => {
						setReviewProblem(null);
						setDismissTarget(feat);
					}}
				/>
			)}

			<DismissFeatureModal
				open={dismissTarget !== null}
				feature={dismissTarget}
				isSubmitting={busyFeatureId !== null && busyFeatureId === dismissTarget?.id}
				problem={reviewProblem}
				onClose={() => setDismissTarget(null)}
				onConfirmDismiss={(fid, reason) => void handleConfirmDismiss(fid, reason)}
			/>

			{run.status === 'frozen' ? (
				<FrozenExportCustodyCard runId={run.id} />
			) : run.status === 'ready_for_review' && userRole === 'analyst' ? (
				<Card className="border-brand-200 bg-brand-50/30">
					<CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2">
								<FileOutput className="h-4 w-4 text-brand-700" aria-hidden="true" />
								Emissão Oficial da Carta-Imagem &amp; Pacote Técnico
							</CardTitle>
							<CardDescription>
								{run.summary.activeFeatureCount} feição(ões) ativa(s) e{' '}
								{run.summary.dismissedFeatureCount} descartada(s). A emissão gera o PDF 300 DPI + pacote .zip e congela permanentemente esta versão.
							</CardDescription>
						</div>

						<Button variant="primary" onClick={() => setExportModalOpen(true)}>
							<FileOutput className="h-4 w-4" aria-hidden="true" />
							Emitir Carta-Imagem (A3/A4) &amp; Congelar Versão
						</Button>
					</CardHeader>
					<CardContent className="pt-0 text-xs text-slate-600">
						Revise todos os polígonos no comparador acima antes de emitir o pacote final com selo criptográfico SHA-256.
					</CardContent>
				</Card>
			) : (
				<AlertBanner
					variant="info"
					title="Aguardando emissão cartográfica"
					message="Esta versão encontra-se em revisão (ready_for_review) e aguarda solicitação de emissão oficial por um operador Analista."
				/>
			)}

			<RequestExportModal
				open={exportModalOpen}
				runId={run.id}
				runVersion={run.version}
				activeFeatureCount={run.summary.activeFeatureCount}
				dismissedFeatureCount={run.summary.dismissedFeatureCount}
				defaultPaperFormat={defaultPaperFormat}
				supportedPaperFormats={supportedPaperFormats}
				onClose={() => setExportModalOpen(false)}
				onExportRequested={() => {
					onExportStarted?.();
				}}
			/>
		</div>
	);
}
