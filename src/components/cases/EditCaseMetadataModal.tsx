'use client';

import { Lock } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { updateCaseMetadata } from '@/lib/cases/caseService';
import type { CaseDetailResponse, UpdateCaseBody, UpdateCaseResponse } from '@/types/api';

export interface EditCaseMetadataModalProps {
	open: boolean;
	caseData: CaseDetailResponse | null;
	onClose: () => void;
	onUpdated: (updated: UpdateCaseResponse) => void;
}

export function EditCaseMetadataModal({
	open,
	caseData,
	onClose,
	onUpdated,
}: EditCaseMetadataModalProps) {
	const [title, setTitle] = useState('');
	const [externalRef, setExternalRef] = useState('');
	const [description, setDescription] = useState('');
	const [localError, setLocalError] = useState<string | null>(null);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open || !caseData) {
			return;
		}
		setTitle(caseData.title);
		setExternalRef(caseData.externalRef ?? '');
		setDescription(caseData.description ?? '');
		setLocalError(null);
		setProblem(null);
		setIsSubmitting(false);
	}, [open, caseData]);

	if (!caseData) {
		return null;
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!caseData) {
			return;
		}

		setLocalError(null);
		setProblem(null);

		const cleanTitle = title.trim();
		const cleanExternalRef = externalRef.trim() ? externalRef.trim() : null;
		const cleanDescription = description.trim() ? description.trim() : null;

		if (cleanTitle.length < 3) {
			setLocalError('O título do caso deve conter pelo menos 3 caracteres.');
			return;
		}

		const patch: UpdateCaseBody = {};
		if (cleanTitle !== caseData.title) {
			patch.title = cleanTitle;
		}
		if (cleanExternalRef !== caseData.externalRef) {
			patch.externalRef = cleanExternalRef;
		}
		if (cleanDescription !== caseData.description) {
			patch.description = cleanDescription;
		}

		if (Object.keys(patch).length === 0) {
			onClose();
			return;
		}

		setIsSubmitting(true);
		try {
			const updated = await updateCaseMetadata(caseData.id, patch);
			onUpdated(updated);
			onClose();
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setLocalError('Não foi possível salvar os metadados textuais do caso.');
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Editar Metadados Textuais do Caso"
			description={`Protocolo ${caseData.protocolCode}`}
			disableClose={isSubmitting}
			footer={
				<>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button type="submit" form="edit-case-metadata-form" isLoading={isSubmitting}>
						Salvar Metadados
					</Button>
				</>
			}
		>
			<form
				id="edit-case-metadata-form"
				onSubmit={handleSubmit}
				className="space-y-4"
				noValidate
			>
				{problem ? <AlertBanner problem={problem} /> : null}
				{localError ? (
					<AlertBanner variant="error" title="Validação" message={localError} />
				) : null}

				<div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-950">
					<Lock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
					<span>
						Por garantia pericial (RN-01), a geometria da <strong>AOI</strong> e o{' '}
						<strong>código de protocolo</strong> são estritamente imutáveis após a criação.
					</span>
				</div>

				<Input
					label="Título do caso"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					maxLength={200}
					disabled={isSubmitting}
					required
				/>

				<Input
					label="Referência externa (processo / auto / SEI)"
					placeholder="Opcional (até 100 caracteres)"
					value={externalRef}
					onChange={(event) => setExternalRef(event.target.value)}
					maxLength={100}
					disabled={isSubmitting}
				/>

				<div className="space-y-1.5">
					<label
						htmlFor="case-edit-description"
						className="block text-xs font-semibold tracking-wide text-slate-700"
					>
						Descrição / contexto técnico
					</label>
					<textarea
						id="case-edit-description"
						rows={4}
						maxLength={2000}
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						disabled={isSubmitting}
						className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
					/>
				</div>
			</form>
		</Modal>
	);
}
