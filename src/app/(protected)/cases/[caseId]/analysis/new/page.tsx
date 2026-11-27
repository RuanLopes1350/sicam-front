'use client';

import { ArrowLeft, Satellite } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AnalysisPresetPanel } from '@/components/scenes/AnalysisPresetPanel';
import { SceneCandidateList } from '@/components/scenes/SceneCandidateList';
import { SceneSearchForm } from '@/components/scenes/SceneSearchForm';
import { SeasonalityAlert } from '@/components/scenes/SeasonalityAlert';
import { SelectionSummaryCard } from '@/components/scenes/SelectionSummaryCard';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useSystemCapabilities } from '@/hooks/useSystemCapabilities';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { getCaseById } from '@/lib/cases/caseService';
import {
	buildDefaultSearchWindows,
	STAC_PROVIDER_LABELS,
} from '@/lib/scenes/sceneSelection';
import { searchScenes } from '@/lib/scenes/sceneService';
import { formatAreaHa } from '@/lib/utils/formatters';
import type {
	CaseDetailResponse,
	CustomAlgorithmParams,
	RunPresetName,
	SceneCandidate,
	SceneSearchBody,
	SceneSearchResponse,
} from '@/types/api';

const FALLBACK_CUSTOM_PARAMS: CustomAlgorithmParams = {
	ndviForestMin: 0.55,
	ndviClearedMax: 0.3,
	deforestationDeltaMax: -0.25,
	degradationDeltaMax: -0.12,
	regrowthStartMax: 0.32,
	regrowthEndMin: 0.52,
	regrowthDeltaMin: 0.18,
	morphologicalKernel: 3,
	minMappingUnitHa: 0.5,
};

function NewCaseAnalysisContent() {
	const params = useParams<{ caseId: string }>();
	const caseId = typeof params?.caseId === 'string' ? params.caseId : '';
	const { capabilities, error: capabilitiesError } = useSystemCapabilities(true);

	const [caseData, setCaseData] = useState<CaseDetailResponse | null>(null);
	const [isLoadingCase, setIsLoadingCase] = useState(true);
	const [caseProblem, setCaseProblem] = useState<ApiProblemError | null>(null);
	const [caseError, setCaseError] = useState<string | null>(null);

	const [searchBody] = useState<SceneSearchBody>(() => ({
		...buildDefaultSearchWindows(new Date()),
		providers: ['aws_earth_search', 'inpe_bdc'],
		maxGlobalCloudPct: 40,
		limitPerWindow: 15,
	}));

	const [isSearching, setIsSearching] = useState(false);
	const [searchProblem, setSearchProblem] = useState<ApiProblemError | null>(null);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [searchResult, setSearchResult] = useState<SceneSearchResponse | null>(null);

	const [selectedT0, setSelectedT0] = useState<SceneCandidate | null>(null);
	const [selectedT1, setSelectedT1] = useState<SceneCandidate | null>(null);

	const [presetName, setPresetName] = useState<RunPresetName>('TECHNICAL_STANDARD');
	const [customParams, setCustomParams] = useState<CustomAlgorithmParams>(FALLBACK_CUSTOM_PARAMS);
	const hasEditedCustomRef = useRef(false);

	const loadCase = useCallback(async () => {
		if (!caseId) {
			setIsLoadingCase(false);
			return;
		}
		setIsLoadingCase(true);
		setCaseProblem(null);
		setCaseError(null);
		try {
			const detail = await getCaseById(caseId);
			setCaseData(detail);
		} catch (err) {
			if (isApiProblemError(err)) {
				setCaseProblem(err);
			} else {
				setCaseError('Não foi possível carregar os dados do caso.');
			}
		} finally {
			setIsLoadingCase(false);
		}
	}, [caseId]);

	useEffect(() => {
		void loadCase();
	}, [loadCase]);

	useEffect(() => {
		const stdPreset = capabilities?.analysis.presets.TECHNICAL_STANDARD;
		if (stdPreset && !hasEditedCustomRef.current) {
			setCustomParams({ ...stdPreset });
		}
	}, [capabilities]);

	async function handleSearch(body: SceneSearchBody) {
		if (!caseId) return;
		setIsSearching(true);
		setSearchProblem(null);
		setSearchError(null);
		setSelectedT0(null);
		setSelectedT1(null);

		try {
			const res = await searchScenes(caseId, body);
			setSearchResult(res);
		} catch (err) {
			if (isApiProblemError(err)) {
				setSearchProblem(err);
			} else {
				setSearchError('Falha ao consultar os catálogos STAC.');
			}
		} finally {
			setIsSearching(false);
		}
	}

	if (isLoadingCase) {
		return (
			<div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-600">
				<Spinner size="md" />
				<span>Carregando parâmetros territoriais do caso...</span>
			</div>
		);
	}

	if (caseProblem || caseError || !caseData) {
		return (
			<div className="space-y-4">
				<Link
					href="/cases"
					className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
				>
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
					Voltar ao acervo de casos
				</Link>
				{caseProblem ? <AlertBanner problem={caseProblem} /> : null}
				{caseError ? (
					<AlertBanner variant="error" title="Caso indisponível" message={caseError} />
				) : null}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<Link
					href={`/cases/${caseData.id}`}
					className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
				>
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
					Voltar ao dossiê do caso ({caseData.protocolCode})
				</Link>
				<h1 className="flex items-center gap-2 pt-1 text-lg font-bold text-slate-900">
					<Satellite className="h-5 w-5 text-brand-700" aria-hidden="true" />
					Nova Análise Multitemporal — Descoberta &amp; Seleção STAC (T0 / T1)
				</h1>
				<p className="text-sm text-slate-600">
					Pesquise cenas Sentinel-2 L2A na janela temporal desejada, compare a obstrução real de nuvens na AOI e defina o preset espectral.
				</p>
			</div>

			<Card className="bg-slate-50/70">
				<CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded bg-brand-900 px-2 py-0.5 font-mono font-bold text-white">
							{caseData.protocolCode}
						</span>
						<span className="font-semibold text-slate-900">{caseData.title}</span>
					</div>

					<div className="flex flex-wrap items-center gap-3 text-slate-600">
						<span>
							Área AOI:{' '}
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
						<Badge variant="info">EPSG:{caseData.utmSrid}</Badge>
					</div>
				</CardContent>
			</Card>

			{capabilitiesError ? <AlertBanner problem={capabilitiesError} /> : null}
			{searchProblem ? <AlertBanner problem={searchProblem} /> : null}
			{searchError ? (
				<AlertBanner variant="error" title="Erro na busca STAC" message={searchError} />
			) : null}

			<SceneSearchForm
				initialValue={searchBody}
				isSearching={isSearching}
				onSearch={(body) => void handleSearch(body)}
			/>

			{searchResult && searchResult.providerWarnings.length > 0 ? (
				<div className="space-y-2">
					{searchResult.providerWarnings.map((warn, idx) => (
						<AlertBanner
							key={`${warn.provider}-${warn.code}-${idx}`}
							variant="warning"
							title={`[${STAC_PROVIDER_LABELS[warn.provider] ?? warn.provider}] ${warn.code}`}
							message={warn.message}
						/>
					))}
				</div>
			) : null}

			{searchResult ? (
				<div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
					<SceneCandidateList
						slot="T0"
						title="Candidatas T0 — Cena Base (Anterior)"
						subtitle="Referência inicial de cobertura florestal antes do período avaliado"
						candidates={searchResult.t0Candidates}
						selectedKey={selectedT0?.candidateKey ?? null}
						onSelect={(candidate) => setSelectedT0(candidate)}
					/>

					<SceneCandidateList
						slot="T1"
						title="Candidatas T1 — Cena Alvo (Posterior)"
						subtitle="Cena mais recente para detecção de ΔNDVI na AOI"
						candidates={searchResult.t1Candidates}
						selectedKey={selectedT1?.candidateKey ?? null}
						onSelect={(candidate) => setSelectedT1(candidate)}
					/>
				</div>
			) : null}

			<SeasonalityAlert t0={selectedT0} t1={selectedT1} />

			<AnalysisPresetPanel
				presets={capabilities?.analysis.presets ?? null}
				hardBounds={capabilities?.analysis.hardBounds ?? null}
				presetName={presetName}
				onPresetChange={setPresetName}
				customParams={customParams}
				onCustomParamsChange={(next) => {
					hasEditedCustomRef.current = true;
					setCustomParams(next);
				}}
			/>

			<SelectionSummaryCard
				t0={selectedT0}
				t1={selectedT1}
				presetName={presetName}
				customParams={customParams}
				hardBounds={capabilities?.analysis.hardBounds ?? null}
			/>
		</div>
	);
}

export default function NewCaseAnalysisPage() {
	return (
		<RequireAuth allowedRoles={['analyst']}>
			<NewCaseAnalysisContent />
		</RequireAuth>
	);
}
