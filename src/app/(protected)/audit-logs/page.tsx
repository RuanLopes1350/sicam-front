'use client';

import { ScrollText } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export default function AuditLogsPage() {
	return (
		<RequireAuth allowedRoles={['admin', 'auditor']}>
			<div className="space-y-6">
				<div>
					<h1 className="text-lg font-bold text-slate-900">Trilha de Auditoria Append-Only</h1>
					<p className="text-sm text-slate-600">
						Consulta imutável de eventos críticos com paginação cursorizada por seqId.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ScrollText className="h-4 w-4 text-amber-600" aria-hidden="true" />
							Acesso Exclusivo a Admin e Auditor (RF-31)
						</CardTitle>
						<CardDescription>Guard RBAC aplicado nesta rota</CardDescription>
					</CardHeader>
					<CardContent>
						<AlertBanner
							variant="info"
							title="Tabela de auditoria e filtros prevista na etapa WEB-03"
							message="Analistas são bloqueados automaticamente pelo guard RBAC e pela API."
						/>
					</CardContent>
				</Card>
			</div>
		</RequireAuth>
	);
}
