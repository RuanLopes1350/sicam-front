'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	maxWidthClassName?: string;
	disableClose?: boolean;
}

export function Modal({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	maxWidthClassName = 'max-w-lg',
	disableClose = false,
}: ModalProps) {
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		if (!open || disableClose) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [open, disableClose, onClose]);

	if (!open) {
		return null;
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
			onClick={(event) => {
				if (event.target === event.currentTarget && !disableClose) {
					onClose();
				}
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={description ? descriptionId : undefined}
				className={cn(
					'w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl',
					maxWidthClassName,
				)}
			>
				<div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
					<div className="space-y-1">
						<h2 id={titleId} className="text-base font-semibold text-slate-900">
							{title}
						</h2>
						{description ? (
							<p id={descriptionId} className="text-xs text-slate-500">
								{description}
							</p>
						) : null}
					</div>
					<button
						type="button"
						disabled={disableClose}
						onClick={onClose}
						aria-label="Fechar janela"
						className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</div>

				<div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>

				{footer ? (
					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
						{footer}
					</div>
				) : null}
			</div>
		</div>
	);
}
