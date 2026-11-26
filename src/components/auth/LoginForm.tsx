'use client';

import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import type { ApiProblemError } from '@/lib/api/problemDetails';
import { isApiProblemError } from '@/lib/api/problemDetails';
import { getDefaultLandingRoute, sanitizeInternalRedirect } from '@/lib/auth/rbac';

export interface LoginFormProps {
	nextPath?: string | null;
	onSuccessRedirect?: (targetPath: string) => void;
}

export function LoginForm({ nextPath, onSuccessRedirect }: LoginFormProps) {
	const { login, sessionExpiredNotice, dismissExpiredNotice } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [validationMessage, setValidationMessage] = useState<string | null>(null);
	const [apiProblem, setApiProblem] = useState<ApiProblemError | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setValidationMessage(null);
		setApiProblem(null);

		const cleanEmail = email.trim().toLowerCase();
		if (!cleanEmail || !cleanEmail.includes('@')) {
			setValidationMessage('Informe um e-mail funcional válido.');
			return;
		}
		if (password.length < 8) {
			setValidationMessage('A senha deve possuir ao menos 8 caracteres.');
			return;
		}

		setIsSubmitting(true);
		try {
			const operator = await login({ email: cleanEmail, password });
			const fallbackRoute = getDefaultLandingRoute(operator.role);
			const destination = sanitizeInternalRedirect(nextPath, fallbackRoute);

			if (onSuccessRedirect) {
				onSuccessRedirect(destination);
			} else if (typeof window !== 'undefined') {
				window.location.assign(destination);
			}
		} catch (err) {
			if (isApiProblemError(err)) {
				setApiProblem(err);
			} else {
				setValidationMessage('Não foi possível concluir a autenticação. Tente novamente.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card className="w-full max-w-md border-slate-200 shadow-md">
			<CardHeader className="space-y-1.5 bg-slate-50/70">
				<div className="flex items-center gap-2">
					<ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
					<CardTitle className="text-base">Acesso Institucional ao SICAM</CardTitle>
				</div>
				<CardDescription>
					Autenticação Zero Trust com Access Token em memória e renovação segura via cookie HttpOnly.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4 pt-5">
				{sessionExpiredNotice ? (
					<AlertBanner
						variant="warning"
						title="Sessão encerrada"
						message={sessionExpiredNotice}
					/>
				) : null}

				{apiProblem ? <AlertBanner problem={apiProblem} /> : null}

				{validationMessage ? (
					<AlertBanner variant="error" title="Dados incompletos" message={validationMessage} />
				) : null}

				<form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
					<Input
						name="email"
						type="email"
						autoComplete="email"
						label="E-mail funcional"
						placeholder="operador@sicam.gov.br"
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							if (sessionExpiredNotice) dismissExpiredNotice();
						}}
						leftIcon={<Mail className="h-4 w-4" />}
						required
					/>

					<Input
						name="password"
						type={showPassword ? 'text' : 'password'}
						autoComplete="current-password"
						label="Senha"
						placeholder="••••••••••••"
						value={password}
						onChange={(e) => {
							setPassword(e.target.value);
							if (sessionExpiredNotice) dismissExpiredNotice();
						}}
						leftIcon={<KeyRound className="h-4 w-4" />}
						rightSlot={
							<button
								type="button"
								onClick={() => setShowPassword((prev) => !prev)}
								aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
								className="rounded p-1 text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
							>
								{showPassword ? (
									<EyeOff className="h-4 w-4" aria-hidden="true" />
								) : (
									<Eye className="h-4 w-4" aria-hidden="true" />
								)}
							</button>
						}
						required
					/>

					<Button
						type="submit"
						variant="primary"
						size="lg"
						isLoading={isSubmitting}
						className="w-full"
					>
						{isSubmitting ? 'Autenticando...' : 'Entrar no Sistema'}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
