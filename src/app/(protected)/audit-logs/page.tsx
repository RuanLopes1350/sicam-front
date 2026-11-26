'use client';

import { ScrollText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AuditFiltersBar } from '@/components/audit/AuditFiltersBar';
import { AuditLogsTable } from '@/components/audit/AuditLogsTable';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { listAuditLogs } from '@/lib/audit/auditService';
import type { AuditLogItem, AuditLogsQuery } from '@/types/api';

const DEFAULT_FILTERS: Omit<AuditLogsQuery, 'cursorSeqId'> = {
	limit: 50,
};

function AuditLogsContent() {
	const [activeFilters, setActiveFilters] =
		useState<Omit<AuditLogsQuery, 'cursorSeqId'>>(DEFAULT_FILTERS);
	const [items, setItems] = useState<AuditLogItem[]>([]);
	const [nextCursorSeqId, setNextCursorSeqId] = useState<number | null>(null);
	const [hasCursorActive, setHasCursorActive] = useState(false);

	const [isLoading, setIsLoading] = useState(true);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);

	const fetchPage = useCallback(
		async (
			filters: Omit<AuditLogsQuery, 'cursorSeqId'>,
			cursorSeqId?: number,
			append = false,
		) => {
			setIsLoading(true);
			setProblem(null);
			setGenericError(null);

			try {
				const response = await listAuditLogs({
					...filters,
					...(cursorSeqId !== undefined ? { cursorSeqId } : {}),
				});

				setItems((prev) => {
					if (!append) {
						return response.items;
					}
					const existingSeqIds = new Set(prev.map((row) => row.seqId));
					const novelRows = response.items.filter((row) => !existingSeqIds.has(row.seqId));
					return [...prev, ...novelRows];
				});
				setNextCursorSeqId(response.nextCursorSeqId);
				setHasCursorActive(append);
			} catch (err) {
				if (isApiProblemError(err)) {
					setProblem(err);
				} else {
					setGenericError('Não foi possível consultar os registros de auditoria.');
				}
			} finally {
				setIsLoading(false);
			}
		},
		[],
	);

	useEffect(() => {
		void fetchPage(DEFAULT_FILTERS);
	}, [fetchPage]);

	function handleApplyFilters(nextFilters: Omit<AuditLogsQuery, 'cursorSeqId'>) {
		setActiveFilters(nextFilters);
		void fetchPage(nextFilters, undefined, false);
	}

	function handleResetFilters() {
		setActiveFilters(DEFAULT_FILTERS);
		void fetchPage(DEFAULT_FILTERS, undefined, false);
	}

	function handleLoadOlder(cursorSeqId: number) {
		void fetchPage(activeFilters, cursorSeqId, true);
	}

	function handleResetToLatest() {
		void fetchPage(activeFilters, undefined, false);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
					<ScrollText className="h-5 w-5 text-amber-600" aria-hidden="true" />
					Trilha de Auditoria Append-Only
				</h1>
				<p className="text-sm text-slate-600">
					Consulta cronológica imutável de autenticação, gestão de operadores, execuções e custódia criptográfica (RF-31).
				</p>
			</div>

			{problem ? <AlertBanner problem={problem} /> : null}
			{genericError ? (
				<AlertBanner variant="error" title="Erro na consulta de auditoria" message={genericError} />
			) : null}

			<AuditFiltersBar
				isLoading={isLoading}
				onApplyFilters={handleApplyFilters}
				onResetFilters={handleResetFilters}
			/>

			<AuditLogsTable
				items={items}
				nextCursorSeqId={nextCursorSeqId}
				hasCursorActive={hasCursorActive}
				isLoading={isLoading}
				onLoadOlder={handleLoadOlder}
				onResetToLatest={handleResetToLatest}
			/>
		</div>
	);
}

export default function AuditLogsPage() {
	return (
		<RequireAuth allowedRoles={['admin', 'auditor']}>
			<AuditLogsContent />
		</RequireAuth>
	);
}
