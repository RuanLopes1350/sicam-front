import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './Spinner';

const BUTTON_VARIANTS = {
	primary:
		'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-sm',
	secondary:
		'bg-brand-900 text-white hover:bg-slate-800 focus-visible:ring-slate-700 shadow-sm',
	outline:
		'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-brand-500',
	ghost:
		'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400',
	danger:
		'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
} as const;

const BUTTON_SIZES = {
	sm: 'h-8 px-3 text-xs gap-1.5',
	md: 'h-9 px-4 text-sm gap-2',
	lg: 'h-11 px-5 text-sm gap-2',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: keyof typeof BUTTON_VARIANTS;
	size?: keyof typeof BUTTON_SIZES;
	isLoading?: boolean;
}

export function Button({
	variant = 'primary',
	size = 'md',
	isLoading = false,
	disabled,
	type = 'button',
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			disabled={disabled || isLoading}
			aria-busy={isLoading || undefined}
			className={cn(
				'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
				BUTTON_VARIANTS[variant],
				BUTTON_SIZES[size],
				className,
			)}
			{...props}
		>
			{isLoading ? <Spinner size="sm" /> : null}
			{children}
		</button>
	);
}
