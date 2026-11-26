'use client';

import { RefreshCw, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { OperatorRole } from '@/types/api';

export interface UsersFilterBarProps {
	searchTerm: string;
	onSearchTermChange: (value: string) => void;
	roleFilter: OperatorRole | '';
	onRoleFilterChange: (value: OperatorRole | '') => void;
	activeFilter: '' | 'true' | 'false';
	onActiveFilterChange: (value: '' | 'true' | 'false') => void;
	isLoading: boolean;
	onRefresh: () => void;
	onOpenCreate: () => void;
}

export function UsersFilterBar({
	searchTerm,
	onSearchTermChange,
	roleFilter,
	onRoleFilterChange,
	activeFilter,
	onActiveFilterChange,
	isLoading,
	onRefresh,
	onOpenCreate,
}: UsersFilterBarProps) {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
					<div className="md:col-span-5">
						<Input
							label="Buscar operador"
							placeholder="Nome, matrícula ou e-mail institucional..."
							value={searchTerm}
							onChange={(event) => onSearchTermChange(event.target.value)}
							leftIcon={<Search className="h-4 w-4" />}
						/>
					</div>

					<div className="md:col-span-2">
						<Select
							label="Perfil RBAC"
							value={roleFilter}
							onChange={(event) =>
								onRoleFilterChange(event.target.value as OperatorRole | '')
							}
						>
							<option value="">Todos os perfis</option>
							<option value="analyst">Analista</option>
							<option value="auditor">Auditor</option>
							<option value="admin">Administrador</option>
						</Select>
					</div>

					<div className="md:col-span-2">
						<Select
							label="Status da conta"
							value={activeFilter}
							onChange={(event) =>
								onActiveFilterChange(event.target.value as '' | 'true' | 'false')
							}
						>
							<option value="">Todos</option>
							<option value="true">Somente ativos</option>
							<option value="false">Desativados</option>
						</Select>
					</div>

					<div className="flex flex-wrap items-center gap-2 md:col-span-3 md:justify-end">
						<Button
							variant="outline"
							onClick={onRefresh}
							disabled={isLoading}
							title="Recarregar lista de operadores"
						>
							<RefreshCw
								className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
								aria-hidden="true"
							/>
							Atualizar
						</Button>
						<Button variant="primary" onClick={onOpenCreate}>
							<UserPlus className="h-4 w-4" aria-hidden="true" />
							Novo Operador
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
