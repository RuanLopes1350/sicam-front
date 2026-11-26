'use client';

import { Filter, RotateCcw } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
	AUDIT_ACTION_OPTIONS,
	AUDIT_ENTITY_TYPE_OPTIONS,
	isValidUuid,
	toIsoUtcDateTime,
} from '@/lib/audit/auditService';
import type { AuditAction, AuditLogsQuery } from '@/types/api';

export interface AuditFilterDraft {
	action: AuditAction | '';
	entityType: string;
	entityId: string;
	actorUserId: string;
	correlationId: string;
	fromLocal: string;
	toLocal: string;
	limit: number;
}

export const INITIAL_AUDIT_FILTER_DRAFT: AuditFilterDraft = {
	action: '',
	entityType: '',
	entityId: '',
	actorUserId: '',
	correlationId: '',
	fromLocal: '',
	toLocal: '',
	limit: 50,
};

export interface AuditFiltersBarProps {
	isLoading: boolean;
	onApplyFilters: (filters: Omit<AuditLogsQuery, 'cursorSeqId'>) => void;
	onResetFilters: () => void;
}

export function AuditFiltersBar({
	isLoading,
	onApplyFilters,
	onResetFilters,
}: AuditFiltersBarProps) {
	const [draft, setDraft] = useState<AuditFilterDraft>(INITIAL_AUDIT_FILTER_DRAFT);
	const [validationError, setValidationError] = useState<string | null>(null);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setValidationError(null);

		if (draft.actorUserId.trim() && !isValidUuid(draft.actorUserId)) {
			setValidationError('O filtro "ID do Operador" deve estar no formato UUID válido.');
			return;
		}
		if (draft.entityId.trim() && !isValidUuid(draft.entityId)) {
			setValidationError('O filtro "ID da Entidade" deve estar no formato UUID válido.');
			return;
		}
		if (draft.correlationId.trim() && !isValidUuid(draft.correlationId)) {
			setValidationError('O filtro "Correlation ID" deve estar no formato UUID válido.');
			return;
		}

		const fromIso = toIsoUtcDateTime(draft.fromLocal);
		const toIso = toIsoUtcDateTime(draft.toLocal);

		if (draft.fromLocal.trim() && !fromIso) {
			setValidationError('Data/hora inicial inválida.');
			return;
		}
		if (draft.toLocal.trim() && !toIso) {
			setValidationError('Data/hora final inválida.');
			return;
		}
		if (fromIso && toIso && fromIso > toIso) {
			setValidationError('A data/hora inicial deve ser anterior ou igual à data/hora final.');
			return;
		}

		const query: Omit<AuditLogsQuery, 'cursorSeqId'> = {
			limit: draft.limit,
		};
		if (draft.action) {
			query.action = draft.action;
		}
		if (draft.entityType) {
			query.entityType = draft.entityType;
		}
		if (draft.entityId.trim()) {
			query.entityId = draft.entityId.trim();
		}
		if (draft.actorUserId.trim()) {
			query.actorUserId = draft.actorUserId.trim();
		}
		if (draft.correlationId.trim()) {
			query.correlationId = draft.correlationId.trim();
		}
		if (fromIso) {
			query.from = fromIso;
		}
		if (toIso) {
			query.to = toIso;
		}

		onApplyFilters(query);
	}

	function handleReset() {
		setDraft(INITIAL_AUDIT_FILTER_DRAFT);
		setValidationError(null);
		onResetFilters();
	}

	return (
		<Card>
			<CardContent className="p-4">
				<form onSubmit={handleSubmit} className="space-y-3" noValidate>
					{validationError ? (
						<AlertBanner
							variant="error"
							title="Filtro inválido"
							message={validationError}
						/>
					) : null}

					<div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
						<div className="md:col-span-4">
							<Select
								label="Ação auditada"
								value={draft.action}
								onChange={(event) =>
									setDraft((prev) => ({
										...prev,
										action: event.target.value as AuditAction | '',
									}))
								}
							>
								<option value="">Todas as 17 ações</option>
								{AUDIT_ACTION_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label} ({option.value})
									</option>
								))}
							</Select>
						</div>

						<div className="md:col-span-3">
							<Select
								label="Tipo de entidade"
								value={draft.entityType}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, entityType: event.target.value }))
								}
							>
								<option value="">Todas as entidades</option>
								{AUDIT_ENTITY_TYPE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</Select>
						</div>

						<div className="md:col-span-2">
							<Select
								label="Registros por página"
								value={String(draft.limit)}
								onChange={(event) =>
									setDraft((prev) => ({
										...prev,
										limit: Number(event.target.value) || 50,
									}))
								}
							>
								<option value="25">25 eventos</option>
								<option value="50">50 eventos</option>
								<option value="100">100 eventos</option>
							</Select>
						</div>

						<div className="flex flex-wrap items-center gap-2 md:col-span-3 md:justify-end">
							<Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
								<RotateCcw className="h-4 w-4" aria-hidden="true" />
								Limpar
							</Button>
							<Button type="submit" variant="primary" isLoading={isLoading}>
								<Filter className="h-4 w-4" aria-hidden="true" />
								Aplicar
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 md:grid-cols-12">
						<div className="md:col-span-3">
							<Input
								label="ID do Operador (UUID)"
								placeholder="Ex.: 11111111-1111-4111-..."
								value={draft.actorUserId}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, actorUserId: event.target.value }))
								}
								className="font-mono text-xs"
							/>
						</div>

						<div className="md:col-span-3">
							<Input
								label="ID da Entidade (UUID)"
								placeholder="Case ID, Run ID, Export ID..."
								value={draft.entityId}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, entityId: event.target.value }))
								}
								className="font-mono text-xs"
							/>
						</div>

						<div className="md:col-span-2">
							<Input
								label="Correlation ID (UUID)"
								placeholder="Rastreio HTTP..."
								value={draft.correlationId}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, correlationId: event.target.value }))
								}
								className="font-mono text-xs"
							/>
						</div>

						<div className="md:col-span-2">
							<Input
								label="De (data/hora)"
								type="datetime-local"
								value={draft.fromLocal}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, fromLocal: event.target.value }))
								}
							/>
						</div>

						<div className="md:col-span-2">
							<Input
								label="Até (data/hora)"
								type="datetime-local"
								value={draft.toLocal}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, toLocal: event.target.value }))
								}
							/>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
