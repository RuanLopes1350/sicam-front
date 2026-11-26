import { forwardRef, type ReactNode, type SelectHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	error?: string;
	hint?: string;
	containerClassName?: string;
	children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
	{ id, label, error, hint, containerClassName, className, children, ...props },
	ref,
) {
	const generatedId = useId();
	const selectId = id ?? generatedId;
	const describedById = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

	return (
		<div className={cn('space-y-1.5', containerClassName)}>
			{label ? (
				<label
					htmlFor={selectId}
					className="block text-xs font-semibold tracking-wide text-slate-700"
				>
					{label}
				</label>
			) : null}

			<select
				ref={ref}
				id={selectId}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedById}
				className={cn(
					'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
					error
						? 'border-red-400 focus:border-red-500 focus:ring-red-200'
						: 'border-slate-300 focus:border-brand-600 focus:ring-brand-100',
					className,
				)}
				{...props}
			>
				{children}
			</select>

			{error ? (
				<p id={`${selectId}-error`} className="text-xs font-medium text-red-600">
					{error}
				</p>
			) : hint ? (
				<p id={`${selectId}-hint`} className="text-xs text-slate-500">
					{hint}
				</p>
			) : null}
		</div>
	);
});
