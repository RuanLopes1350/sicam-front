'use client';

import { useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { updateUser } from '@/lib/users/userService';
import type { UserAccountItem } from '@/types/api';

export interface ConfirmUserStatusModalProps {
	open: boolean;
	user: UserAccountItem | null;
	onClose: () => void;
	onUpdated: (updated: UserAccountItem) => void;
}

export function ConfirmUserStatusModal({
	open,
	user,
	onClose,
	onUpdated,
}: ConfirmUserStatusModalProps) {
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}
		setProblem(null);
		setLocalError(null);
		setIsSubmitting(false);
	}, [open]);

	if (!user) {
		return null;
	}

	const willDeactivate = user.active;

	async function handleConfirm() {
		if (!user) {
			return;
		}
		setProblem(null);
		setLocalError(null);
		setIsSubmitting(true);

		try {
			const updated = await updateUser(user.id, { active: !willDeactivate });
			onUpdated(updated);
			onClose();
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setLocalError('Não foi possível alterar o status da conta.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={willDeactivate ? 'Desativar Conta de Operador' : 'Reativar Conta de Operador'}
			description={`${user.fullName} (${user.registrationCode})`}
			disableClose={isSubmitting}
			footer={
				<>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button
						variant={willDeactivate ? 'danger' : 'primary'}
						onClick={handleConfirm}
						isLoading={isSubmitting}
					>
						{willDeactivate ? 'Confirmar Desativação' : 'Confirmar Reativação'}
					</Button>
				</>
			}
		>
			<div className="space-y-3">
				{problem ? <AlertBanner problem={problem} /> : null}
				{localError ? (
					<AlertBanner variant="error" title="Falha na operação" message={localError} />
				) : null}

				{willDeactivate ? (
					<AlertBanner
						variant="warning"
						title="Revogação imediata de sessões ativas (RF-03)"
						message={`Ao desativar "${user.fullName}", todos os Refresh Tokens e sessões abertas serão revogados imediatamente e novos logins serão bloqueados.`}
					/>
				) : (
					<AlertBanner
						variant="info"
						title="Reabilitação de acesso"
						message={`O operador "${user.fullName}" voltará a poder autenticar no sistema mantendo o histórico de auditoria existente.`}
					/>
				)}
			</div>
		</Modal>
	);
}
