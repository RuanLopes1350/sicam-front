import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const BADGE_VARIANTS = {
	neutral: 'border-slate-200 bg-slate-100 text-slate-700',
	info: 'border-blue-200 bg-blue-50 text-blue-700',
	success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	warning: 'border-amber-200 bg-amber-50 text-amber-800',
	danger: 'border-red-200 bg-red-50 text-red-700',
	frozen: 'border-indigo-300 bg-indigo-50 text-indigo-800 font-semibold',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: keyof typeof BADGE_VARIANTS;
}

export function Badge({
	variant = 'neutral',
	className,
	...props
}: BadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
				BADGE_VARIANTS[variant],
				className,
			)}
			{...props}
		/>
	);
}
