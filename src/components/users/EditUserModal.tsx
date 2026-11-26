'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { updateUser } from '@/lib/users/userService';
import type { OperatorRole, UpdateUserBody, UserAccountItem } from '@/types/api';

export interface EditUserModalProps {
	open: boolean;
	user: UserAccountItem | null;
	currentUserId: string | null;
	onClose: () => void;
	onUpdated: (updated: UserAccountItem) => void;
}

export function EditUserModal({
	open,
	user,
	currentUserId,
	onClose,
	onUpdated,
}: EditUserModalProps) {
	const [fullName, setFullName] = useState('');
	const [role, setRole] = useState<OperatorRole>('analyst');
	const [localError, setLocalError] = useState<string | null>(null);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const isSelf = user !== null && currentUserId === user.id;

	useEffect(() => {
		if (!open || !user) {
			return;
		}
		setFullName(user.fullName);
		setRole(user.role);
		setLocalError(null);
		setProblem(null);
		setIsSubmitting(false);
	}, [open, user]);

	if (!user) {
		return null;
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user) {
			return;
		}

		setLocalError(null);
		setProblem(null);

		const cleanName = fullName.trim();
		if (cleanName.length < 3) {
			setLocalError('Informe o nome completo com pelo menos 3 caracteres.');
			return;
		}

		const patch: UpdateUserBody = {};
		if (cleanName !== user.fullName) {
			patch.fullName = cleanName;
		}
		if (!isSelf && role !== user.role) {
			patch.role = role;
		}

		if (Object.keys(patch).length === 0) {
			onClose();
			return;
		}

		setIsSubmitting(true);
		try {
			const updated = await updateUser(user.id, patch);
			onUpdated(updated);
			onClose();
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setLocalError('Falha ao atualizar os dados do operador.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Editar Dados do Operador"
			description={`Matrícula ${user.registrationCode} • ${user.email}`}
			disableClose={isSubmitting}
			footer={
				<>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button type="submit" form="edit-operator-form" isLoading={isSubmitting}>
						Salvar Alterações
					</Button>
				</>
			}
		>
			<form id="edit-operator-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
				{problem ? <AlertBanner problem={problem} /> : null}
				{localError ? (
					<AlertBanner variant="error" title="Validação" message={localError} />
				) : null}

				<Input
					label="Nome completo"
					value={fullName}
					onChange={(event) => setFullName(event.target.value)}
					disabled={isSubmitting}
					required
				/>

				<Select
					label="Perfil RBAC"
					value={role}
					onChange={(event) => setRole(event.target.value as OperatorRole)}
					disabled={isSubmitting || isSelf}
					hint={
						isSelf
							? 'Não é permitido alterar o próprio perfil administrativo nesta tela.'
							: undefined
					}
				>
					<option value="analyst">Analista</option>
					<option value="auditor">Auditor</option>
					<option value="admin">Administrador</option>
				</Select>
			</form>
		</Modal>
	);
}
