'use client';

import { Eye, EyeOff, KeyRound, Mail, Shield, UserCheck } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { createUser } from '@/lib/users/userService';
import type { OperatorRole, UserAccountItem } from '@/types/api';

export interface CreateUserModalProps {
	open: boolean;
	onClose: () => void;
	onCreated: (created: UserAccountItem) => void;
}

const MIN_PASSWORD_LENGTH = 12;

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
	const [fullName, setFullName] = useState('');
	const [registrationCode, setRegistrationCode] = useState('');
	const [email, setEmail] = useState('');
	const [role, setRole] = useState<OperatorRole>('analyst');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}
		setFullName('');
		setRegistrationCode('');
		setEmail('');
		setRole('analyst');
		setPassword('');
		setShowPassword(false);
		setLocalError(null);
		setProblem(null);
		setIsSubmitting(false);
	}, [open]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLocalError(null);
		setProblem(null);

		const cleanName = fullName.trim();
		const cleanRegCode = registrationCode.trim();
		const cleanEmail = email.trim().toLowerCase();

		if (cleanName.length < 3) {
			setLocalError('Informe o nome completo com pelo menos 3 caracteres.');
			return;
		}
		if (cleanRegCode.length < 2) {
			setLocalError('Informe a matrícula funcional com pelo menos 2 caracteres.');
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
			setLocalError('Informe um e-mail institucional válido.');
			return;
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			setLocalError(
				`A política de segurança exige senha com no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
			);
			return;
		}

		setIsSubmitting(true);
		try {
			const created = await createUser({
				fullName: cleanName,
				registrationCode: cleanRegCode,
				email: cleanEmail,
				password,
				role,
			});
			onCreated(created);
			onClose();
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setLocalError('Não foi possível cadastrar o operador. Tente novamente.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Cadastrar Novo Operador"
			description="A matrícula e o e-mail devem ser únicos; a senha será armazenada com hash Argon2id."
			disableClose={isSubmitting}
			footer={
				<>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button type="submit" form="create-operator-form" isLoading={isSubmitting}>
						Cadastrar Operador
					</Button>
				</>
			}
		>
			<form id="create-operator-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
				{problem ? <AlertBanner problem={problem} /> : null}
				{localError ? (
					<AlertBanner variant="error" title="Validação de Cadastro" message={localError} />
				) : null}

				<Input
					label="Nome completo"
					placeholder="Ex.: Maria Clara Silva"
					value={fullName}
					onChange={(event) => setFullName(event.target.value)}
					leftIcon={<UserCheck className="h-4 w-4" />}
					disabled={isSubmitting}
					required
				/>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<Input
						label="Matrícula funcional"
						placeholder="Ex.: ANA-2048"
						value={registrationCode}
						onChange={(event) => setRegistrationCode(event.target.value)}
						hint="Mín. 2 caracteres (exibida em cartas-imagem e logs)"
						disabled={isSubmitting}
						required
					/>

					<Select
						label="Perfil RBAC"
						value={role}
						onChange={(event) => setRole(event.target.value as OperatorRole)}
						disabled={isSubmitting}
					>
						<option value="analyst">Analista (Casos, Análises e Cartas)</option>
						<option value="auditor">Auditor (Leitura, Auditoria e Integridade)</option>
						<option value="admin">Administrador (Gestão de Contas e Auditoria)</option>
					</Select>
				</div>

				<Input
					label="E-mail funcional"
					type="email"
					placeholder="operador@orgao.gov.br"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					leftIcon={<Mail className="h-4 w-4" />}
					disabled={isSubmitting}
					required
				/>

				<Input
					label="Senha inicial provisória"
					type={showPassword ? 'text' : 'password'}
					placeholder="Mínimo 12 caracteres"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					leftIcon={<KeyRound className="h-4 w-4" />}
					hint={`Comprimento atual: ${password.length}/${MIN_PASSWORD_LENGTH} caracteres mínimos`}
					rightSlot={
						<button
							type="button"
							onClick={() => setShowPassword((prev) => !prev)}
							aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
							className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
						>
							{showPassword ? (
								<EyeOff className="h-4 w-4" aria-hidden="true" />
							) : (
								<Eye className="h-4 w-4" aria-hidden="true" />
							)}
						</button>
					}
					disabled={isSubmitting}
					required
				/>

				<div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
					<Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
					<span>
						O cadastro será registrado na trilha de auditoria com sua identificação administrativa.
					</span>
				</div>
			</form>
		</Modal>
	);
}
