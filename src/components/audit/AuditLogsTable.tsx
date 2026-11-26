'use client';

import { ArrowUpToLine, ChevronDown, ChevronRight, History } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AUDIT_ACTION_META } from '@/lib/audit/auditService';
import { formatDateTimePtBr, truncateSha256 } from '@/lib/utils/formatters';
import type { AuditLogItem } from '@/types/api';

export interface AuditLogsTableProps {
	items: readonly AuditLogItem[];
	nextCursorSeqId: number | null;
	hasCursorActive: boolean;
	isLoading: boolean;
	onLoadOlder: (cursorSeqId: number) => void;
	onResetToLatest: () => void;
}

export function AuditLogsTable({
	items,
	nextCursorSeqId,
	hasCursorActive,
	isLoading,
	onLoadOlder,
	onResetToLatest,
}: AuditLogsTableProps) {
	const [expandedSeqId, setExpandedSeqId] = useState<number | null>(null);

	function toggleRow(seqId: number) {
		setExpandedSeqId((prev) => (prev === seqId ? null : seqId));
	}

	return (
		<Card>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
				<div className="space-y-1">
					<CardTitle>Registro Cronológico Imutável (seqId decrescente)</CardTitle>
					<CardDescription>
						Eventos append-only auditáveis via paginação keyset sem desvios por inserções concorrentes.
					</CardDescription>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="neutral">Carregados: {items.length}</Badge>
					{hasCursorActive ? (
						<Button size="sm" variant="outline" onClick={onResetToLatest} disabled={isLoading}>
							<ArrowUpToLine className="h-3.5 w-3.5" aria-hidden="true" />
							Voltar aos mais recentes
						</Button>
					) : null}
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading && items.length === 0 ? (
					<div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
						<Spinner size="md" />
						<span>Consultando trilha de auditoria...</span>
					</div>
				) : items.length === 0 ? (
					<div className="px-6 py-10 text-center text-sm text-slate-500">
						Nenhum evento encontrado para os filtros aplicados.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-left text-sm">
							<thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
								<tr>
									<th scope="col" className="px-4 py-3">
										SeqID
									</th>
									<th scope="col" className="px-4 py-3">
										Ocorrido em (UTC)
									</th>
									<th scope="col" className="px-4 py-3">
										Ação
									</th>
									<th scope="col" className="px-4 py-3">
										Operador
									</th>
									<th scope="col" className="px-4 py-3">
										Entidade
									</th>
									<th scope="col" className="px-4 py-3">
										IP / Correlação
									</th>
									<th scope="col" className="px-4 py-3 text-right">
										Metadados
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{items.map((item) => {
									const actionMeta = AUDIT_ACTION_META[item.action] ?? {
										label: item.action,
										badgeVariant: 'neutral' as const,
									};
									const isExpanded = expandedSeqId === item.seqId;

									return (
										<Fragment key={item.seqId}>
											<tr className="hover:bg-slate-50/70">
												<td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">
													#{item.seqId}
												</td>

												<td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
													{formatDateTimePtBr(item.occurredAt)}
												</td>

												<td className="whitespace-nowrap px-4 py-3">
													<Badge variant={actionMeta.badgeVariant}>{actionMeta.label}</Badge>
												</td>

												<td className="px-4 py-3 text-xs">
													{item.actor ? (
														<div>
															<p className="font-medium text-slate-900">
																{item.actor.fullName}
															</p>
															<p className="font-mono text-slate-500">
																{item.actor.registrationCode}
															</p>
														</div>
													) : (
														<span className="text-slate-400">Sistema / Não autenticado</span>
													)}
												</td>

												<td className="whitespace-nowrap px-4 py-3 text-xs">
													<p className="font-mono font-medium text-slate-800">
														{item.entityType}
													</p>
													<p className="font-mono text-slate-500" title={item.entityId ?? undefined}>
														{item.entityId ? truncateSha256(item.entityId, 8, 6) : '—'}
													</p>
												</td>

												<td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
													<p>{item.ipAddress ?? '—'}</p>
													<p className="text-slate-400" title={item.correlationId}>
														{truncateSha256(item.correlationId, 8, 4)}
													</p>
												</td>

												<td className="whitespace-nowrap px-4 py-3 text-right">
													<Button
														size="sm"
														variant="outline"
														aria-expanded={isExpanded}
														onClick={() => toggleRow(item.seqId)}
													>
														{isExpanded ? (
															<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
														) : (
															<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
														)}
														Detalhes
													</Button>
												</td>
											</tr>

											{isExpanded ? (
												<tr className="bg-slate-50">
													<td colSpan={7} className="px-5 py-4">
														<div className="space-y-3 text-xs">
															<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
																<div>
																	<p className="font-semibold text-slate-500">Código da Ação</p>
																	<p className="font-mono text-slate-900">{item.action}</p>
																</div>
																<div>
																	<p className="font-semibold text-slate-500">Entity ID completo</p>
																	<p className="break-all font-mono text-slate-900">
																		{item.entityId ?? '—'}
																	</p>
																</div>
																<div>
																	<p className="font-semibold text-slate-500">Actor User ID</p>
																	<p className="break-all font-mono text-slate-900">
																		{item.actorUserId ?? '—'}
																	</p>
																</div>
																<div>
																	<p className="font-semibold text-slate-500">Correlation ID</p>
																	<p className="break-all font-mono text-slate-900">
																		{item.correlationId}
																	</p>
																</div>
															</div>

															<div>
																<p className="font-semibold text-slate-500">User-Agent</p>
																<p className="break-all font-mono text-slate-700">
																	{item.userAgent ?? '—'}
																</p>
															</div>

															<div>
																<p className="mb-1 font-semibold text-slate-500">
																	Payload de Metadados (JSON imutável)
																</p>
																<pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-xs text-slate-100">
																	{JSON.stringify(item.metadata, null, 2)}
																</pre>
															</div>
														</div>
													</td>
												</tr>
											) : null}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-600">
					<div>
						{nextCursorSeqId !== null ? (
							<span>
								Próximo cursor keyset: <strong className="font-mono">seqId &lt; {nextCursorSeqId}</strong>
							</span>
						) : items.length > 0 ? (
							<span>Todos os eventos disponíveis para este filtro já foram exibidos.</span>
						) : (
							<span>Aguardando eventos compatíveis.</span>
						)}
					</div>

					<div className="flex items-center gap-2">
						{nextCursorSeqId !== null ? (
							<Button
								size="sm"
								variant="outline"
								isLoading={isLoading}
								onClick={() => onLoadOlder(nextCursorSeqId)}
							>
								<History className="h-3.5 w-3.5" aria-hidden="true" />
								Carregar anteriores
							</Button>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
