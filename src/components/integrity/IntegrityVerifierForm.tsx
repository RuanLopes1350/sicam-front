'use client';

import { FileUp, Hash, SearchCheck, UploadCloud } from 'lucide-react';
import { type DragEvent, type FormEvent, useId, useRef, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
	isValidSha256Hex,
	MAX_INTEGRITY_UPLOAD_BYTES,
} from '@/lib/integrity/integrityService';
import { cn } from '@/lib/utils/cn';
import { formatBytesPtBr } from '@/lib/utils/formatters';

export type VerificationMode = 'file' | 'hash';

export interface IntegrityVerifierFormProps {
	isVerifying: boolean;
	onVerifyFile: (file: File) => void;
	onVerifyHash: (sha256: string) => void;
}

export function IntegrityVerifierForm({
	isVerifying,
	onVerifyFile,
	onVerifyHash,
}: IntegrityVerifierFormProps) {
	const [mode, setMode] = useState<VerificationMode>('file');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [sha256Input, setSha256Input] = useState('');
	const [isDragOver, setIsDragOver] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const normalizedHash = sha256Input.trim().toLowerCase();

	function handleSelectCandidateFile(candidate: File | null) {
		setLocalError(null);
		if (!candidate) {
			return;
		}
		const lower = candidate.name.trim().toLowerCase();
		if (!lower.endsWith('.pdf') && !lower.endsWith('.zip')) {
			setLocalError('Selecione apenas arquivos oficiais no formato .pdf ou .zip.');
			setSelectedFile(null);
			return;
		}
		if (candidate.size <= 0) {
			setLocalError('O arquivo selecionado possui 0 bytes e não pode ser verificado.');
			setSelectedFile(null);
			return;
		}
		if (candidate.size > MAX_INTEGRITY_UPLOAD_BYTES) {
			setLocalError('O arquivo excede o limite máximo de 100 MB.');
			setSelectedFile(null);
			return;
		}
		setSelectedFile(candidate);
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setIsDragOver(false);
		const dropped = event.dataTransfer.files?.[0] ?? null;
		handleSelectCandidateFile(dropped);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLocalError(null);

		if (mode === 'file') {
			if (!selectedFile) {
				setLocalError('Anexe um arquivo Carta-Imagem .pdf ou Pacote Técnico .zip para verificar.');
				return;
			}
			onVerifyFile(selectedFile);
			return;
		}

		if (!isValidSha256Hex(normalizedHash)) {
			setLocalError(
				'Informe um código SHA-256 válido com exatamente 64 caracteres hexadecimais (0-9 e a-f).',
			);
			return;
		}

		onVerifyHash(normalizedHash);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Submissão para Verificação Criptográfica (RF-32)</CardTitle>
				<CardDescription>
					Envie o arquivo binário original para cálculo de SHA-256 em streaming ou consulte o código hexadecimal de 64 caracteres.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
					<button
						type="button"
						onClick={() => {
							setMode('file');
							setLocalError(null);
						}}
						className={cn(
							'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
							mode === 'file'
								? 'bg-white text-brand-900 shadow-sm'
								: 'text-slate-600 hover:text-slate-900',
						)}
					>
						<FileUp className="h-3.5 w-3.5" aria-hidden="true" />
						Upload de Arquivo (.pdf / .zip)
					</button>

					<button
						type="button"
						onClick={() => {
							setMode('hash');
							setLocalError(null);
						}}
						className={cn(
							'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
							mode === 'hash'
								? 'bg-white text-brand-900 shadow-sm'
								: 'text-slate-600 hover:text-slate-900',
						)}
					>
						<Hash className="h-3.5 w-3.5" aria-hidden="true" />
						Consultar Hash SHA-256
					</button>
				</div>

				{localError ? (
					<AlertBanner variant="error" title="Entrada inválida" message={localError} />
				) : null}

				<form onSubmit={handleSubmit} className="space-y-4" noValidate>
					{mode === 'file' ? (
						<div className="space-y-3">
							<input
								ref={fileInputRef}
								id={fileInputId}
								type="file"
								accept=".pdf,.zip,application/pdf,application/zip"
								className="sr-only"
								onChange={(event) =>
									handleSelectCandidateFile(event.target.files?.[0] ?? null)
								}
								disabled={isVerifying}
							/>

							<div
								onDragOver={(event) => {
									event.preventDefault();
									if (!isVerifying) {
										setIsDragOver(true);
									}
								}}
								onDragLeave={() => setIsDragOver(false)}
								onDrop={handleDrop}
								className={cn(
									'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
									isDragOver
										? 'border-brand-500 bg-brand-50/60'
										: 'border-slate-300 bg-slate-50/70 hover:border-slate-400',
								)}
							>
								<UploadCloud className="mb-2 h-8 w-8 text-brand-600" aria-hidden="true" />
								<p className="text-sm font-semibold text-slate-800">
									Arraste aqui a Carta-Imagem (.pdf) ou Pacote Técnico (.zip)
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Tamanho máximo suportado: 100 MB. O digest SHA-256 é calculado em streaming no servidor.
								</p>
								<div className="mt-4">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={isVerifying}
										onClick={() => fileInputRef.current?.click()}
									>
										Selecionar Arquivo do Computador
									</Button>
								</div>
							</div>

							{selectedFile ? (
								<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs">
									<div>
										<span className="font-semibold text-slate-900">
											{selectedFile.name}
										</span>{' '}
										<span className="font-mono text-slate-500">
											({formatBytesPtBr(selectedFile.size)})
										</span>
									</div>
									<button
										type="button"
										disabled={isVerifying}
										onClick={() => {
											setSelectedFile(null);
											if (fileInputRef.current) {
												fileInputRef.current.value = '';
											}
										}}
										className="font-medium text-red-600 hover:underline disabled:opacity-50"
									>
										Remover arquivo
									</button>
								</div>
							) : null}
						</div>
					) : (
						<Input
							label="Código Hash SHA-256 (64 caracteres hexadecimais)"
							placeholder="Ex.: a3f8c2e1..."
							value={sha256Input}
							onChange={(event) => {
								setSha256Input(event.target.value);
								setLocalError(null);
							}}
							leftIcon={<Hash className="h-4 w-4" />}
							hint={`Comprimento atual: ${normalizedHash.length}/64 caracteres hexadecimais`}
							className="font-mono text-xs"
							disabled={isVerifying}
							required
						/>
					)}

					<div className="flex items-center justify-end">
						<Button type="submit" variant="primary" isLoading={isVerifying}>
							<SearchCheck className="h-4 w-4" aria-hidden="true" />
							{mode === 'file' ? 'Verificar Arquivo Oficial' : 'Consultar Hash SHA-256'}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
