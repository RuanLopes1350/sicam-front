'use client';

import { CalendarRange, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
	computeWindowSpanDays,
	MAX_WINDOW_SPAN_DAYS,
	STAC_PROVIDER_LABELS,
	validateSceneSearchForm,
} from '@/lib/scenes/sceneSelection';
import type { SceneSearchBody, StacProvider } from '@/types/api';

export interface SceneSearchFormProps {
	initialValue: SceneSearchBody;
	isSearching: boolean;
	onSearch: (body: SceneSearchBody) => void;
}

const ALL_PROVIDERS: readonly StacProvider[] = ['aws_earth_search', 'inpe_bdc'];

export function SceneSearchForm({
	initialValue,
	isSearching,
	onSearch,
}: SceneSearchFormProps) {
	const [t0From, setT0From] = useState(initialValue.t0Window.from);
	const [t0To, setT0To] = useState(initialValue.t0Window.to);
	const [t1From, setT1From] = useState(initialValue.t1Window.from);
	const [t1To, setT1To] = useState(initialValue.t1Window.to);
	const [providers, setProviders] = useState<StacProvider[]>(
		initialValue.providers ?? ['aws_earth_search', 'inpe_bdc'],
	);
	const [maxGlobalCloudPct, setMaxGlobalCloudPct] = useState<number>(
		initialValue.maxGlobalCloudPct ?? 40,
	);
	const [limitPerWindow, setLimitPerWindow] = useState<number>(
		initialValue.limitPerWindow ?? 15,
	);
	const [errors, setErrors] = useState<string[]>([]);

	const t0SpanDays = computeWindowSpanDays({ from: t0From, to: t0To });
	const t1SpanDays = computeWindowSpanDays({ from: t1From, to: t1To });

	function toggleProvider(target: StacProvider) {
		setErrors([]);
		setProviders((prev) =>
			prev.includes(target) ? prev.filter((item) => item !== target) : [...prev, target],
		);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const candidateBody: SceneSearchBody = {
			t0Window: { from: t0From.trim(), to: t0To.trim() },
			t1Window: { from: t1From.trim(), to: t1To.trim() },
			providers,
			maxGlobalCloudPct,
			limitPerWindow,
		};

		const issues = validateSceneSearchForm(candidateBody);
		if (issues.length > 0) {
			setErrors(issues);
			return;
		}

		setErrors([]);
		onSearch(candidateBody);
	}

	function formatSpanHint(span: number | null): string {
		if (span === null || span < 0) {
			return `Intervalo máximo permitido: ${MAX_WINDOW_SPAN_DAYS} dias`;
		}
		return `Duração: ${Math.ceil(span)} dia(s) · máximo ${MAX_WINDOW_SPAN_DAYS} dias`;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CalendarRange className="h-4 w-4 text-brand-600" aria-hidden="true" />
					Parâmetros de Busca STAC (Janelas T0 e T1)
				</CardTitle>
				<CardDescription>
					Pesquisa simultânea em catálogos Sentinel-2 L2A com cálculo real de obstrução de nuvens via banda SCL na AOI.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4" noValidate>
					{errors.length > 0 ? (
						<AlertBanner
							variant="error"
							title="Corrija os parâmetros da busca STAC"
							message={errors.join(' ')}
						/>
					) : null}

					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
								Janela Base — T0 (Anterior)
							</p>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<Input
									label="Data inicial (T0)"
									type="date"
									value={t0From}
									onChange={(event) => {
										setT0From(event.target.value);
										setErrors([]);
									}}
									disabled={isSearching}
									required
								/>
								<Input
									label="Data final (T0)"
									type="date"
									value={t0To}
									onChange={(event) => {
										setT0To(event.target.value);
										setErrors([]);
									}}
									disabled={isSearching}
									required
								/>
							</div>
							<p
								className={`text-[11px] font-medium ${
									t0SpanDays !== null && t0SpanDays > MAX_WINDOW_SPAN_DAYS
										? 'text-red-600'
										: 'text-slate-500'
								}`}
							>
								{formatSpanHint(t0SpanDays)}
							</p>
						</div>

						<div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
								Janela Alvo — T1 (Posterior)
							</p>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<Input
									label="Data inicial (T1)"
									type="date"
									value={t1From}
									onChange={(event) => {
										setT1From(event.target.value);
										setErrors([]);
									}}
									disabled={isSearching}
									required
								/>
								<Input
									label="Data final (T1)"
									type="date"
									value={t1To}
									onChange={(event) => {
										setT1To(event.target.value);
										setErrors([]);
									}}
									disabled={isSearching}
									required
								/>
							</div>
							<p
								className={`text-[11px] font-medium ${
									t1SpanDays !== null && t1SpanDays > MAX_WINDOW_SPAN_DAYS
										? 'text-red-600'
										: 'text-slate-500'
								}`}
							>
								{formatSpanHint(t1SpanDays)}
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
						<div className="space-y-1.5 md:col-span-6">
							<p className="text-xs font-semibold tracking-wide text-slate-700">
								Provedores STAC Whitelisted
							</p>
							<div className="flex flex-wrap gap-3 pt-1">
								{ALL_PROVIDERS.map((provider) => {
									const checked = providers.includes(provider);
									return (
										<label
											key={provider}
											className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
										>
											<input
												type="checkbox"
												checked={checked}
												disabled={isSearching}
												onChange={() => toggleProvider(provider)}
												className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
											/>
											<span>{STAC_PROVIDER_LABELS[provider]}</span>
										</label>
									);
								})}
							</div>
						</div>

						<div className="md:col-span-2">
							<Input
								label="Nuvem global máx. (%)"
								type="number"
								min={0}
								max={100}
								step={1}
								value={Number.isFinite(maxGlobalCloudPct) ? maxGlobalCloudPct : ''}
								onChange={(event) => {
									setMaxGlobalCloudPct(
										event.target.value === '' ? Number.NaN : Number(event.target.value),
									);
									setErrors([]);
								}}
								disabled={isSearching}
							/>
						</div>

						<div className="md:col-span-2">
							<Input
								label="Limite por janela"
								type="number"
								min={1}
								max={25}
								step={1}
								value={Number.isFinite(limitPerWindow) ? limitPerWindow : ''}
								onChange={(event) => {
									setLimitPerWindow(
										event.target.value === '' ? Number.NaN : Number(event.target.value),
									);
									setErrors([]);
								}}
								disabled={isSearching}
							/>
						</div>

						<div className="md:col-span-2 md:flex md:justify-end">
							<Button type="submit" variant="primary" className="w-full" isLoading={isSearching}>
								<Search className="h-4 w-4" aria-hidden="true" />
								Buscar Cenas STAC
							</Button>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
