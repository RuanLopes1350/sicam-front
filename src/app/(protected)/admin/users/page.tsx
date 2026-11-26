'use client';

import { Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { ConfirmUserStatusModal } from '@/components/users/ConfirmUserStatusModal';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { UsersFilterBar } from '@/components/users/UsersFilterBar';
import { UsersTable } from '@/components/users/UsersTable';
import { useAuth } from '@/hooks/useAuth';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { listUsers } from '@/lib/users/userService';
import type { OperatorRole, UserAccountItem, UsersListQuery } from '@/types/api';

function AdminUsersContent() {
	const { user: currentOperator } = useAuth();
	const currentUserId = currentOperator?.id ?? null;

	const [users, setUsers] = useState<UserAccountItem[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [roleFilter, setRoleFilter] = useState<OperatorRole | ''>('');
	const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');

	const [isLoading, setIsLoading] = useState(true);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<UserAccountItem | null>(null);
	const [statusModalUser, setStatusModalUser] = useState<UserAccountItem | null>(null);

	const loadUsers = useCallback(async () => {
		setIsLoading(true);
		setProblem(null);
		setGenericError(null);

		const query: UsersListQuery = {};
		if (roleFilter) {
			query.role = roleFilter;
		}
		if (activeFilter) {
			query.active = activeFilter;
		}

		try {
			const response = await listUsers(query);
			setUsers(response.items);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setGenericError('Falha ao carregar a lista de operadores.');
			}
		} finally {
			setIsLoading(false);
		}
	}, [roleFilter, activeFilter]);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const filteredUsers = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) {
			return users;
		}
		return users.filter(
			(item) =>
				item.fullName.toLowerCase().includes(term) ||
				item.registrationCode.toLowerCase().includes(term) ||
				item.email.toLowerCase().includes(term),
		);
	}, [users, searchTerm]);

	function handleCreated(created: UserAccountItem) {
		setSuccessMessage(
			`Operador "${created.fullName}" (matrícula ${created.registrationCode}) cadastrado com sucesso.`,
		);
		void loadUsers();
	}

	function handleUpdated(updated: UserAccountItem) {
		setSuccessMessage(
			updated.active
				? `Cadastro de "${updated.fullName}" atualizado com sucesso.`
				: `Conta de "${updated.fullName}" desativada e sessões ativas revogadas.`,
		);
		void loadUsers();
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
						<Users className="h-5 w-5 text-brand-700" aria-hidden="true" />
						Gestão de Operadores &amp; Perfis RBAC
					</h1>
					<p className="text-sm text-slate-600">
						Cadastro com política de senha forte (mín. 12 caracteres), matrículas únicas e revogação imediata de acessos (RF-02.3 / RF-03).
					</p>
				</div>
			</div>

			{problem ? <AlertBanner problem={problem} /> : null}
			{genericError ? (
				<AlertBanner variant="error" title="Erro ao consultar operadores" message={genericError} />
			) : null}
			{successMessage ? (
				<AlertBanner variant="success" title="Operação registrada" message={successMessage} />
			) : null}

			<UsersFilterBar
				searchTerm={searchTerm}
				onSearchTermChange={setSearchTerm}
				roleFilter={roleFilter}
				onRoleFilterChange={setRoleFilter}
				activeFilter={activeFilter}
				onActiveFilterChange={setActiveFilter}
				isLoading={isLoading}
				onRefresh={() => {
					setSuccessMessage(null);
					void loadUsers();
				}}
				onOpenCreate={() => {
					setSuccessMessage(null);
					setCreateModalOpen(true);
				}}
			/>

			<UsersTable
				users={filteredUsers}
				totalCountBeforeSearch={users.length}
				currentUserId={currentUserId}
				isLoading={isLoading}
				onEdit={(target) => {
					setSuccessMessage(null);
					setEditingUser(target);
				}}
				onToggleStatus={(target) => {
					setSuccessMessage(null);
					setStatusModalUser(target);
				}}
			/>

			<CreateUserModal
				open={createModalOpen}
				onClose={() => setCreateModalOpen(false)}
				onCreated={handleCreated}
			/>

			<EditUserModal
				open={editingUser !== null}
				user={editingUser}
				currentUserId={currentUserId}
				onClose={() => setEditingUser(null)}
				onUpdated={handleUpdated}
			/>

			<ConfirmUserStatusModal
				open={statusModalUser !== null}
				user={statusModalUser}
				onClose={() => setStatusModalUser(null)}
				onUpdated={handleUpdated}
			/>
		</div>
	);
}

export default function AdminUsersPage() {
	return (
		<RequireAuth allowedRoles={['admin']}>
			<AdminUsersContent />
		</RequireAuth>
	);
}
