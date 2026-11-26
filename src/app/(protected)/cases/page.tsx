'use client';

import { MapPinned } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useSystemCapabilities } from '@/hooks/useSystemCapabilities';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { formatAreaHa } from '@/lib/utils/formatters';

export default function CasesWorkspacePage() {
	const { user } = useAuth();
	const { capabilities, error } = useSystemCapabilities(Boolean(user));

	return (
		<RequireAuth allowedRoles={['analyst', 'auditor', 'admin']}>
			<div className="space-y-6">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-lg font-bold text-slate-900">
							Casos de Análise &amp; Cartas-Imagem
						</h1>
						<p className="text-sm text-slate-600">
							Área protegida para listagem de AOIs, descoberta STAC e acompanhamento de emissões.
						</p>
					</div>
					{user ? (
						<Badge variant="info">
							Perfil ativo: {ROLE_LABELS[user.role]} ({user.registrationCode})
						</Badge>
					) : null}
				</div>

				{error ? <AlertBanner problem={error} /> : null}

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<MapPinned className="h-4 w-4 text-brand-600" aria-hidden="true" />
							Parâmetros Ativos do Ambiente (Zero Trust Capabilities)
						</CardTitle>
						<CardDescription>
							Limites geodésicos e UFs sincronizados diretamente da sicam-api
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 text-xs text-slate-600 sm:grid-cols-3">
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="font-semibold text-slate-800">Faixa Operacional da AOI</p>
							<p className="mt-1 font-mono text-slate-900">
								{capabilities
									? `${formatAreaHa(capabilities.aoi.minAreaHa, 1)} a ${formatAreaHa(capabilities.aoi.maxAreaHa, 0)} (máx. ${capabilities.aoi.maxVertices} vértices)`
									: 'Carregando limites...'}
							</p>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="font-semibold text-slate-800">Concorrência por Analista</p>
							<p className="mt-1 font-mono text-slate-900">
								{capabilities
									? `${capabilities.analysis.maxActiveRunsPerUser} execuções simultâneas · Padrão ${capabilities.export.defaultPaperFormat}`
									: 'Carregando política...'}
							</p>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="font-semibold text-slate-800">UFs Carregadas (IBGE)</p>
							<p className="mt-1 font-mono text-slate-900">
								{capabilities
									? capabilities.aoi.loadedUfs.map((u) => `${u.ufCode} (${u.name})`).join(', ') ||
										'Nenhuma UF carregada'
									: 'Carregando malha...'}
							</p>
						</div>
					</CardContent>
				</Card>

				<AlertBanner
					variant="info"
					title="Módulo Cases / Mapa WebGL previsto na etapa WEB-04"
					message="O roteamento autenticado e os limites dinâmicos já estão conectados ao backend."
				/>
			</div>
		</RequireAuth>
	);
}
