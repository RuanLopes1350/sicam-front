'use client';

import { Filter, RotateCcw, Search } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CASE_STATUS_FILTER_OPTIONS } from '@/lib/cases/caseService';
import {
	listTerritoryStates,
	searchMunicipalities,
} from '@/lib/territories/territoryService';
import type {
	CasesListQuery,
	CaseStatusFilter,
	TerritoryMunicipalityItem,
	TerritoryStateItem,
} from '@/types/api';

export interface CasesFilterDraft {
	q: string;
	stateUf: string;
	municipalityIbge: string;
	status: CaseStatusFilter | '';
}

export const INITIAL_CASES_FILTER_DRAFT: CasesFilterDraft = {
	q: '',
	stateUf: '',
	municipalityIbge: '',
	status: '',
};

export interface CasesFilterBarProps {
	isLoading: boolean;
	onApplyFilters: (filters: Omit<CasesListQuery, 'page' | 'limit'>) => void;
	onResetFilters: () => void;
}

export function CasesFilterBar({
	isLoading,
	onApplyFilters,
	onResetFilters,
}: CasesFilterBarProps) {
	const [draft, setDraft] = useState<CasesFilterDraft>(INITIAL_CASES_FILTER_DRAFT);
	const [states, setStates] = useState<TerritoryStateItem[]>([]);
	const [municipalities, setMunicipalities] = useState<TerritoryMunicipalityItem[]>([]);

	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const res = await listTerritoryStates();
				if (active) {
					setStates(res.items);
				}
			} catch {
				// Mantém filtro disponível
			}
		})();
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const res = await searchMunicipalities({
					...(draft.stateUf ? { uf: draft.stateUf } : {}),
					limit: 100,
				});
				if (active) {
					setMunicipalities(res.items);
				}
			} catch {
				if (active) {
					setMunicipalities([]);
				}
			}
		})();
		return () => {
			active = false;
		};
	}, [draft.stateUf]);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const next: Omit<CasesListQuery, 'page' | 'limit'> = {};
		if (draft.q.trim()) {
			next.q = draft.q.trim();
		}
		if (draft.stateUf) {
			next.stateUf = draft.stateUf;
		}
		if (draft.municipalityIbge) {
			next.municipalityIbge = draft.municipalityIbge;
		}
		if (draft.status) {
			next.status = draft.status;
		}
		onApplyFilters(next);
	}

	function handleReset() {
		setDraft(INITIAL_CASES_FILTER_DRAFT);
		onResetFilters();
	}

	return (
		<Card>
			<CardContent className="p-4">
				<form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
					<div className="md:col-span-4">
						<Input
							label="Protocolo, título ou referência"
							placeholder="Ex.: SICAM-2026, Rio Machado, SEI..."
							value={draft.q}
							onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
							leftIcon={<Search className="h-4 w-4" />}
						/>
					</div>

					<div className="md:col-span-2">
						<Select
							label="UF"
							value={draft.stateUf}
							onChange={(event) =>
								setDraft((prev) => ({
									...prev,
									stateUf: event.target.value,
									municipalityIbge: '',
								}))
							}
						>
							<option value="">Todas</option>
							{states.map((st) => (
								<option key={st.ufCode} value={st.ufCode}>
									{st.ufCode} — {st.name}
								</option>
							))}
						</Select>
					</div>

					<div className="md:col-span-2">
						<Select
							label="Município IBGE"
							value={draft.municipalityIbge}
							onChange={(event) =>
								setDraft((prev) => ({ ...prev, municipalityIbge: event.target.value }))
							}
						>
							<option value="">Todos os municípios</option>
							{municipalities.map((mun) => (
								<option key={mun.ibgeCode} value={mun.ibgeCode}>
									{mun.name} ({mun.ufCode})
								</option>
							))}
						</Select>
					</div>

					<div className="md:col-span-2">
						<Select
							label="Status da última execução"
							value={draft.status}
							onChange={(event) =>
								setDraft((prev) => ({
									...prev,
									status: event.target.value as CaseStatusFilter | '',
								}))
							}
						>
							<option value="">Todos os status</option>
							{CASE_STATUS_FILTER_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</Select>
					</div>

					<div className="flex flex-wrap items-center gap-2 md:col-span-2 md:justify-end">
						<Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
							<RotateCcw className="h-4 w-4" aria-hidden="true" />
							Limpar
						</Button>
						<Button type="submit" variant="primary" isLoading={isLoading}>
							<Filter className="h-4 w-4" aria-hidden="true" />
							Filtrar
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
