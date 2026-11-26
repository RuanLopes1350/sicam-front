'use client';

import { Eye, EyeOff, MapPinned, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { CasesFilterBar } from '@/components/cases/CasesFilterBar';
import { CasesListTable } from '@/components/cases/CasesListTable';
import { CasesOverviewMap } from '@/components/cases/CasesOverviewMap';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useSystemCapabilities } from '@/hooks/useSystemCapabilities';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { listCases } from '@/lib/cases/caseService';
import { formatAreaHa } from '@/lib/utils/formatters';
import type { CaseListItem, CasesListQuery, CasesListResponse } from '@/types/api';

const PAGE_LIMIT = 15;

const EMPTY_PAGINATION: CasesListResponse['pagination'] = {
	page: 1,
	limit: PAGE_LIMIT,
	total: 0,
	totalPages: 0,
};

function CasesWorkspaceContent() {
	const { user } = useAuth();
	const { capabilities, error: capabilitiesError } = useSystemCapabilities(true);

	const [filters, setFilters] = useState<Omit<CasesListQuery, 'page' | 'limit'>>({});
	const [page, setPage] = useState(1);
	const [items, setItems] = useState<CaseListItem[]>([]);
	const [pagination, setPagination] =
		useState<CasesListResponse['pagination']>(EMPTY_PAGINATION);

	const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
	const [focusCaseId, setFocusCaseId] = useState<string | null>(null);
	const [focusTrigger, setFocusTrigger] = useState(0);
	const [showOverviewMap, setShowOverviewMap] = useState(true);

	const [isLoading, setIsLoading] = useState(true);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);

	const fetchCases = useCallback(
		async (activeFilters: Omit<CasesListQuery, 'page' | 'limit'>, targetPage: number) => {
			setIsLoading(true);
			setProblem(null);
			setGenericError(null);

			try {
				const response = await listCases({
					...activeFilters,
					page: targetPage,
					limit: PAGE_LIMIT,
				});
				setItems(response.items);
				setPagination(response.pagination);
			} catch (err) {
				if (isApiProblemError(err)) {
					setProblem(err);
				} else {
					setGenericError('Falha ao carregar o acervo de casos.');
				}
			} finally {
				setIsLoading(false);
			}
		},
		[],
	);

	useEffect(() => {
		void fetchCases(filters, page);
	}, [fetchCases, filters, page]);

	function handleApplyFilters(nextFilters: Omit<CasesListQuery, 'page' | 'limit'>) {
		setPage(1);
		setFilters(nextFilters);
	}

	function handleResetFilters() {
		setPage(1);
		setFilters({});
	}

	function handleFocusCase(caseItem: CaseListItem) {
		setShowOverviewMap(true);
		setSelectedCaseId(caseItem.id);
		setFocusCaseId(caseItem.id);
		setFocusTrigger((prev) => prev + 1);
	}

	const isAnalyst = user?.role === 'analyst';

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
						<MapPinned className="h-5 w-5 text-brand-700" aria-hidden="true" />
						Casos de Análise &amp; Áreas de Interesse (AOIs)
					</h1>
					<p className="text-sm text-slate-600">
						Consulta espacial, protocolo de novas AOIs em SIRGAS 2000 UTM e histórico de análises multitemporais.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowOverviewMap((prev) => !prev)}
					>
						{showOverviewMap ? (
							<>
								<EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
								Ocultar Mapa
							</>
						) : (
							<>
								<Eye className="h-3.5 w-3.5" aria-hidden="true" />
								Exibir Mapa
							</>
						)}
					</Button>

					{isAnalyst ? (
						<Link
							href="/cases/new"
							className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
						>
							<PlusCircle className="h-4 w-4" aria-hidden="true" />
							Novo Caso &amp; Desenhar AOI
						</Link>
					) : user ? (
						<Badge variant="info">
							Consulta RBAC: {ROLE_LABELS[user.role]} ({user.registrationCode})
						</Badge>
					) : null}
				</div>
			</div>

			{capabilitiesError ? <AlertBanner problem={capabilitiesError} /> : null}
			{problem ? <AlertBanner problem={problem} /> : null}
			{genericError ? (
				<AlertBanner variant="error" title="Erro na listagem" message={genericError} />
			) : null}

			{capabilities ? (
				<Card className="bg-slate-50/70">
					<CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs text-slate-600">
						<span>
							Faixa operacional AOI:{' '}
							<strong className="font-mono text-slate-900">
								{formatAreaHa(capabilities.aoi.minAreaHa, 1)} a{' '}
								{formatAreaHa(capabilities.aoi.maxAreaHa, 0)}
							</strong>{' '}
							(máx. <strong className="font-mono">{capabilities.aoi.maxVertices}</strong> vértices)
						</span>
						<span>
							UFs IBGE ativas:{' '}
							<strong className="font-mono text-slate-900">
								{capabilities.aoi.loadedUfs.map((u) => u.ufCode).join(', ') || 'Nenhuma'}
							</strong>
						</span>
						<span>
							Limite simultâneo:{' '}
							<strong className="font-mono text-slate-900">
								{capabilities.analysis.maxActiveRunsPerUser} análises/operador
							</strong>
						</span>
					</CardContent>
				</Card>
			) : null}

			<CasesFilterBar
				isLoading={isLoading}
				onApplyFilters={handleApplyFilters}
				onResetFilters={handleResetFilters}
			/>

			{showOverviewMap ? (
				<CasesOverviewMap
					cases={items}
					selectedCaseId={selectedCaseId}
					focusCaseId={focusCaseId}
					focusTrigger={focusTrigger}
					onSelectCase={(caseId) => setSelectedCaseId(caseId)}
					title="Mapa Geral das AOIs Filtradas"
					heightClassName="h-[300px]"
				/>
			) : null}

			<CasesListTable
				items={items}
				pagination={pagination}
				selectedCaseId={selectedCaseId}
				isLoading={isLoading}
				onPageChange={(nextPage) => setPage(nextPage)}
				onFocusCase={handleFocusCase}
			/>
		</div>
	);
}

export default function CasesWorkspacePage() {
	return (
		<RequireAuth allowedRoles={['analyst', 'auditor', 'admin']}>
			<CasesWorkspaceContent />
		</RequireAuth>
	);
}
