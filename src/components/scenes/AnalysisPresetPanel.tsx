'use client';

import { SlidersHorizontal } from 'lucide-react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import {
	ALGORITHM_PARAM_LABELS,
	RUN_PRESET_LABELS,
	validateCustomParams,
} from '@/lib/scenes/sceneSelection';
import { cn } from '@/lib/utils/cn';
import type {
	AnalysisHardBounds,
	AnalysisPresets,
	CustomAlgorithmParams,
	RunPresetName,
} from '@/types/api';

export interface AnalysisPresetPanelProps {
	presets: AnalysisPresets | null;
	hardBounds: AnalysisHardBounds | null;
	presetName: RunPresetName;
	onPresetChange: (next: RunPresetName) => void;
	customParams: CustomAlgorithmParams;
	onCustomParamsChange: (next: CustomAlgorithmParams) => void;
}

const PRESET_OPTIONS: readonly RunPresetName[] = [
	'TECHNICAL_STANDARD',
	'CONSERVATIVE',
	'CUSTOM',
];

const NUMERIC_PARAM_KEYS = [
	'ndviForestMin',
	'ndviClearedMax',
	'deforestationDeltaMax',
	'degradationDeltaMax',
	'regrowthStartMax',
	'regrowthEndMin',
	'regrowthDeltaMin',
	'minMappingUnitHa',
] as const;

export function AnalysisPresetPanel({
	presets,
	hardBounds,
	presetName,
	onPresetChange,
	customParams,
	onCustomParamsChange,
}: AnalysisPresetPanelProps) {
	if (!presets || !hardBounds) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center gap-2 py-8 text-xs text-slate-600">
					<Spinner size="sm" />
					<span>Carregando presets espectrais de capabilities...</span>
				</CardContent>
			</Card>
		);
	}

	const issues = presetName === 'CUSTOM' ? validateCustomParams(customParams, hardBounds) : [];
	const issueByField = new Map(issues.map((issue) => [issue.field, issue.message]));

	const readonlyParams =
		presetName === 'TECHNICAL_STANDARD' || presetName === 'CONSERVATIVE'
			? presets[presetName]
			: null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<SlidersHorizontal className="h-4 w-4 text-brand-600" aria-hidden="true" />
					Preset Espectral e Parâmetros do Motor Geo-Core (ΔNDVI)
				</CardTitle>
				<CardDescription>
					Selecione um preset homologado ou ajuste manualmente os limiares dentro dos limites técnicos (hard bounds).
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					{PRESET_OPTIONS.map((option) => {
						const active = presetName === option;
						return (
							<label
								key={option}
								className={cn(
									'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 transition-colors',
									active
										? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-200'
										: 'border-slate-200 bg-white hover:bg-slate-50',
								)}
							>
								<input
									type="radio"
									name="runPresetName"
									value={option}
									checked={active}
									onChange={() => onPresetChange(option)}
									className="mt-0.5 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
								/>
								<div className="space-y-0.5 text-xs">
									<p className="font-semibold text-slate-900">
										{RUN_PRESET_LABELS[option]}
									</p>
									<p className="font-mono text-[11px] text-slate-500">{option}</p>
								</div>
							</label>
						);
					})}
				</div>

				{readonlyParams ? (
					<dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
						{NUMERIC_PARAM_KEYS.map((key) => (
							<div key={key} className="rounded-lg border border-slate-200 bg-white p-2.5">
								<dt className="font-medium text-slate-600">
									{ALGORITHM_PARAM_LABELS[key]}
								</dt>
								<dd className="mt-1 font-mono text-sm font-bold text-slate-900">
									{readonlyParams[key]}
								</dd>
							</div>
						))}
						<div className="rounded-lg border border-slate-200 bg-white p-2.5">
							<dt className="font-medium text-slate-600">
								{ALGORITHM_PARAM_LABELS.morphologicalKernel}
							</dt>
							<dd className="mt-1 font-mono text-sm font-bold text-slate-900">
								{readonlyParams.morphologicalKernel === 3 ? '3 (cruz 3×3)' : '0 (desativado)'}
							</dd>
						</div>
					</dl>
				) : (
					<div className="space-y-4">
						<AlertBanner
							variant="info"
							title="Auditoria de parâmetros avançados (isCustomParams)"
							message="Execuções com preset CUSTOM ficam explicitamente marcadas com isCustomParams = true no registro da análise e no manifesto cartográfico."
						/>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{NUMERIC_PARAM_KEYS.map((key) => {
								const bound = hardBounds[key];
								const value = customParams[key];
								return (
									<Input
										key={key}
										label={ALGORITHM_PARAM_LABELS[key]}
										type="number"
										step={key === 'minMappingUnitHa' ? 0.1 : 0.01}
										min={bound.min}
										max={bound.max}
										value={Number.isFinite(value) ? value : ''}
										hint={`Limite: ${bound.min} a ${bound.max}`}
										error={issueByField.get(key)}
										onChange={(event) => {
											const nextNum =
												event.target.value === ''
													? Number.NaN
													: Number(event.target.value);
											onCustomParamsChange({
												...customParams,
												[key]: nextNum,
											});
										}}
									/>
								);
							})}

							<Select
								label={ALGORITHM_PARAM_LABELS.morphologicalKernel}
								value={String(customParams.morphologicalKernel)}
								error={issueByField.get('morphologicalKernel')}
								onChange={(event) =>
									onCustomParamsChange({
										...customParams,
										morphologicalKernel: Number(event.target.value) === 0 ? 0 : 3,
									})
								}
							>
								<option value="3">3 — Abertura em cruz 3×3</option>
								<option value="0">0 — Desativado</option>
							</Select>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
