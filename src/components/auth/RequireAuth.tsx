'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { ForbiddenRoleView } from '@/components/auth/ForbiddenRoleView';
import { SessionLoadingScreen } from '@/components/auth/SessionLoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { hasRequiredRole, sanitizeInternalRedirect } from '@/lib/auth/rbac';
import type { OperatorRole } from '@/types/api';

export interface RequireAuthProps {
	allowedRoles?: readonly OperatorRole[];
	children: ReactNode;
}

export function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
	const { status, user } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (status === 'unauthenticated') {
			const safeNext = sanitizeInternalRedirect(pathname, '/cases');
			router.replace(`/login?next=${encodeURIComponent(safeNext)}`);
		}
	}, [status, pathname, router]);

	if (status === 'initializing') {
		return <SessionLoadingScreen />;
	}

	if (status !== 'authenticated' || !user) {
		return <SessionLoadingScreen label="Redirecionando para autenticação..." />;
	}

	if (!hasRequiredRole(user.role, allowedRoles)) {
		return (
			<ForbiddenRoleView
				userRole={user.role}
				requiredRoles={allowedRoles ?? []}
				userName={user.fullName}
			/>
		);
	}

	return <>{children}</>;
}
