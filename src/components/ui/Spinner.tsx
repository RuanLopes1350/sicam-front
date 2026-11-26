import { cn } from '@/lib/utils/cn';

const SPINNER_SIZES = {
	sm: 'h-4 w-4 border-2',
	md: 'h-5 w-5 border-2',
	lg: 'h-7 w-7 border-[3px]',
} as const;

export interface SpinnerProps {
	size?: keyof typeof SPINNER_SIZES;
	label?: string;
	className?: string;
}

export function Spinner({
	size = 'md',
	label = 'Carregando',
	className,
}: SpinnerProps) {
	return (
		<span
			role="status"
			aria-label={label}
			className={cn(
				'inline-block animate-spin rounded-full border-current border-t-transparent',
				SPINNER_SIZES[size],
				className,
			)}
		/>
	);
}
