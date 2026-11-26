'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { InstitutionalHeader } from '@/components/layout/InstitutionalHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import {
	getVisibleNavigationItems,
	ROLE_BADGE_VARIANTS,
	ROLE_LABELS,
} from '@/lib/auth/rbac';
import { cn } from '@/lib/utils/cn';

export function AuthenticatedShell({ children }: { children: ReactNode }) {
	const { user, logout } = useAuth();
	const pathname = usePathname();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	if (!user) {
		return null;
	}

	const navItems = getVisibleNavigationItems(user.role);

	async function handleLogout() {
		setIsLoggingOut(true);
		try {
			await logout();
			router.replace('/login');
		} finally {
			setIsLoggingOut(false);
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-surface-subtle">
			<InstitutionalHeader
				rightSlot={
					<div className="flex items-center gap-3">
						<div className="hidden text-right md:block">
							<p className="text-xs font-semibold text-white">{user.fullName}</p>
							<p className="font-mono text-[11px] text-slate-300">{user.registrationCode}</p>
						</div>
						<Badge variant={ROLE_BADGE_VARIANTS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
						<Button
							variant="outline"
							size="sm"
							isLoading={isLoggingOut}
							onClick={() => void handleLogout()}
							className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white"
						>
							<LogOut className="h-3.5 w-3.5" aria-hidden="true" />
							Sair
						</Button>
					</div>
				}
			/>

			<nav
				aria-label="Navegação principal"
				className="border-b border-slate-200 bg-white shadow-sm"
			>
				<div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
					{navItems.map((item) => {
						const isActive =
							pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.id}
								href={item.href}
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									'whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold transition-colors',
									isActive
										? 'border-brand-600 text-brand-700'
										: 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
								)}
							>
								{item.label}
							</Link>
						);
					})}
				</div>
			</nav>

			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
		</div>
	);
}
