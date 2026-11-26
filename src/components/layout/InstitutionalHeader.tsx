import { Compass, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';

export interface InstitutionalHeaderProps {
	rightSlot?: ReactNode;
}

export function InstitutionalHeader({ rightSlot }: InstitutionalHeaderProps) {
	return (
		<header className="border-b border-slate-200 bg-brand-900 text-white">
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/30 bg-slate-800 text-sky-400">
						<Compass className="h-5 w-5" aria-hidden="true" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<span className="text-sm font-bold tracking-wide text-white">SICAM</span>
							<Badge
								variant="info"
								className="border-sky-400/30 bg-sky-500/15 font-mono text-[11px] text-sky-200"
							>
								SIRGAS 2000 · EPSG:4674
							</Badge>
						</div>
						<p className="text-xs text-slate-300">
							Sistema de Carta-Imagem e Análise Multitemporal
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<span className="hidden items-center gap-1.5 text-xs text-slate-300 sm:inline-flex">
						<ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
						Zero Trust · OpenAPI 3.1
					</span>
					{rightSlot}
				</div>
			</div>
		</header>
	);
}
