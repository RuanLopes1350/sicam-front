'use client';

import { ChevronLeft, ChevronRight, Crosshair, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { CASE_STATUS_META } from '@/lib/cases/caseService';
import { formatAreaHa, formatDateTimePtBr } from '@/lib/utils/formatters';
import type { CaseListItem, CasesListResponse } from '@/types/api';

export interface CasesListTableProps {
	items: readonly CaseListItem[];
	pagination: CasesListResponse['pagination'];
	selectedCaseId: string | null;
	isLoading: boolean;
	onPageChange: (nextPage: number) => void;
	onFocusCase?: (caseItem: CaseListItem) => void;
}

export function CasesListTable({
	items,
	pagination,
	selectedCaseId,
	isLoading,
	onPageChange,
	onFocusCase,
}: CasesListTableProps) {
	return (
		<Card>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
				<div className="space-y-1">
					<CardTitle>Acervo de Casos de Análise Multitemporal</CardTitle>
					<CardDescription>
						Áreas de Interesse (AOIs) protocoladas em SIRGAS 2000 UTM com histórico de execuções versionadas.
					</CardDescription>
				</div>

				<Badge variant="neutral">Total registrado: {pagination.total}</Badge>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading && items.length === 0 ? (
					<div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
						<Spinner size="md" />
						<span>Carregando casos cadastrados...</span>
					</div>
				) : items.length === 0 ? (
					<div className="px-6 py-10 text-center text-sm text-slate-500">
						Nenhum caso de análise encontrado para os critérios selecionados.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-left text-sm">
							<thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
								<tr>
									<th scope="col" className="px-4 py-3">
										Protocolo / Ref.
									</th>
									<th scope="col" className="px-4 py-3">
										Título do Caso
									</th>
									<th scope="col" className="px-4 py-3">
										Município / UF
									</th>
									<th scope="col" className="px-4 py-3">
										Área AOI
									</th>
									<th scope="col" className="px-4 py-3">
										Execuções
									</th>
									<th scope="col" className="px-4 py-3">
										Responsável / Data
									</th>
									<th scope="col" className="px-4 py-3 text-right">
										Ações
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{items.map((item) => {
									const statusKey = item.latestRunStatus ?? 'no_runs';
									const statusMeta = CASE_STATUS_META[statusKey];
									const extraMunCount = Math.max(0, item.intersectedMunicipalities.length - 1);
									const isHighlighted = selectedCaseId === item.id;

									return (
										<tr
											key={item.id}
											className={
												isHighlighted
													? 'bg-brand-50/70'
													: 'hover:bg-slate-50/70'
											}
										>
											<td className="whitespace-nowrap px-4 py-3">
												<p className="font-mono text-xs font-bold text-brand-900">
													{item.protocolCode}
												</p>
												<p className="font-mono text-[11px] text-slate-500">
													{item.externalRef ? `Ref.: ${item.externalRef}` : 'Sem ref. externa'}
												</p>
											</td>

											<td className="max-w-xs px-4 py-3">
												<p className="truncate font-medium text-slate-900" title={item.title}>
													{item.title}
												</p>
												{item.description ? (
													<p
														className="truncate text-xs text-slate-500"
														title={item.description}
													>
														{item.description}
													</p>
												) : null}
											</td>

											<td className="whitespace-nowrap px-4 py-3 text-xs">
												{item.primaryMunicipality ? (
													<div className="flex items-center gap-1.5">
														<span className="font-medium text-slate-800">
															{item.primaryMunicipality.name} - {item.primaryMunicipality.ufCode}
														</span>
														{extraMunCount > 0 ? (
															<Badge variant="neutral">+{extraMunCount}</Badge>
														) : null}
													</div>
												) : (
													<span className="text-slate-500">{item.stateUf ?? '—'}</span>
												)}
												<p className="font-mono text-[11px] text-slate-400">
													EPSG:{item.utmSrid}
												</p>
											</td>

											<td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">
												{formatAreaHa(item.aoiAreaHa)}
											</td>

											<td className="whitespace-nowrap px-4 py-3 text-xs">
												<div className="flex flex-col items-start gap-1">
													<Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
													<span className="font-mono text-[11px] text-slate-500">
														{item.runsCount} {item.runsCount === 1 ? 'versão' : 'versões'}
													</span>
												</div>
											</td>

											<td className="whitespace-nowrap px-4 py-3 text-xs">
												<p className="font-medium text-slate-800">
													{item.createdBy.fullName}
												</p>
												<p className="font-mono text-[11px] text-slate-500">
													{item.createdBy.registrationCode} • {formatDateTimePtBr(item.createdAt)}
												</p>
											</td>

											<td className="whitespace-nowrap px-4 py-3 text-right">
												<div className="inline-flex items-center gap-1.5">
													{onFocusCase ? (
														<Button
															size="sm"
															variant="ghost"
															title="Enquadrar AOI no mapa lateral"
															onClick={() => onFocusCase(item)}
														>
															<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
															Mapa
														</Button>
													) : null}

													<Link
														href={`/cases/${item.id}`}
														className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50"
													>
														Abrir
														<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
													</Link>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-600">
					<span>
						Página <strong>{pagination.page}</strong> de{' '}
						<strong>{Math.max(1, pagination.totalPages)}</strong>
					</span>

					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={isLoading || pagination.page <= 1}
							onClick={() => onPageChange(pagination.page - 1)}
						>
							<ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
							Anterior
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={isLoading || pagination.page >= pagination.totalPages}
							onClick={() => onPageChange(pagination.page + 1)}
						>
							Próxima
							<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
