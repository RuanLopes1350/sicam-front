'use client';

import { Crosshair, MapPin, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
	listTerritoryStates,
	searchMunicipalities,
} from '@/lib/territories/territoryService';
import type { TerritoryMunicipalityItem, TerritoryStateItem } from '@/types/api';

export interface MunicipalitySearchBoxProps {
	selectedUf: string;
	onSelectUf: (uf: string) => void;
	selectedMunicipality: TerritoryMunicipalityItem | null;
	onSelectMunicipality: (municipality: TerritoryMunicipalityItem | null) => void;
	onFocusMunicipality?: (municipality: TerritoryMunicipalityItem) => void;
	autoSelectFirstUf?: boolean;
}

export function MunicipalitySearchBox({
	selectedUf,
	onSelectUf,
	selectedMunicipality,
	onSelectMunicipality,
	onFocusMunicipality,
	autoSelectFirstUf = false,
}: MunicipalitySearchBoxProps) {
	const [states, setStates] = useState<TerritoryStateItem[]>([]);
	const [queryText, setQueryText] = useState('');
	const [results, setResults] = useState<TerritoryMunicipalityItem[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);

	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const res = await listTerritoryStates();
				if (!active) return;
				setStates(res.items);
				if (autoSelectFirstUf && !selectedUf && res.items.length > 0) {
					onSelectUf(res.items[0]!.ufCode);
				}
			} catch {
				// Mantém seletor funcional mesmo sem UFs pré-carregadas
			}
		})();
		return () => {
			active = false;
		};
	}, [autoSelectFirstUf, onSelectUf, selectedUf]);

	useEffect(() => {
		let active = true;
		const timer = setTimeout(() => {
			void (async () => {
				setIsSearching(true);
				try {
					const res = await searchMunicipalities({
						...(selectedUf ? { uf: selectedUf } : {}),
						...(queryText.trim() ? { q: queryText.trim() } : {}),
						limit: 20,
					});
					if (active) {
						setResults(res.items);
					}
				} catch {
					if (active) {
						setResults([]);
					}
				} finally {
					if (active) {
						setIsSearching(false);
					}
				}
			})();
		}, 220);

		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [selectedUf, queryText]);

	function handlePick(municipality: TerritoryMunicipalityItem) {
		onSelectMunicipality(municipality);
		setQueryText('');
		setDropdownOpen(false);
		onFocusMunicipality?.(municipality);
	}

	return (
		<div className="space-y-2.5">
			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
				<div className="sm:col-span-4">
					<Select
						label="UF (IBGE)"
						value={selectedUf}
						onChange={(event) => {
							onSelectUf(event.target.value);
							onSelectMunicipality(null);
						}}
					>
						<option value="">Todas as UFs</option>
						{states.map((st) => (
							<option key={st.ufCode} value={st.ufCode}>
								{st.ufCode} — {st.name}
							</option>
						))}
					</Select>
				</div>

				<div className="relative sm:col-span-8">
					<Input
						label="Navegação rápida por Município"
						placeholder="Digite o nome do município (ex.: Porto Velho, Ji-Paraná)..."
						value={queryText}
						onFocus={() => setDropdownOpen(true)}
						onChange={(event) => {
							setQueryText(event.target.value);
							setDropdownOpen(true);
						}}
						leftIcon={<Search className="h-4 w-4" />}
						rightSlot={
							queryText ? (
								<button
									type="button"
									aria-label="Limpar busca de município"
									onClick={() => setQueryText('')}
									className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
								>
									<X className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
							) : null
						}
					/>

					{dropdownOpen ? (
						<div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
							{isSearching ? (
								<div className="px-3 py-2.5 text-xs text-slate-500">
									Pesquisando malha municipal IBGE...
								</div>
							) : results.length === 0 ? (
								<div className="px-3 py-2.5 text-xs text-slate-500">
									Nenhum município encontrado na base IBGE carregada.
								</div>
							) : (
								<ul className="divide-y divide-slate-100 text-xs">
									{results.map((mun) => (
										<li key={mun.ibgeCode}>
											<button
												type="button"
												onClick={() => handlePick(mun)}
												className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-brand-50"
											>
												<span className="flex items-center gap-1.5 font-medium text-slate-800">
													<MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
													{mun.name} - {mun.ufCode}
												</span>
												<span className="font-mono text-[11px] text-slate-500">
													IBGE {mun.ibgeCode}
												</span>
											</button>
										</li>
									))}
								</ul>
							)}
							<div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-right">
								<button
									type="button"
									onClick={() => setDropdownOpen(false)}
									className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
								>
									Fechar lista
								</button>
							</div>
						</div>
					) : null}
				</div>
			</div>

			{selectedMunicipality ? (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="info">Município em foco</Badge>
						<span className="font-semibold text-slate-900">
							{selectedMunicipality.name} - {selectedMunicipality.ufCode}
						</span>
						<span className="font-mono text-slate-600">
							(IBGE {selectedMunicipality.ibgeCode})
						</span>
					</div>

					<div className="flex items-center gap-1.5">
						{onFocusMunicipality ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() => onFocusMunicipality(selectedMunicipality)}
							>
								<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
								Enquadrar
							</Button>
						) : null}
						<Button
							size="sm"
							variant="ghost"
							onClick={() => onSelectMunicipality(null)}
						>
							Remover foco
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
