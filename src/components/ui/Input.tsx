import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	hint?: string;
	leftIcon?: ReactNode;
	rightSlot?: ReactNode;
	containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{
		id,
		label,
		error,
		hint,
		leftIcon,
		rightSlot,
		containerClassName,
		className,
		...props
	},
	ref,
) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const describedById = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

	return (
		<div className={cn('space-y-1.5', containerClassName)}>
			{label ? (
				<label
					htmlFor={inputId}
					className="block text-xs font-semibold tracking-wide text-slate-700"
				>
					{label}
				</label>
			) : null}

			<div className="relative flex items-center">
				{leftIcon ? (
					<span
						className="pointer-events-none absolute left-3 flex items-center text-slate-400"
						aria-hidden="true"
					>
						{leftIcon}
					</span>
				) : null}

				<input
					ref={ref}
					id={inputId}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedById}
					className={cn(
						'block w-full rounded-lg border bg-white py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
						leftIcon ? 'pl-9' : 'pl-3',
						rightSlot ? 'pr-10' : 'pr-3',
						error
							? 'border-red-400 focus:border-red-500 focus:ring-red-200'
							: 'border-slate-300 focus:border-brand-600 focus:ring-brand-100',
						className,
					)}
					{...props}
				/>

				{rightSlot ? (
					<div className="absolute right-2 flex items-center">{rightSlot}</div>
				) : null}
			</div>

			{error ? (
				<p id={`${inputId}-error`} className="text-xs font-medium text-red-600">
					{error}
				</p>
			) : hint ? (
				<p id={`${inputId}-hint`} className="text-xs text-slate-500">
					{hint}
				</p>
			) : null}
		</div>
	);
});
