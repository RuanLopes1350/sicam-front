import { ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { getDefaultLandingRoute, ROLE_LABELS } from '@/lib/auth/rbac';
import type { OperatorRole } from '@/types/api';

export interface ForbiddenRoleViewProps {
	userRole: OperatorRole;
	requiredRoles: readonly OperatorRole[];
	userName?: string;
}

export function ForbiddenRoleView({
	userRole,
	requiredRoles,
	userName,
}: ForbiddenRoleViewProps) {
	const fallbackHref = getDefaultLandingRoute(userRole);
	const allowedLabel =
		requiredRoles.length > 0
			? requiredRoles.map((role) => ROLE_LABELS[role]).join(', ')
			: 'Perfil autorizado';

	return (
		<div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
			<Card className="border-red-200">
				<CardHeader className="bg-red-50/70">
					<div className="flex items-center justify-between gap-3">
						<CardTitle className="flex items-center gap-2 text-red-900">
							<ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
							Acesso Restrito por Perfil RBAC (403)
						</CardTitle>
						<Badge variant="danger">ERR_FORBIDDEN_ROLE</Badge>
					</div>
					<CardDescription className="text-red-800/80">
						Segregação de funções ativa (RF-02)
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4 text-sm text-slate-700">
					<p>
						{userName ? (
							<>
								O operador <span className="font-semibold text-slate-900">{userName}</span>{' '}
							</>
						) : (
							'Seu operador '
						)}
						possui perfil{' '}
						<span className="font-semibold text-slate-900">{ROLE_LABELS[userRole]}</span> e não tem
						permissão para acessar este módulo.
					</p>

					<div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
						Perfis autorizados nesta rota:{' '}
						<span className="font-semibold text-slate-900">{allowedLabel}</span>
					</div>

					<div>
						<Link
							href={fallbackHref}
							className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
						>
							<ArrowLeft className="h-4 w-4" aria-hidden="true" />
							Voltar ao painel permitido
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
