'use client';

import { History, Lock, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { CASE_STATUS_META } from '@/lib/cases/caseService';
import { cn } from '@/lib/utils/cn';
import { formatAreaHa } from '@/lib/utils/formatters';
import type { CaseRunSummaryItem } from '@/types/api';

export interface RunVersionSelectorBarProps {
	caseId: string;
	runs: readonly CaseRunSummaryItem[];
	currentRunId: string;
	isAnalyst: boolean;
}

export function RunVersionSelectorBar({
	caseId,
	runs,
	currentRunId,
	isAnalyst,
}: RunVersionSelectorBarProps) {
	if (runs.length === 0) {
		return null;
	}

	const orderedRuns = [...runs].sort((a, b) => a.version - b.version);
	const nextVersion = (orderedRuns[orderedRuns.length - 1]?.version ?? 0) + 1;

	return (
		<Card>
			<CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
						<History className="h-4 w-4 text-brand-600" aria-hidden="true" />
						Histórico de Versões ({orderedRuns.length}):
					</span>

					<nav aria-label="Versões da análise" className="flex flex-wrap items-center gap-2">
						{orderedRuns.map((item) => {
							const isCurrent = item.id === currentRunId;
							const statusMeta = CASE_STATUS_META[item.status];
							return (
								<Link
									key={item.id}
									href={`/cases/${caseId}/runs/${item.id}`}
									aria-current={isCurrent ? 'page' : undefined}
									className={cn(
										'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
										isCurrent
											? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-200'
											: 'border-slate-200 bg-white hover:bg-slate-50',
									)}
								>
									<span className="inline-flex items-center gap-1 font-mono font-bold text-slate-900">
										{item.status === 'frozen' ? (
											<Lock className="h-3 w-3 text-indigo-700" aria-hidden="true" />
										) : null}
										v{item.version}
									</span>
									<Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
									{item.deforestationHa !== null ? (
										<span className="font-mono text-[11px] text-slate-600">
											{formatAreaHa(item.deforestationHa, 1)}
										</span>
									) : null}
								</Link>
							);
						})}
					</nav>
				</div>

				{isAnalyst ? (
					<Link
						href={`/cases/${caseId}/analysis/new`}
						className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50"
					>
						<PlusCircle className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
						Nova Versão (v{nextVersion})
					</Link>
				) : null}
			</CardContent>
		</Card>
	);
}
