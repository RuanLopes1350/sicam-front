'use client';

import { Check, Crosshair, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import {
	FEATURE_CLASS_META,
	filterAndSortFeatures,
	REVIEW_STATUS_META,
} from '@/lib/runs/curationLogic';
import { cn } from '@/lib/utils/cn';
import { formatAreaHa } from '@/lib/utils/formatters';
import type {
	DetectedFeatureGeoJson,
	FeatureClass,
	FeatureReviewStatus,
} from '@/types/api';

export interface FeaturesCurationTableProps {
	features: readonly DetectedFeatureGeoJson[];
	selectedFeatureId: string | null;
	canCurate: boolean;
	readOnlyReason?: string | null;
	busyFeatureId: string | null;
	onSelectAndZoom: (feature: DetectedFeatureGeoJson) => void;
	onConfirmFeature: (feature: DetectedFeatureGeoJson) => void;
	onOpenDismissModal: (feature: DetectedFeatureGeoJson) => void;
}

export function FeaturesCurationTable({
	features,
	selectedFeatureId,
	canCurate,
	readOnlyReason = null,
	busyFeatureId,
	onSelectAndZoom,
	onConfirmFeature,
	onOpenDismissModal,
}: FeaturesCurationTableProps) {
	const [classFilter, setClassFilter] = useState<'all' | FeatureClass>('all');
	const [statusFilter, setStatusFilter] = useState<'all' | FeatureReviewStatus>('all');

	const visibleFeatures = filterAndSortFeatures(features, {
		featureClass: classFilter,
		reviewStatus: statusFilter,
	});

	return (
		<Card>
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<CardTitle>
							Curadoria de Polígonos Detectados ({features.length})
						</CardTitle>
						<CardDescription>
							Ordenados por área decrescente (P1, P2...). Clique em Zoom para enquadrar no comparador T0 × T1.
						</CardDescription>
					</div>

					<Badge variant="neutral">
						Exibindo {visibleFeatures.length} de {features.length}
					</Badge>
				</div>

				{!canCurate && readOnlyReason ? (
					<AlertBanner variant="info" title="Modo somente leitura" message={readOnlyReason} />
				) : null}

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
					<Select
						label="Classe temática"
						value={classFilter}
						onChange={(event) =>
							setClassFilter(event.target.value as 'all' | FeatureClass)
						}
					>
						<option value="all">Todas as classes</option>
						<option value="deforestation">Desmatamento / Supressão</option>
						<option value="degradation">Degradação Florestal</option>
						<option value="regrowth">Regeneração Vegetal</option>
					</Select>

					<Select
						label="Status de curadoria"
						value={statusFilter}
						onChange={(event) =>
							setStatusFilter(event.target.value as 'all' | FeatureReviewStatus)
						}
					>
						<option value="all">Todos os status</option>
						<option value="auto_detected">Auto-detectado</option>
						<option value="confirmed">Confirmado</option>
						<option value="dismissed_noise">Descartado (Ruído)</option>
					</Select>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{visibleFeatures.length === 0 ? (
					<div className="px-6 py-10 text-center text-sm text-slate-500">
						Nenhuma feição encontrada para os filtros selecionados.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-left text-xs">
							<thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-600">
								<tr>
									<th className="px-4 py-3">Polígono</th>
									<th className="px-4 py-3">Classe</th>
									<th className="px-4 py-3">Área SIRGAS 2000</th>
									<th className="px-4 py-3">Métricas ΔNDVI</th>
									<th className="px-4 py-3">Curadoria / Auditoria</th>
									<th className="px-4 py-3 text-right">Ações</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{visibleFeatures.map((feature) => {
									const props = feature.properties;
									const classMeta = FEATURE_CLASS_META[props.featureClass];
									const statusMeta = REVIEW_STATUS_META[props.reviewStatus];
									const isSelected = selectedFeatureId === feature.id;
									const isDismissed = props.reviewStatus === 'dismissed_noise';
									const isBusy = busyFeatureId === feature.id;

									return (
										<tr
											key={feature.id}
											className={cn(
												isSelected
													? 'bg-brand-50/70'
													: isDismissed
														? 'bg-slate-50/80 text-slate-500'
														: 'hover:bg-slate-50/70',
											)}
										>
											<td className="whitespace-nowrap px-4 py-3">
												<span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-bold text-white">
													{props.label}
												</span>
											</td>

											<td className="whitespace-nowrap px-4 py-3">
												<Badge variant={classMeta.badgeVariant}>
													{classMeta.label}
												</Badge>
											</td>

											<td className="whitespace-nowrap px-4 py-3">
												<p className="font-mono font-bold text-slate-900">
													{formatAreaHa(props.areaHa, 2)}
												</p>
												<p className="font-mono text-[11px] text-slate-500">
													{props.pixelCount.toLocaleString('pt-BR')} px
												</p>
											</td>

											<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-700">
												<p>
													T0: {props.meanNdviT0.toFixed(2)} → T1:{' '}
													{props.meanNdviT1.toFixed(2)}
												</p>
												<p className="font-semibold text-slate-900">
													ΔNDVI: {props.meanDeltaNdvi.toFixed(2)}
												</p>
											</td>

											<td className="max-w-xs px-4 py-3">
												<div className="space-y-1">
													<Badge variant={statusMeta.badgeVariant}>
														{statusMeta.label}
													</Badge>
													{props.reviewedBy ? (
														<p className="text-[11px] text-slate-500">
															Por {props.reviewedBy.fullName} (
															{props.reviewedBy.registrationCode})
														</p>
													) : null}
													{isDismissed && props.dismissalReason ? (
														<p
															className="truncate text-[11px] italic text-slate-600"
															title={props.dismissalReason}
														>
															&ldquo;{props.dismissalReason}&rdquo;
														</p>
													) : null}
												</div>
											</td>

											<td className="whitespace-nowrap px-4 py-3 text-right">
												<div className="inline-flex items-center gap-1.5">
													<Button
														size="sm"
														variant="outline"
														onClick={() => onSelectAndZoom(feature)}
													>
														<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
														Zoom
													</Button>

													{canCurate ? (
														<>
															<Button
																size="sm"
																variant={isDismissed ? 'outline' : 'primary'}
																disabled={
																	isBusy || props.reviewStatus === 'confirmed'
																}
																isLoading={isBusy && !isDismissed}
																onClick={() => onConfirmFeature(feature)}
															>
																{isDismissed ? (
																	<>
																		<RotateCcw
																			className="h-3.5 w-3.5"
																			aria-hidden="true"
																		/>
																		Restaurar
																	</>
																) : (
																	<>
																		<Check
																			className="h-3.5 w-3.5"
																			aria-hidden="true"
																		/>
																		Confirmar
																	</>
																)}
															</Button>

															<Button
																size="sm"
																variant="danger"
																disabled={isBusy || isDismissed}
																onClick={() => onOpenDismissModal(feature)}
															>
																<Trash2
																	className="h-3.5 w-3.5"
																	aria-hidden="true"
																/>
																Descartar Ruído
															</Button>
														</>
													) : null}
												</div>
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
	);
}
