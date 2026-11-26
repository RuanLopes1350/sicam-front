import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ApiProblemError } from '@/lib/api/problemDetails';
import { cn } from '@/lib/utils/cn';

const ALERT_VARIANTS = {
	info: {
		box: 'border-blue-200 bg-blue-50 text-blue-900',
		icon: Info,
	},
	warning: {
		box: 'border-amber-200 bg-amber-50 text-amber-900',
		icon: AlertTriangle,
	},
	error: {
		box: 'border-red-200 bg-red-50 text-red-900',
		icon: AlertCircle,
	},
	success: {
		box: 'border-emerald-200 bg-emerald-50 text-emerald-900',
		icon: CheckCircle2,
	},
} as const;

export interface AlertBannerProps {
	variant?: keyof typeof ALERT_VARIANTS;
	title?: string;
	message?: string;
	problem?: ApiProblemError | null;
	className?: string;
}

export function AlertBanner({
	variant = 'info',
	title,
	message,
	problem,
	className,
}: AlertBannerProps) {
	const effectiveVariant = problem ? 'error' : variant;
	const style = ALERT_VARIANTS[effectiveVariant];
	const Icon = style.icon;

	const heading = problem ? `${problem.title} (${problem.code})` : title;
	const bodyText = problem ? problem.detail : message;

	return (
		<div
			role={effectiveVariant === 'error' ? 'alert' : 'status'}
			className={cn('rounded-lg border px-4 py-3 text-sm', style.box, className)}
		>
			<div className="flex items-start gap-2.5">
				<Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
				<div className="min-w-0 flex-1 space-y-1">
					{heading ? <p className="font-semibold leading-snug">{heading}</p> : null}
					{bodyText ? <p className="text-xs leading-relaxed opacity-90">{bodyText}</p> : null}
					{problem?.invalidParams && problem.invalidParams.length > 0 ? (
						<ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs opacity-90">
							{problem.invalidParams.map((param, idx) => (
								<li key={`${param.field}-${idx}`}>
									<span className="font-mono font-medium">{param.field}</span>: {param.reason}
								</li>
							))}
						</ul>
					) : null}
					{problem?.correlationId ? (
						<p className="pt-0.5 font-mono text-[11px] opacity-75">
							ID de correlação: {problem.correlationId}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
