'use client';

import { Check, Copy, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { MATCHED_ARTIFACT_LABELS } from '@/lib/integrity/integrityService';
import {
	formatAreaHa,
	formatDateTimePtBr,
	formatScale,
} from '@/lib/utils/formatters';
import type { IntegrityVerifyResponse } from '@/types/api';

export interface IntegrityResultCardProps {
	result: IntegrityVerifyResponse;
}

export function IntegrityResultCard({ result }: IntegrityResultCardProps) {
	const [copied, setCopied] = useState(false);

	async function handleCopySha() {
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(result.sha256);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		} catch {
			// Ignora erro caso clipboard esteja bloqueado no contexto do navegador
		}
	}

	const isAuthentic = result.verified && result.record !== null;

	return (
		<Card className={isAuthentic ? 'border-emerald-300' : 'border-red-300'}>
			<CardHeader
				className={
					isAuthentic
						? 'flex-row flex-wrap items-center justify-between gap-3 space-y-0 bg-emerald-50/70'
						: 'flex-row flex-wrap items-center justify-between gap-3 space-y-0 bg-red-50/70'
				}
			>
				<div className="flex items-start gap-3">
					{isAuthentic ? (
						<ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
					) : (
						<ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
					)}
					<div className="space-y-1">
						<CardTitle className={isAuthentic ? 'text-emerald-950' : 'text-red-950'}>
							{isAuthentic
								? 'DOCUMENTO AUTÊNTICO — INTEGRIDADE CRIPTOGRÁFICA CONFIRMADA'
								: 'NÃO RECONHECIDO OU ADULTERADO — SEM LASTRO NO SICAM'}
						</CardTitle>
						<CardDescription className={isAuthentic ? 'text-emerald-800' : 'text-red-800'}>
							{isAuthentic
								? 'O resumo SHA-256 corresponde exatamente a uma emissão oficial congelada (FROZEN) do sistema.'
								: 'O resumo SHA-256 informado não coincide com nenhum artefato emitido ou sofreu alteração de conteúdo.'}
						</CardDescription>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{isAuthentic ? (
						<Badge variant="success">VERIFICADO — ÍNTEGRO</Badge>
					) : (
						<Badge variant="danger">NÃO RECONHECIDO</Badge>
					)}
					{result.matchedArtifact ? (
						<Badge variant="frozen">{MATCHED_ARTIFACT_LABELS[result.matchedArtifact]}</Badge>
					) : null}
				</div>
			</CardHeader>

			<CardContent className="space-y-5">
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
							Digest SHA-256 Calculado / Consultado
						</p>
						<p className="mt-0.5 break-all font-mono text-xs font-semibold text-slate-900">
							{result.sha256}
						</p>
					</div>

					<Button size="sm" variant="outline" onClick={handleCopySha}>
						{copied ? (
							<>
								<Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
								Copiado
							</>
						) : (
							<>
								<Copy className="h-3.5 w-3.5" aria-hidden="true" />
								Copiar SHA-256
							</>
						)}
					</Button>
				</div>

				{isAuthentic && result.record ? (
					<dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
						<div>
							<dt className="font-semibold text-slate-500">Protocolo Oficial</dt>
							<dd className="mt-0.5 font-mono text-sm font-bold text-brand-900">
								{result.record.protocolCode}
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Título / Caso</dt>
							<dd className="mt-0.5 font-medium text-slate-900">
								{result.record.title}
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Município IBGE &amp; Versão</dt>
							<dd className="mt-0.5 font-medium text-slate-900">
								{result.record.municipality}{' '}
								<Badge variant="frozen" className="ml-1">
									v{result.record.runVersion}
								</Badge>
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Aquisição da Cena T0 (Anterior)</dt>
							<dd className="mt-0.5 font-mono text-slate-800">
								{formatDateTimePtBr(result.record.t0AcquiredAt)} UTC
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Aquisição da Cena T1 (Posterior)</dt>
							<dd className="mt-0.5 font-mono text-slate-800">
								{formatDateTimePtBr(result.record.t1AcquiredAt)} UTC
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Data de Emissão Congelada</dt>
							<dd className="mt-0.5 font-mono text-slate-800">
								{formatDateTimePtBr(result.record.generatedAt)} UTC
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Supressão / Desmatamento Líquido</dt>
							<dd className="mt-0.5 font-semibold text-red-700">
								{formatAreaHa(result.record.deforestationHa)}
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Regeneração Vegetal</dt>
							<dd className="mt-0.5 font-semibold text-emerald-700">
								{formatAreaHa(result.record.regrowthHa)}
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Escala &amp; Formato da Prancha</dt>
							<dd className="mt-0.5 font-mono text-slate-800">
								{formatScale(result.record.cartographicScale)} • {result.record.paperFormat}
							</dd>
						</div>

						<div>
							<dt className="font-semibold text-slate-500">Responsável pela Emissão</dt>
							<dd className="mt-0.5 font-medium text-slate-900">
								{result.record.issuer.fullName} (Matrícula{' '}
								<span className="font-mono">{result.record.issuer.registrationCode}</span>)
							</dd>
						</div>

						<div className="sm:col-span-2">
							<dt className="font-semibold text-slate-500">Identificador de Exportação (UUID)</dt>
							<dd className="mt-0.5 break-all font-mono text-slate-700">
								{result.record.exportId}
							</dd>
						</div>
					</dl>
				) : (
					<div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-xs leading-relaxed text-red-900">
						<p className="font-semibold">Recomendações de custódia pericial:</p>
						<ul className="mt-1 list-disc space-y-1 pl-4">
							<li>
								Qualquer modificação de metadados, regravação em leitor de PDF ou alteração de 1 único byte invalida o hash SHA-256 original.
							</li>
							<li>
								Solicite ao setor emissor o pacote técnico `.zip` íntegro ou consulte novamente o protocolo oficial pela trilha de auditoria.
							</li>
						</ul>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
