'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SessionLoadingScreen } from '@/components/auth/SessionLoadingScreen';
import { InstitutionalHeader } from '@/components/layout/InstitutionalHeader';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultLandingRoute } from '@/lib/auth/rbac';

export default function HomePage() {
	const { status, user } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (status === 'authenticated' && user) {
			router.replace(getDefaultLandingRoute(user.role));
		} else if (status === 'unauthenticated') {
			router.replace('/login');
		}
	}, [status, user, router]);

	return (
		<main className="min-h-screen bg-surface-subtle">
			<InstitutionalHeader />
			<SessionLoadingScreen label="Inicializando sessão segura..." />
		</main>
	);
}
