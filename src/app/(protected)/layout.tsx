import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AuthenticatedShell } from '@/components/layout/AuthenticatedShell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
	return (
		<RequireAuth>
			<AuthenticatedShell>{children}</AuthenticatedShell>
		</RequireAuth>
	);
}
