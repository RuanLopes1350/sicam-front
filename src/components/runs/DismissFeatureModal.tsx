'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { ApiProblemError } from '@/lib/api/problemDetails';
import {
	FEATURE_CLASS_META,
	MAX_DISMISSAL_REASON_LENGTH,
	MIN_DISMISSAL_REASON_LENGTH,
	validateDismissalReason,
} from '@/lib/runs/curationLogic';
import { formatAreaHa } from '@/lib/utils/formatters';
import type { DetectedFeatureGeoJson } from '@/types/api';

export interface DismissFeatureModalProps {
	open: boolean;
	feature: DetectedFeatureGeoJson | null;
	isSubmitting: boolean;
	problem: ApiProblemError | null;
	onClose: () => void;
	onConfirmDismiss: (featureId: string, dismissalReason: string) => void;
}

export function DismissFeatureModal({
	open,
	feature,
	isSubmitting,
	problem,
	onClose,
	onConfirmDismiss,
}: DismissFeatureModalProps) {
	const [reason, setReason] = useState('');
	const [localError, setLocalError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		setReason('');
		setLocalError(null);
	}, [open, feature]);

	if (!feature) {
		return null;
	}

	const props = feature.properties;
	const classMeta = FEATURE_CLASS_META[props.featureClass];
	const trimmedLength = reason.trim().length;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!feature) return;

		const validationError = validateDismissalReason(reason);
		if (validationError) {
			setLocalError(validationError);
			return;
		}

		setLocalError(null);
		onConfirmDismiss(feature.id, reason.trim());
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={`Descartar Polígono ${props.label} como Falso Positivo`}
			description={`${classMeta.label} • ${formatAreaHa(props.areaHa, 2)} (${props.pixelCount} pixels)`}
			disableClose={isSubmitting}
			footer={
				<>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button
						type="submit"
						form="dismiss-feature-form"
						variant="danger"
						isLoading={isSubmitting}
					>
						Confirmar Descarte Auditável
					</Button>
				</>
			}
		>
			<form id="dismiss-feature-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
				{problem ? <AlertBanner problem={problem} /> : null}
				{localError ? (
					<AlertBanner variant="error" title="Justificativa insuficiente" message={localError} />
				) : null}

				<AlertBanner
					variant="warning"
					title="Impacto geodésico e registro em auditoria"
					message="O descarte recalcula imediatamente os totais líquidos no PostGIS, exclui esta feição dos exportáveis (PDF/KML/GeoJSON/CSV) e registra a justificativa de forma imutável na trilha de auditoria."
				/>

				<div className="space-y-1.5">
					<label
						htmlFor="dismiss-reason-textarea"
						className="block text-xs font-semibold tracking-wide text-slate-700"
					>
						Justificativa técnica pericial (mínimo {MIN_DISMISSAL_REASON_LENGTH} caracteres)
					</label>
					<textarea
						id="dismiss-reason-textarea"
						rows={4}
						maxLength={MAX_DISMISSAL_REASON_LENGTH}
						placeholder="Ex.: Sombra topográfica em vertente íngreme / borda residual de nuvem não capturada na banda SCL..."
						value={reason}
						onChange={(event) => {
							setReason(event.target.value);
							setLocalError(null);
						}}
						disabled={isSubmitting}
						className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
						required
					/>
					<p
						className={`text-xs ${
							trimmedLength < MIN_DISMISSAL_REASON_LENGTH
								? 'text-amber-700'
								: 'text-emerald-700'
						}`}
					>
						Comprimento útil atual: {trimmedLength}/{MIN_DISMISSAL_REASON_LENGTH} caracteres mínimos (máx. {MAX_DISMISSAL_REASON_LENGTH})
					</p>
				</div>
			</form>
		</Modal>
	);
}
