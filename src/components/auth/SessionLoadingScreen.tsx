import { Spinner } from '@/components/ui/Spinner';

export interface SessionLoadingScreenProps {
	label?: string;
}

export function SessionLoadingScreen({
	label = 'Verificando sessão autenticada...',
}: SessionLoadingScreenProps) {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 py-12 text-center">
			<Spinner size="lg" label={label} className="text-brand-600" />
			<div className="space-y-1">
				<p className="text-sm font-semibold text-slate-900">{label}</p>
				<p className="text-xs text-slate-500">
					Validando credenciais e permissões RBAC em memória...
				</p>
			</div>
		</div>
	);
}
