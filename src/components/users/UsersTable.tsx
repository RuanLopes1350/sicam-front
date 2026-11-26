'use client';

import { Edit3, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ROLE_BADGE_VARIANTS, ROLE_LABELS } from '@/lib/auth/rbac';
import { formatDateTimePtBr } from '@/lib/utils/formatters';
import type { UserAccountItem } from '@/types/api';

export interface UsersTableProps {
	users: readonly UserAccountItem[];
	totalCountBeforeSearch: number;
	currentUserId: string | null;
	isLoading: boolean;
	onEdit: (user: UserAccountItem) => void;
	onToggleStatus: (user: UserAccountItem) => void;
}

export function UsersTable({
	users,
	totalCountBeforeSearch,
	currentUserId,
	isLoading,
	onEdit,
	onToggleStatus,
}: UsersTableProps) {
	const activeCount = users.filter((user) => user.active).length;
	const inactiveCount = users.length - activeCount;

	return (
		<Card>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
				<div className="space-y-1">
					<CardTitle>Contas de Operadores Cadastradas</CardTitle>
					<CardDescription>
						Controle RBAC estrito e revogação imediata de sessões ao desativar um acesso (RF-03).
					</CardDescription>
				</div>

				<div className="flex flex-wrap items-center gap-2 text-xs">
					<Badge variant="neutral">
						Exibindo {users.length} de {totalCountBeforeSearch}
					</Badge>
					<Badge variant="success">Ativos: {activeCount}</Badge>
					<Badge variant={inactiveCount > 0 ? 'danger' : 'neutral'}>
						Desativados: {inactiveCount}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading && users.length === 0 ? (
					<div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
						<Spinner size="md" />
						<span>Carregando lista de operadores...</span>
					</div>
				) : users.length === 0 ? (
					<div className="px-6 py-10 text-center text-sm text-slate-500">
						Nenhum operador encontrado para os filtros informados.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-left text-sm">
							<thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
								<tr>
									<th scope="col" className="px-4 py-3">
										Operador
									</th>
									<th scope="col" className="px-4 py-3">
										Matrícula
									</th>
									<th scope="col" className="px-4 py-3">
										Perfil RBAC
									</th>
									<th scope="col" className="px-4 py-3">
										Status
									</th>
									<th scope="col" className="px-4 py-3">
										Último Acesso (UTC)
									</th>
									<th scope="col" className="px-4 py-3 text-right">
										Ações
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{users.map((user) => {
									const isSelf = currentUserId !== null && user.id === currentUserId;
									const disableDeactivateSelf = isSelf && user.active;

									return (
										<tr
											key={user.id}
											className={!user.active ? 'bg-slate-50/70 text-slate-500' : 'hover:bg-slate-50/60'}
										>
											<td className="px-4 py-3">
												<div className="flex flex-wrap items-center gap-2">
													<span className="font-medium text-slate-900">
														{user.fullName}
													</span>
													{isSelf ? <Badge variant="info">Sua conta</Badge> : null}
												</div>
												<div className="text-xs text-slate-500">{user.email}</div>
											</td>

											<td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-700">
												{user.registrationCode}
											</td>

											<td className="whitespace-nowrap px-4 py-3">
												<Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
													{ROLE_LABELS[user.role]}
												</Badge>
											</td>

											<td className="whitespace-nowrap px-4 py-3">
												{user.active ? (
													<Badge variant="success">Ativo</Badge>
												) : (
													<Badge variant="danger">Desativado</Badge>
												)}
											</td>

											<td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
												{user.lastLoginAt ? formatDateTimePtBr(user.lastLoginAt) : 'Nunca acessou'}
											</td>

											<td className="whitespace-nowrap px-4 py-3 text-right">
												<div className="inline-flex items-center gap-2">
													<Button
														size="sm"
														variant="outline"
														onClick={() => onEdit(user)}
													>
														<Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
														Editar
													</Button>

													<Button
														size="sm"
														variant={user.active ? 'danger' : 'outline'}
														disabled={disableDeactivateSelf}
														title={
															disableDeactivateSelf
																? 'Por segurança, você não pode desativar a própria conta ativa.'
																: undefined
														}
														onClick={() => onToggleStatus(user)}
													>
														{disableDeactivateSelf ? (
															<ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
														) : user.active ? (
															<UserX className="h-3.5 w-3.5" aria-hidden="true" />
														) : (
															<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
														)}
														{user.active ? 'Desativar' : 'Reativar'}
													</Button>
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
