'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { SessionLoadingScreen } from '@/components/auth/SessionLoadingScreen';
import { InstitutionalHeader } from '@/components/layout/InstitutionalHeader';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultLandingRoute, sanitizeInternalRedirect } from '@/lib/auth/rbac';

function LoginPageContent() {
	const { status, user } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextParam = searchParams.get('next');

	useEffect(() => {
		if (status === 'authenticated' && user) {
			const destination = sanitizeInternalRedirect(
				nextParam,
				getDefaultLandingRoute(user.role),
			);
			router.replace(destination);
		}
	}, [status, user, nextParam, router]);

	if (status === 'initializing' || status === 'authenticated') {
		return <SessionLoadingScreen label="Verificando sessão ativa..." />;
	}

	return (
		<div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
			<LoginForm
				nextPath={nextParam}
				onSuccessRedirect={(targetPath) => router.replace(targetPath)}
			/>
		</div>
	);
}

export default function LoginPage() {
	return (
		<div className="flex min-h-screen flex-col bg-surface-subtle">
			<InstitutionalHeader />
			<Suspense fallback={<SessionLoadingScreen label="Carregando autenticação..." />}>
				<LoginPageContent />
			</Suspense>
		</div>
	);
}
