import { apiClient, type SicamApiClient, unwrapApiResult } from '@/lib/api/client';
import type { AuditAction, AuditLogsQuery, AuditLogsResponse } from '@/types/api';

export interface AuditActionMeta {
	label: string;
	badgeVariant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'frozen';
}

export const AUDIT_ACTION_META: Record<AuditAction, AuditActionMeta> = {
	auth_login_success: { label: 'Login autenticado', badgeVariant: 'success' },
	auth_login_failed: { label: 'Falha de login', badgeVariant: 'warning' },
	auth_token_revoked: { label: 'Token revogado', badgeVariant: 'neutral' },
	auth_token_reuse_detected: { label: 'Reuso de token detectado', badgeVariant: 'danger' },
	user_created: { label: 'Operador cadastrado', badgeVariant: 'info' },
	user_updated: { label: 'Operador atualizado', badgeVariant: 'info' },
	user_deactivated: { label: 'Operador desativado', badgeVariant: 'danger' },
	ibge_state_imported: { label: 'Malha IBGE importada', badgeVariant: 'info' },
	case_created: { label: 'Caso criado', badgeVariant: 'info' },
	run_created: { label: 'Análise solicitada', badgeVariant: 'info' },
	run_completed: { label: 'Análise concluída', badgeVariant: 'success' },
	run_failed: { label: 'Falha na análise', badgeVariant: 'danger' },
	feature_reviewed: { label: 'Feição curada', badgeVariant: 'warning' },
	export_requested: { label: 'Exportação solicitada', badgeVariant: 'info' },
	export_generated: { label: 'Pacote gerado (FROZEN)', badgeVariant: 'frozen' },
	export_downloaded: { label: 'Download de artefato', badgeVariant: 'neutral' },
	integrity_verified: { label: 'Integridade verificada', badgeVariant: 'success' },
};

export const AUDIT_ACTION_OPTIONS: ReadonlyArray<{ value: AuditAction; label: string }> = (
	Object.keys(AUDIT_ACTION_META) as AuditAction[]
).map((action) => ({
	value: action,
	label: AUDIT_ACTION_META[action].label,
}));

export const AUDIT_ENTITY_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: 'auth', label: 'Autenticação (auth)' },
	{ value: 'user', label: 'Operador (user)' },
	{ value: 'territory', label: 'Território IBGE (territory)' },
	{ value: 'case', label: 'Caso (case)' },
	{ value: 'run', label: 'Execução (run)' },
	{ value: 'detected_feature', label: 'Feição Detectada (detected_feature)' },
	{ value: 'export', label: 'Exportação (export)' },
	{ value: 'integrity', label: 'Integridade (integrity)' },
];

const UUID_REGEX =
	/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

export function isValidUuid(value: string): boolean {
	return UUID_REGEX.test(value.trim());
}

/**
 * Converte data/hora local de formulário HTML ou string ISO em ISO 8601 UTC aceito pela API.
 */
export function toIsoUtcDateTime(localOrIsoValue: string): string | undefined {
	const trimmed = localOrIsoValue.trim();
	if (!trimmed) {
		return undefined;
	}
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) {
		return undefined;
	}
	return parsed.toISOString();
}

/**
 * Consulta a trilha de auditoria append-only com filtros e paginação keyset por seqId.
 */
export async function listAuditLogs(
	query?: AuditLogsQuery,
	client: SicamApiClient = apiClient,
): Promise<AuditLogsResponse> {
	const cleanQuery: AuditLogsQuery = {};

	if (typeof query?.cursorSeqId === 'number' && Number.isFinite(query.cursorSeqId) && query.cursorSeqId > 0) {
		cleanQuery.cursorSeqId = Math.trunc(query.cursorSeqId);
	}
	if (typeof query?.limit === 'number' && Number.isFinite(query.limit) && query.limit >= 1) {
		cleanQuery.limit = Math.min(100, Math.trunc(query.limit));
	}
	if (query?.actorUserId?.trim()) {
		cleanQuery.actorUserId = query.actorUserId.trim();
	}
	if (query?.action) {
		cleanQuery.action = query.action;
	}
	if (query?.entityType?.trim()) {
		cleanQuery.entityType = query.entityType.trim();
	}
	if (query?.entityId?.trim()) {
		cleanQuery.entityId = query.entityId.trim();
	}
	if (query?.correlationId?.trim()) {
		cleanQuery.correlationId = query.correlationId.trim();
	}
	if (query?.from?.trim()) {
		cleanQuery.from = query.from.trim();
	}
	if (query?.to?.trim()) {
		cleanQuery.to = query.to.trim();
	}

	const result = await client.GET('/api/v1/audit-logs', {
		params: {
			...(Object.keys(cleanQuery).length > 0 ? { query: cleanQuery } : {}),
		},
	});

	return unwrapApiResult(result);
}
