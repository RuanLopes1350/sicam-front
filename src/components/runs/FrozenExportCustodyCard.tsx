'use client';

import {
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Download,
	FileArchive,
	FileText,
	Lock,
	RefreshCw,
	ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import {
	downloadExportArtifact,
	getRunExportMetadata,
	triggerBrowserBlobDownload,
} from '@/lib/exports/exportService';
import {
	formatBytesPtBr,
	formatDateTimePtBr,
	formatScale,
} from '@/lib/utils/formatters';
import type { ExportArtifactType, ExportMetadataResponse } from '@/types/api';

export interface FrozenExportCustodyCardProps {
	runId: string;
	initialMetadata?: ExportMetadataResponse | null;
}

export function FrozenExportCustodyCard({
	runId,
	initialMetadata,
}: FrozenExportCustodyCardProps) {
	const [metadata, setMetadata] = useState<ExportMetadataResponse | null>(
		initialMetadata ?? null,
	);
	const [isLoading, setIsLoading] = useState<boolean>(initialMetadata === undefined);
	const [loadProblem, setLoadProblem] = useState<ApiProblemError | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [downloadingArtifact, setDownloadingArtifact] = useState<ExportArtifactType | null>(null);
	const [downloadProblem, setDownloadProblem] = useState<ApiProblemError | null>(null);
	const [downloadError, setDownloadError] = useState<string | null>(null);
	const [copiedKind, setCopiedKind] = useState<'pdf' | 'zip' | null>(null);
	const [manifestOpen, setManifestOpen] = useState(false);

	const loadMetadata = useCallback(async () => {
		setIsLoading(true);
		setLoadProblem(null);
		setLoadError(null);
		try {
			const res = await getRunExportMetadata(runId);
			setMetadata(res);
		} catch (err) {
			if (isApiProblemError(err)) {
				setLoadProblem(err);
			} else {
				setLoadError('Não foi possível consultar os metadados do pacote congelado.');
			}
		} finally {
			setIsLoading(false);
		}
	}, [runId]);

	useEffect(() => {
		if (initialMetadata !== undefined) {
			return;
		}
		void loadMetadata();
	}, [initialMetadata, loadMetadata]);

	async function handleCopySha(kind: 'pdf' | 'zip', sha256: string) {
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(sha256);
				setCopiedKind(kind);
				setTimeout(() => setCopiedKind(null), 2000);
			}
		} catch {
			// Ignora caso clipboard esteja indisponível
		}
	}

	async function handleDownload(artifact: ExportArtifactType) {
		if (!metadata) return;
		setDownloadingArtifact(artifact);
		setDownloadProblem(null);
		setDownloadError(null);

		try {
			const downloaded = await downloadExportArtifact(metadata.exportId, artifact, {
				protocolCode: metadata.protocolCode,
				runVersion: metadata.runVersion,
			});
			triggerBrowserBlobDownload(downloaded.blob, downloaded.fileName);
		} catch (err) {
			if (isApiProblemError(err)) {
				setDownloadProblem(err);
			} else {
				setDownloadError(
					'Não foi possível concluir o download autenticado do artefato oficial.',
				);
			}
		} finally {
			setDownloadingArtifact(null);
		}
	}

	if (isLoading) {
		return (
			<Card className="border-indigo-300">
				<CardContent className="flex items-center justify-center gap-2 py-8 text-xs text-slate-600">
					<Spinner size="sm" />
					<span>Carregando selo FROZEN e manifesto criptográfico...</span>
				</CardContent>
			</Card>
		);
	}

	if (loadProblem || loadError || !metadata) {
		return (
			<Card className="border-indigo-300">
				<CardContent className="space-y-3 p-5">
					{loadProblem ? <AlertBanner problem={loadProblem} /> : null}
					{loadError ? (
						<AlertBanner variant="error" title="Metadados indisponíveis" message={loadError} />
					) : null}
					<div>
						<Button size="sm" variant="outline" onClick={() => void loadMetadata()}>
							<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
							Tentar novamente
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-indigo-300">
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 bg-indigo-50/70">
				<div className="flex items-start gap-3">
					<Lock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
					<div className="space-y-1">
						<CardTitle className="text-indigo-950">
							SELO FROZEN — Custódia Criptográfica &amp; Artefatos Oficiais
						</CardTitle>
						<CardDescription className="text-indigo-900/80">
							Protocolo {metadata.protocolCode} (v{metadata.runVersion}) · Emitido em{' '}
							{formatDateTimePtBr(metadata.generatedAt)} UTC por {metadata.issuer.fullName} (
							{metadata.issuer.registrationCode})
						</CardDescription>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="frozen">FROZEN · IMUTÁVEL</Badge>
					<Badge variant="neutral">
						{formatScale(metadata.cartographicScale)} · {metadata.paperFormat} 300 DPI
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{downloadProblem ? <AlertBanner problem={downloadProblem} /> : null}
				{downloadError ? (
					<AlertBanner variant="error" title="Falha no download" message={downloadError} />
				) : null}

				{metadata.observations ? (
					<div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
						<span className="font-semibold text-slate-700">
							Observações registradas na prancha:{' '}
						</span>
						<span className="text-slate-600">{metadata.observations}</span>
					</div>
				) : null}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
									<FileText className="h-4 w-4 text-red-600" aria-hidden="true" />
									<span>Carta-Imagem Oficial (.PDF)</span>
								</div>
								<Badge variant="neutral">{formatBytesPtBr(metadata.pdfSizeBytes)}</Badge>
							</div>

							<div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
								<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
									SHA-256 oficial (PDF)
								</p>
								<p className="mt-0.5 break-all font-mono text-[11px] font-semibold text-slate-900">
									{metadata.pdfSha256}
								</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
							<Button
								size="sm"
								variant="outline"
								onClick={() => void handleCopySha('pdf', metadata.pdfSha256)}
							>
								{copiedKind === 'pdf' ? (
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

							<Button
								size="sm"
								variant="primary"
								isLoading={downloadingArtifact === 'pdf'}
								disabled={downloadingArtifact !== null}
								onClick={() => void handleDownload('pdf')}
							>
								<Download className="h-3.5 w-3.5" aria-hidden="true" />
								Baixar Carta-Imagem (.PDF)
							</Button>
						</div>
					</div>

					<div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
									<FileArchive className="h-4 w-4 text-brand-700" aria-hidden="true" />
									<span>Pacote Técnico Pericial (.ZIP)</span>
								</div>
								<Badge variant="neutral">{formatBytesPtBr(metadata.zipSizeBytes)}</Badge>
							</div>

							<div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
								<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
									SHA-256 oficial (ZIP)
								</p>
								<p className="mt-0.5 break-all font-mono text-[11px] font-semibold text-slate-900">
									{metadata.zipSha256}
								</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
							<Button
								size="sm"
								variant="outline"
								onClick={() => void handleCopySha('zip', metadata.zipSha256)}
							>
								{copiedKind === 'zip' ? (
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

							<Button
								size="sm"
								variant="secondary"
								isLoading={downloadingArtifact === 'zip'}
								disabled={downloadingArtifact !== null}
								onClick={() => void handleDownload('zip')}
							>
								<Download className="h-3.5 w-3.5" aria-hidden="true" />
								Baixar Pacote Técnico (.ZIP)
							</Button>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
					<button
						type="button"
						onClick={() => setManifestOpen((prev) => !prev)}
						aria-expanded={manifestOpen}
						className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-brand-700"
					>
						{manifestOpen ? (
							<ChevronDown className="h-4 w-4" aria-hidden="true" />
						) : (
							<ChevronRight className="h-4 w-4" aria-hidden="true" />
						)}
						Inspecionar Manifesto de Auditoria (05_manifesto_auditoria.json)
					</button>

					<Link
						href="/integrity"
						className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline"
					>
						<ShieldCheck className="h-4 w-4" aria-hidden="true" />
						Conferir no Verificador de Integridade SHA-256
					</Link>
				</div>

				{manifestOpen ? (
					<pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100">
						{JSON.stringify(metadata.auditManifest, null, 2)}
					</pre>
				) : null}
			</CardContent>
		</Card>
	);
}
