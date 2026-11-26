'use client';

import { ArrowLeft, Compass } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AoiDrawingMap } from '@/components/cases/AoiDrawingMap';
import { AoiMetricsPanel } from '@/components/cases/AoiMetricsPanel';
import { CreateCaseForm } from '@/components/cases/CreateCaseForm';
import { GeoJsonImportModal } from '@/components/cases/GeoJsonImportModal';
import { MunicipalitySearchBox } from '@/components/cases/MunicipalitySearchBox';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useSystemCapabilities } from '@/hooks/useSystemCapabilities';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { createCase } from '@/lib/cases/caseService';
import {
	computePolygonBbox,
	evaluateAoiAgainstCapabilities,
} from '@/lib/geo/aoiGeometry';
import type {
	AoiPolygonGeoJson,
	CreateCaseBody,
	TerritoryMunicipalityItem,
} from '@/types/api';

function NewCaseWorkspaceContent() {
	const router = useRouter();
	const { capabilities, error: capabilitiesError } = useSystemCapabilities(true);

	const [selectedUf, setSelectedUf] = useState('');
	const [selectedMunicipality, setSelectedMunicipality] =
		useState<TerritoryMunicipalityItem | null>(null);
	const [aoi, setAoi] = useState<AoiPolygonGeoJson | null>(null);

	const [focusBounds, setFocusBounds] = useState<[number, number, number, number] | null>(
		null,
	);
	const [focusSequence, setFocusSequence] = useState(0);
	const [geoJsonModalOpen, setGeoJsonModalOpen] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);

	const evaluation = useMemo(
		() => evaluateAoiAgainstCapabilities(aoi, capabilities?.aoi ?? null),
		[aoi, capabilities],
	);

	function triggerBoundsFocus(bounds: [number, number, number, number]) {
		setFocusBounds(bounds);
		setFocusSequence((prev) => prev + 1);
	}

	async function handleSubmitCase(payload: CreateCaseBody) {
		setIsSubmitting(true);
		setProblem(null);
		setGenericError(null);

		try {
			const created = await createCase(payload);
			router.push(`/cases/${created.id}`);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setGenericError('Falha inesperada ao protocolar o caso no servidor.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<Link
						href="/cases"
						className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
					>
						<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
						Voltar ao acervo de casos
					</Link>
					<h1 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
						<Compass className="h-5 w-5 text-brand-700" aria-hidden="true" />
						Novo Caso de Análise &amp; Delimitação de AOI
					</h1>
					<p className="text-sm text-slate-600">
						Localize o município na malha IBGE, desenhe o quadrante/polígono da AOI e valide a área SIRGAS 2000 UTM antes de protocolar.
					</p>
				</div>
			</div>

			{capabilitiesError ? <AlertBanner problem={capabilitiesError} /> : null}
			{problem ? <AlertBanner problem={problem} /> : null}
			{genericError ? (
				<AlertBanner
					variant="error"
					title="Erro na criação do caso"
					message={genericError}
				/>
			) : null}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
				<div className="space-y-4 lg:col-span-8">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle>Localização Territorial IBGE</CardTitle>
							<CardDescription>
								Selecione a UF e pesquise um município para enquadrar automaticamente sua extensão no mapa.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<MunicipalitySearchBox
								autoSelectFirstUf
								selectedUf={selectedUf}
								onSelectUf={setSelectedUf}
								selectedMunicipality={selectedMunicipality}
								onSelectMunicipality={setSelectedMunicipality}
								onFocusMunicipality={(mun) => triggerBoundsFocus(mun.bbox)}
							/>
						</CardContent>
					</Card>

					<AoiDrawingMap
						aoi={aoi}
						isValidAoi={evaluation.isValid}
						municipalityBbox={selectedMunicipality?.bbox ?? null}
						focusBounds={focusBounds}
						focusSequence={focusSequence}
						onChangeAoi={(next) => {
							setAoi(next);
							setProblem(null);
						}}
						onOpenGeoJsonModal={() => setGeoJsonModalOpen(true)}
					/>
				</div>

				<div className="space-y-4 lg:col-span-4">
					<AoiMetricsPanel
						evaluation={evaluation}
						aoiCapabilities={capabilities?.aoi ?? null}
						hasGeometry={aoi !== null}
					/>

					<CreateCaseForm
						aoi={aoi}
						evaluation={evaluation}
						isSubmitting={isSubmitting}
						onSubmitCase={(payload) => void handleSubmitCase(payload)}
					/>
				</div>
			</div>

			<GeoJsonImportModal
				open={geoJsonModalOpen}
				onClose={() => setGeoJsonModalOpen(false)}
				onImport={(imported) => {
					setAoi(imported);
					setProblem(null);
					const bbox = computePolygonBbox(imported);
					if (bbox) {
						triggerBoundsFocus(bbox);
					}
				}}
			/>
		</div>
	);
}

export default function NewCasePage() {
	return (
		<RequireAuth allowedRoles={['analyst']}>
			<NewCaseWorkspaceContent />
		</RequireAuth>
	);
}
