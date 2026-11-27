'use client';

import { FileOutput, KeyRound, Lock } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import {
	MAX_EXPORT_OBSERVATIONS_LENGTH,
	PAPER_FORMAT_LABELS,
	requestRunExport,
} from '@/lib/exports/exportService';
import { generateIdempotencyKey } from '@/lib/runs/runService';
import { deriveExportIdempotencyFingerprint } from '@/lib/runs/runStages';
import { cn } from '@/lib/utils/cn';
import type { PaperFormat } from '@/types/api';

export interface RequestExportModalProps {
	open: boolean;
	runId: string;
	runVersion: number;
	activeFeatureCount: number;
	dismissedFeatureCount: number;
	defaultPaperFormat?: PaperFormat;
	supportedPaperFormats?: readonly PaperFormat[];
	onClose: () => void;
	onExportRequested: () => void;
}

export function RequestExportModal({
	open,
	runId,
	runVersion,
	activeFeatureCount,
	dismissedFeatureCount,
	defaultPaperFormat = 'A3',
	supportedPaperFormats = ['A3', 'A4'],
	onClose,
	onExportRequested,
}: RequestExportModalProps) {
	const [paperFormat, setPaperFormat] = useState<PaperFormat>(defaultPaperFormat);
	const [observations, setObservations] = useState('');
	const [localError, setLocalError] = useState<string | null>(null);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const fingerprint = useMemo(
		() => deriveExportIdempotencyFingerprint(runId, paperFormat, observations),
		[runId, paperFormat, observations],
	);
	const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
	const lastFingerprintRef = useRef(fingerprint);

	useEffect(() => {
		if (!open) {
			return;
		}
		setPaperFormat(defaultPaperFormat);
		setObservations('');
		setLocalError(null);
		setProblem(null);
		setIsSubmitting(false);
	}, [open, defaultPaperFormat]);

	useEffect(() => {
		if (lastFingerprintRef.current !== fingerprint) {
			lastFingerprintRef.current = fingerprint;
			setIdempotencyKey(generateIdempotencyKey());
			setProblem(null);
		}
	}, [fingerprint]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLocalError(null);
		setProblem(null);

		const trimmedObs = observations.trim();
		if (trimmedObs.length > MAX_EXPORT_OBSERVATIONS_LENGTH) {
			setLocalError(
				`As observações técnicas não podem exceder ${MAX_EXPORT_OBSERVATIONS_LENGTH} caracteres.`,
			);
			return;
		}

		setIsSubmitting(true);
		try {
			await requestRunExport(
				runId,
				{
					paperFormat,
					observations: trimmedObs.length > 0 ? trimmedObs : null,
				},
				idempotencyKey,
			);
			onExportRequested();
			onClose();
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setLocalError('Não foi possível iniciar a geração do pacote cartográfico.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={`Emitir Carta-Imagem & Congelar Versão v${runVersion}`}
			description={`Feições consideradas: ${activeFeatureCount} ativa(s) · ${dismissedFeatureCount} descartada(s) como ruído`}
			maxWidthClassName="max-w-xl"
			disableClose={isSubmitting}
			footer={
				<>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button type="submit" form="request-export-form" isLoading={isSubmitting}>
						<FileOutput className="h-4 w-4" aria-hidden="true" />
						Emitir Carta-Imagem &amp; Congelar Versão
					</Button>
				</>
			}
		>
			<form id="request-export-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
				{problem ? <AlertBanner problem={problem} /> : null}
				{localError ? (
					<AlertBanner variant="error" title="Validação de emissão" message={localError} />
				) : null}

				<AlertBanner
					variant="warning"
					title={`Congelamento Imutável (SELO FROZEN) — RN-02`}
					message={`Após concluir a emissão, a versão v${runVersion} ficará permanentemente congelada para fins de auditoria. Novas revisões exigirão criar a versão v${runVersion + 1}.`}
				/>

				<div className="space-y-2">
					<p className="text-xs font-semibold tracking-wide text-slate-700">
						Formato da prancha cartográfica (300 DPI offline)
					</p>
					<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						{supportedPaperFormats.map((fmt) => {
							const meta = PAPER_FORMAT_LABELS[fmt];
							const active = paperFormat === fmt;
							return (
								<label
									key={fmt}
									className={cn(
										'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
										active
											? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-200'
											: 'border-slate-200 bg-white hover:bg-slate-50',
									)}
								>
									<input
										type="radio"
										name="exportPaperFormat"
										value={fmt}
										checked={active}
										disabled={isSubmitting}
										onChange={() => setPaperFormat(fmt)}
										className="mt-0.5 h-4 w-4 border-slate-300 text-brand-600"
									/>
									<div className="text-xs">
										<p className="font-semibold text-slate-900">{meta.title}</p>
										<p className="font-mono text-[11px] text-slate-500">
											{meta.dimensionsLabel}
										</p>
									</div>
								</label>
							);
						})}
					</div>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="export-observations"
						className="block text-xs font-semibold tracking-wide text-slate-700"
					>
						Observações técnicas para a legenda / manifesto (opcional)
					</label>
					<textarea
						id="export-observations"
						rows={3}
						maxLength={MAX_EXPORT_OBSERVATIONS_LENGTH}
						placeholder="Notas metodológicas, processo vinculado ou ressalvas de cobertura atmosférica..."
						value={observations}
						onChange={(event) => {
							setObservations(event.target.value);
							setLocalError(null);
						}}
						disabled={isSubmitting}
						className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
					/>
					<p className="text-[11px] text-slate-500">
						{observations.trim().length}/{MAX_EXPORT_OBSERVATIONS_LENGTH} caracteres
					</p>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
					<span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
						<KeyRound className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
						Idempotency-Key ativa
					</span>
					<span className="font-mono text-slate-700">{idempotencyKey}</span>
				</div>

				<div className="flex items-center gap-1.5 text-[11px] text-slate-500">
					<Lock className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
					<span>
						Serão gerados a Carta-Imagem `.pdf`, vetores `.geojson`/`.kml`, tabela `.csv` e o manifesto `.json` com hashes SHA-256.
					</span>
				</div>
			</form>
		</Modal>
	);
}
