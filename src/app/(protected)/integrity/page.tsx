'use client';

import { FileCheck2 } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export default function IntegrityPage() {
	return (
		<RequireAuth allowedRoles={['analyst', 'auditor', 'admin']}>
			<div className="space-y-6">
				<div>
					<h1 className="text-lg font-bold text-slate-900">
						Verificação de Integridade SHA-256
					</h1>
					<p className="text-sm text-slate-600">
						Validação oficial de autenticidade para Cartas-Imagem PDF e Pacotes Técnicos .zip.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileCheck2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
							Rota Protegida Ativa (RF-32)
						</CardTitle>
						<CardDescription>Acessível a Analistas, Auditores e Administradores</CardDescription>
					</CardHeader>
					<CardContent>
						<AlertBanner
							variant="info"
							title="Interface de verificação SHA-256 e upload prevista na etapa WEB-03"
							message="O endpoint POST /api/v1/integrity/verify já está tipado no cliente OpenAPI 3.1."
						/>
					</CardContent>
				</Card>
			</div>
		</RequireAuth>
	);
}
