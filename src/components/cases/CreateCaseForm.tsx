'use client';

import { FilePlus2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { AoiEvaluationResult } from '@/lib/geo/aoiGeometry';
import type { AoiPolygonGeoJson, CreateCaseBody } from '@/types/api';

export interface CreateCaseFormProps {
	aoi: AoiPolygonGeoJson | null;
	evaluation: AoiEvaluationResult;
	isSubmitting: boolean;
	onSubmitCase: (payload: CreateCaseBody) => void;
}

export function CreateCaseForm({
	aoi,
	evaluation,
	isSubmitting,
	onSubmitCase,
}: CreateCaseFormProps) {
	const [title, setTitle] = useState('');
	const [externalRef, setExternalRef] = useState('');
	const [description, setDescription] = useState('');
	const [localError, setLocalError] = useState<string | null>(null);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLocalError(null);

		const cleanTitle = title.trim();
		if (cleanTitle.length < 3) {
			setLocalError('Informe um título institucional com no mínimo 3 caracteres.');
			return;
		}
		if (!aoi || !evaluation.isValid) {
			setLocalError(
				evaluation.issues[0] ??
					'Delimite uma Área de Interesse (AOI) válida no mapa antes de registrar o caso.',
			);
			return;
		}

		onSubmitCase({
			title: cleanTitle,
			externalRef: externalRef.trim() ? externalRef.trim() : null,
			description: description.trim() ? description.trim() : null,
			aoiGeoJson: aoi,
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Identificação Processual do Caso</CardTitle>
				<CardDescription>
					O número de protocolo sequencial oficial será gerado automaticamente pelo PostGIS ao confirmar.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4" noValidate>
					{localError ? (
						<AlertBanner variant="error" title="Dados pendentes" message={localError} />
					) : null}

					<Input
						label="Título do caso / alvo pericial"
						placeholder="Ex.: Fiscalização Gleba Rio Jamari — Setor Norte"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						maxLength={200}
						disabled={isSubmitting}
						required
					/>

					<Input
						label="Referência externa (SEI / Auto de Infração / Ofício)"
						placeholder="Opcional — Ex.: 00029.104521/2026-18"
						value={externalRef}
						onChange={(event) => setExternalRef(event.target.value)}
						maxLength={100}
						disabled={isSubmitting}
					/>

					<div className="space-y-1.5">
						<label
							htmlFor="create-case-description"
							className="block text-xs font-semibold tracking-wide text-slate-700"
						>
							Descrição e observações iniciais
						</label>
						<textarea
							id="create-case-description"
							rows={3}
							maxLength={2000}
							placeholder="Contexto territorial, denúncia associada ou finalidade da análise multitemporal..."
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							disabled={isSubmitting}
							className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
						/>
					</div>

					<Button
						type="submit"
						variant="primary"
						className="w-full"
						isLoading={isSubmitting}
						disabled={!aoi || !evaluation.isValid}
					>
						<FilePlus2 className="h-4 w-4" aria-hidden="true" />
						Protocolar Caso e Gravar AOI (SIRGAS 2000)
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
