'use client';

import { Activity, Database, FileCode2, Lock, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/Card';
import { clientEnv } from '@/config/env';

type HealthStatus = 'checking' | 'online' | 'offline';

export function ArchitectureReadinessPanel() {
	const [health, setHealth] = useState<HealthStatus>('checking');
	const [checkedAt, setCheckedAt] = useState<string | null>(null);

	const checkApiConnectivity = useCallback(async () => {
		setHealth('checking');
		try {
			const baseUrl = clientEnv.API_BASE_URL;
			const response = await fetch(`${baseUrl}/api/v1/health/live`, {
				credentials: 'include',
				signal: AbortSignal.timeout(4000),
			});
			setHealth(response.ok ? 'online' : 'offline');
		} catch {
			setHealth('offline');
		} finally {
			setCheckedAt(new Date().toLocaleTimeString('pt-BR'));
		}
	}, []);

	useEffect(() => {
		void checkApiConnectivity();
	}, [checkApiConnectivity]);

	return (
		<section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-xl font-bold tracking-tight text-slate-900">
						SICAM Web — Infraestrutura Polyrepo Inicializada
					</h1>
					<p className="mt-1 text-sm text-slate-600">
						Repositório frontend independente em Next.js App Router (Standalone), acoplado ao
						backend <span className="font-mono font-medium">sicam-api</span> exclusivamente pelo
						contrato OpenAPI 3.1.
					</p>
				</div>

				<div className="flex items-center gap-2">
					{health === 'checking' ? (
						<Badge variant="neutral">Verificando API...</Badge>
					) : health === 'online' ? (
						<Badge variant="success">API Online</Badge>
					) : (
						<Badge variant="warning">API Offline (Local/Staging)</Badge>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => void checkApiConnectivity()}
						isLoading={health === 'checking'}
					>
						<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
						Testar Conexão
					</Button>
				</div>
			</div>

			<AlertBanner
				variant="info"
				title="Escopo WEB-01 Concluído — Base Tipada Pronta para Autenticação (WEB-02)"
				message={`Destino configurado para chamadas OpenAPI/SSE: ${clientEnv.API_BASE_URL || 'Mesma origem (Traefik v3)'}${checkedAt ? ` · Última verificação: ${checkedAt}` : ''}.`}
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileCode2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
							Contrato OpenAPI 3.1
						</CardTitle>
						<CardDescription>Geração estática em tempo de build</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-xs text-slate-600">
						<p>
							Script <span className="font-mono text-slate-900">pnpm api:sync</span> sincroniza{' '}
							<span className="font-mono text-slate-900">openapi.v1.json</span> e gera tipos
							estritos via <span className="font-mono text-slate-900">openapi-typescript</span>.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Lock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
							Sessão Zero Trust
						</CardTitle>
						<CardDescription>Access Token em memória RAM</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-xs text-slate-600">
						<p>
							Zero uso de <span className="font-mono text-slate-900">localStorage</span>. Renovação
							silenciosa via cookie <span className="font-mono text-slate-900">HttpOnly</span> com
							bloqueio single-flight contra reuso concorrente.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Database className="h-4 w-4 text-amber-600" aria-hidden="true" />
							Referencial Geodésico
						</CardTitle>
						<CardDescription>Autoridade exclusiva no PostGIS</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-xs text-slate-600">
						<p>
							Armazenamento em SIRGAS 2000 (<span className="font-mono text-slate-900">EPSG:4674</span>
							) com cálculo oficial em fuso UTM dinâmico e pacotes auditáveis SHA-256.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-4 w-4 text-indigo-600" aria-hidden="true" />
							Deploy Standalone
						</CardTitle>
						<CardDescription>Porta 5173 · Traefik v3 Ready</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-xs text-slate-600">
						<p>
							Empacotamento otimizado multi-stage via{' '}
							<span className="font-mono text-slate-900">output: &apos;standalone&apos;</span> sem
							expor rotas internas no edge proxy.
						</p>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
