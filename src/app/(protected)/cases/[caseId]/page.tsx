'use client';

import { ArrowLeft, CalendarClock, Edit3, Layers, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { CasesOverviewMap } from '@/components/cases/CasesOverviewMap';
import { EditCaseMetadataModal } from '@/components/cases/EditCaseMetadataModal';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { CASE_STATUS_META, getCaseById } from '@/lib/cases/caseService';
import { formatAreaHa, formatDateTimePtBr } from '@/lib/utils/formatters';
import type { CaseDetailResponse, UpdateCaseResponse } from '@/types/api';

function CaseDetailContent() {
	const params = useParams<{ caseId: string }>();
	const caseId = typeof params?.caseId === 'string' ? params.caseId : '';
	const { user } = useAuth();

	const [caseData, setCaseData] = useState<CaseDetailResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);
	const [editModalOpen, setEditModalOpen] = useState(false);

	const loadCase = useCallback(async () => {
		if (!caseId) return;
		setIsLoading(true);
		setProblem(null);
		setGenericError(null);

		try {
			const detail = await getCaseById(caseId);
			setCaseData(detail);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setGenericError('Não foi possível carregar os detalhes do caso.');
			}
		} finally {
			setIsLoading(false);
		}
	}, [caseId]);

	useEffect(() => {
		void loadCase();
	}, [loadCase]);

	function handleMetadataUpdated(updated: UpdateCaseResponse) {
		setCaseData((prev) =>
			prev
				? {
						...prev,
						title: updated.title,
						externalRef: updated.externalRef,
						description: updated.description,
						updatedAt: updated.updatedAt,
					}
				: null,
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-600">
				<Spinner size="md" />
				<span>Carregando dossiê espacial do caso...</span>
			</div>
		);
	}

	if (problem || genericError || !caseData) {
		return (
			<div className="space-y-4">
				<Link
					href="/cases"
					className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
				>
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
					Voltar ao acervo de casos
				</Link>
				{problem ? <AlertBanner problem={problem} /> : null}
				{genericError ? (
					<AlertBanner variant="error" title="Falha na consulta" message={genericError} />
				) : null}
			</div>
		);
	}

	const isAnalyst = user?.role === 'analyst';

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<Link
						href="/cases"
						className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
					>
						<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
						Voltar ao acervo de casos
					</Link>

					<div className="flex flex-wrap items-center gap-2 pt-1">
						<span className="rounded-md bg-brand-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
							{caseData.protocolCode}
						</span>
						{caseData.externalRef ? (
							<Badge variant="neutral">Ref.: {caseData.externalRef}</Badge>
						) : null}
						<Badge variant="info">EPSG:{caseData.utmSrid}</Badge>
					</div>

					<h1 className="pt-1 text-xl font-bold text-slate-900">{caseData.title}</h1>
					{caseData.description ? (
						<p className="max-w-3xl text-sm text-slate-600">{caseData.description}</p>
					) : null}
				</div>

				{isAnalyst ? (
					<Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
						<Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
						Editar Metadados
					</Button>
				) : null}
			</div>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
				<div className="lg:col-span-7">
					<CasesOverviewMap
						cases={[
							{
								id: caseData.id,
								protocolCode: caseData.protocolCode,
								title: caseData.title,
								aoiGeoJson: caseData.aoiGeoJson,
							},
						]}
						selectedCaseId={caseData.id}
						title="Delimitação Oficial Imutável da AOI (SIRGAS 2000)"
						heightClassName="h-[360px]"
					/>
				</div>

				<div className="space-y-4 lg:col-span-5">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" />
								Atributos Geodésicos e Territoriais
							</CardTitle>
							<CardDescription>
								Calculados pelo PostGIS em projeção UTM oficial no momento do protocolo.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 text-xs">
							<dl className="grid grid-cols-2 gap-3">
								<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
									<dt className="font-semibold text-slate-500">Área Oficial (AOI)</dt>
									<dd className="mt-1 font-mono text-sm font-bold text-slate-900">
										{formatAreaHa(caseData.aoiAreaHa, 4)}
									</dd>
								</div>

								<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
									<dt className="font-semibold text-slate-500">Perímetro Oficial</dt>
									<dd className="mt-1 font-mono text-sm font-bold text-slate-900">
										{(caseData.aoiPerimeterM / 1000).toLocaleString('pt-BR', {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}{' '}
										km
									</dd>
								</div>

								<div>
									<dt className="font-semibold text-slate-500">Município Dominante</dt>
									<dd className="mt-0.5 font-medium text-slate-900">
										{caseData.primaryMunicipality
											? `${caseData.primaryMunicipality.name} - ${caseData.primaryMunicipality.ufCode} (IBGE ${caseData.primaryMunicipality.ibgeCode})`
											: caseData.stateUf ?? '—'}
									</dd>
								</div>

								<div>
									<dt className="font-semibold text-slate-500">Autor do Protocolo</dt>
									<dd className="mt-0.5 font-medium text-slate-900">
										{caseData.createdBy.fullName} ({caseData.createdBy.registrationCode})
									</dd>
								</div>

								<div className="col-span-2">
									<dt className="font-semibold text-slate-500">Data de Criação (UTC)</dt>
									<dd className="mt-0.5 font-mono text-slate-700">
										{formatDateTimePtBr(caseData.createdAt)} UTC
									</dd>
								</div>
							</dl>

							{caseData.intersectedMunicipalities.length > 0 ? (
								<div>
									<p className="mb-1.5 font-semibold text-slate-600">
										Interseção Municipal IBGE ({caseData.intersectedMunicipalities.length})
									</p>
									<ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
										{caseData.intersectedMunicipalities.map((mun) => (
											<li
												key={mun.ibgeCode}
												className="flex items-center justify-between gap-2 px-3 py-2"
											>
												<span className="font-medium text-slate-800">
													{mun.name} - {mun.ufCode}{' '}
													<span className="font-mono text-[11px] text-slate-400">
														({mun.ibgeCode})
													</span>
												</span>
												<span className="font-mono text-slate-700">
													{formatAreaHa(mun.overlapHa)} ({mun.overlapPct.toFixed(1)}%)
												</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
						</CardContent>
					</Card>
				</div>
			</div>

			<Card>
				<CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2">
							<Layers className="h-4 w-4 text-brand-600" aria-hidden="true" />
							Histórico de Execuções Multitemporais ({caseData.runs.length})
						</CardTitle>
						<CardDescription>
							Versões imutáveis processadas pelo motor científico Sentinel-2 L2A sobre esta AOI.
						</CardDescription>
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{caseData.runs.length === 0 ? (
						<div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-600">
							<CalendarClock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
							<span>
								Nenhuma execução iniciada para este caso. A descoberta de cenas satelitais STAC (T0 e T1) e o disparo de análise serão conectados nas etapas WEB-05 e WEB-06.
							</span>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 text-left text-xs">
								<thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-600">
									<tr>
										<th className="px-3 py-2.5">Versão</th>
										<th className="px-3 py-2.5">Status</th>
										<th className="px-3 py-2.5">Preset</th>
										<th className="px-3 py-2.5">Janela T0 → T1</th>
										<th className="px-3 py-2.5">Supressão / Regeneração</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100 bg-white">
									{caseData.runs.map((run) => {
										const statusMeta = CASE_STATUS_META[run.status];
										return (
											<tr key={run.id}>
												<td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-slate-900">
													v{run.version}
												</td>
												<td className="whitespace-nowrap px-3 py-2.5">
													<Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
												</td>
												<td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-700">
													{run.presetName}
												</td>
												<td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-600">
													{formatDateTimePtBr(run.t0AcquiredAt)} →{' '}
													{formatDateTimePtBr(run.t1AcquiredAt)}
												</td>
												<td className="whitespace-nowrap px-3 py-2.5 font-mono">
													<span className="text-red-700">
														{formatAreaHa(run.deforestationHa)}
													</span>{' '}
													/{' '}
													<span className="text-emerald-700">
														{formatAreaHa(run.regrowthHa)}
													</span>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>

			<EditCaseMetadataModal
				open={editModalOpen}
				caseData={caseData}
				onClose={() => setEditModalOpen(false)}
				onUpdated={handleMetadataUpdated}
			/>
		</div>
	);
}

export default function CaseDetailPage() {
	return (
		<RequireAuth allowedRoles={['analyst', 'auditor', 'admin']}>
			<CaseDetailContent />
		</RequireAuth>
	);
}
