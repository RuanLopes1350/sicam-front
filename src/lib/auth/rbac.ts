import type { OperatorRole } from '@/types/api';

export interface NavigationItem {
	id: 'cases' | 'integrity' | 'audit-logs' | 'admin-users';
	href: string;
	label: string;
	description: string;
	allowedRoles: readonly OperatorRole[];
}

export const ROLE_LABELS: Record<OperatorRole, string> = {
	analyst: 'Analista',
	auditor: 'Auditor',
	admin: 'Administrador',
};

export const ROLE_BADGE_VARIANTS: Record<OperatorRole, 'info' | 'warning' | 'frozen'> = {
	analyst: 'info',
	auditor: 'warning',
	admin: 'frozen',
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
	{
		id: 'cases',
		href: '/cases',
		label: 'Casos & Cartas-Imagem',
		description: 'Gestão de AOIs, descoberta STAC e emissão cartográfica',
		allowedRoles: ['analyst', 'auditor', 'admin'],
	},
	{
		id: 'integrity',
		href: '/integrity',
		label: 'Verificar Integridade',
		description: 'Validação criptográfica SHA-256 de PDFs e pacotes ZIP',
		allowedRoles: ['analyst', 'auditor', 'admin'],
	},
	{
		id: 'audit-logs',
		href: '/audit-logs',
		label: 'Trilha de Auditoria',
		description: 'Logs imutáveis append-only das ações do sistema',
		allowedRoles: ['admin', 'auditor'],
	},
	{
		id: 'admin-users',
		href: '/admin/users',
		label: 'Operadores & Perfis',
		description: 'Cadastro, perfis RBAC e revogação de acessos',
		allowedRoles: ['admin'],
	},
] as const;

export function hasRequiredRole(
	userRole: OperatorRole | null | undefined,
	allowedRoles?: readonly OperatorRole[],
): boolean {
	if (!userRole) {
		return false;
	}
	if (!allowedRoles || allowedRoles.length === 0) {
		return true;
	}
	return allowedRoles.includes(userRole);
}

export function getVisibleNavigationItems(role: OperatorRole): NavigationItem[] {
	return NAVIGATION_ITEMS.filter((item) => hasRequiredRole(role, item.allowedRoles));
}

export function getDefaultLandingRoute(role: OperatorRole): string {
	return role === 'admin' ? '/admin/users' : '/cases';
}

// Bloqueia Open Redirect em ?next=... permitindo apenas caminhos internos seguros fora de /login
export function sanitizeInternalRedirect(
	rawNext: string | null | undefined,
	fallback = '/cases',
): string {
	if (!rawNext) {
		return fallback;
	}

	const trimmed = rawNext.trim();
	if (
		!trimmed.startsWith('/') ||
		trimmed.startsWith('//') ||
		trimmed.includes('\\') ||
		/[\u0000-\u001F\u007F]/.test(trimmed)
	) {
		return fallback;
	}

	try {
		const parsed = new URL(trimmed, 'https://sicam.local');
		if (parsed.origin !== 'https://sicam.local' || parsed.pathname === '/login') {
			return fallback;
		}
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return fallback;
	}
}
