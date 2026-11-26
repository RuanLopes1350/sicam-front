'use client';

import { Users } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export default function AdminUsersPage() {
	return (
		<RequireAuth allowedRoles={['admin']}>
			<div className="space-y-6">
				<div>
					<h1 className="text-lg font-bold text-slate-900">Gestão de Operadores &amp; Perfis</h1>
					<p className="text-sm text-slate-600">
						Cadastro, atribuição de perfis e revogação imediata de sessões de operadores.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-4 w-4 text-indigo-600" aria-hidden="true" />
							Acesso Exclusivo de Administrador (RF-02.3 / RF-03)
						</CardTitle>
						<CardDescription>Guard RBAC restrito ao perfil admin</CardDescription>
					</CardHeader>
					<CardContent>
						<AlertBanner
							variant="info"
							title="Painel CRUD de operadores previsto na etapa WEB-03"
							message="Somente usuários com papel Administrador acessam este módulo."
						/>
					</CardContent>
				</Card>
			</div>
		</RequireAuth>
	);
}
