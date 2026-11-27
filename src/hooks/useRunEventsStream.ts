'use client';

import { useEffect, useRef, useState } from 'react';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import {
	isTerminalAnalysisStatus,
	resolveDefaultProgressForStatus,
} from '@/lib/runs/runStages';
import { streamRunEvents } from '@/lib/runs/runService';
import type { ParsedRunSseEvent } from '@/lib/runs/sseParser';
import type { RunStatus } from '@/types/api';

export type SseConnectionState =
	| 'idle'
	| 'connecting'
	| 'streaming'
	| 'reconnecting'
	| 'completed'
	| 'error';

export interface RunTimelineEntry {
	key: string;
	timestamp: string;
	status: string;
	step: string;
	progressPct: number;
	message?: string;
}

export interface RunFailureInfo {
	errorCode: string;
	message: string;
}

export interface UseRunEventsStreamOptions {
	runId: string;
	initialStatus: RunStatus;
	enabled: boolean;
	onTerminalStatus?: (finalStatus: 'ready_for_review' | 'frozen' | 'failed') => void;
}

const KNOWN_STATUSES = new Set<RunStatus>([
	'queued',
	'fetching_bands',
	'processing_ndvi',
	'vectorizing',
	'ready_for_review',
	'exporting',
	'frozen',
	'failed',
]);

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1500;

export function useRunEventsStream({
	runId,
	initialStatus,
	enabled,
	onTerminalStatus,
}: UseRunEventsStreamOptions) {
	const initialDefaults = resolveDefaultProgressForStatus(initialStatus);

	const [connectionState, setConnectionState] = useState<SseConnectionState>(() =>
		isTerminalAnalysisStatus(initialStatus) ? 'completed' : 'idle',
	);
	const [status, setStatus] = useState<RunStatus>(initialStatus);
	const [progressPct, setProgressPct] = useState<number>(initialDefaults.progressPct);
	const [stepText, setStepText] = useState<string>(initialDefaults.stepText);
	const [timeline, setTimeline] = useState<RunTimelineEntry[]>([]);
	const [failureInfo, setFailureInfo] = useState<RunFailureInfo | null>(null);
	const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
	const [streamProblem, setStreamProblem] = useState<ApiProblemError | string | null>(null);

	const onTerminalRef = useRef(onTerminalStatus);
	onTerminalRef.current = onTerminalStatus;

	// Mantém estado alinhado quando o fetch inicial da run retorna um estado diferente
	useEffect(() => {
		const defaults = resolveDefaultProgressForStatus(initialStatus);
		setStatus(initialStatus);
		setProgressPct(defaults.progressPct);
		setStepText(defaults.stepText);
		if (isTerminalAnalysisStatus(initialStatus)) {
			setConnectionState(initialStatus === 'failed' ? 'error' : 'completed');
		}
	}, [initialStatus]);

	useEffect(() => {
		if (!enabled || !runId || isTerminalAnalysisStatus(initialStatus)) {
			return;
		}

		let active = true;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		const controller = new AbortController();
		let terminalReached = false;
		let attempts = 0;

		const appendTimeline = (entry: Omit<RunTimelineEntry, 'key'>) => {
			setTimeline((prev) => [
				...prev,
				{
					...entry,
					key: `${entry.timestamp}-${entry.status}-${prev.length}`,
				},
			]);
		};

		const handleEvent = (ev: ParsedRunSseEvent) => {
			if (!active) return;

			if (ev.event === 'snapshot') {
				setStatus(ev.data.status);
				setProgressPct(ev.data.progressPct);
				setStepText(ev.data.step);
				appendTimeline({
					timestamp: ev.data.updatedAt,
					status: ev.data.status,
					step: ev.data.step,
					progressPct: ev.data.progressPct,
				});

				if (isTerminalAnalysisStatus(ev.data.status)) {
					terminalReached = true;
					setConnectionState(ev.data.status === 'failed' ? 'error' : 'completed');
					controller.abort();
					onTerminalRef.current?.(
						ev.data.status as 'ready_for_review' | 'frozen' | 'failed',
					);
				} else {
					setConnectionState('streaming');
				}
				return;
			}

			if (ev.event === 'progress') {
				if (KNOWN_STATUSES.has(ev.data.status as RunStatus)) {
					setStatus(ev.data.status as RunStatus);
				}
				const text = ev.data.message?.trim() ? ev.data.message : ev.data.step;
				setProgressPct(ev.data.progressPct);
				setStepText(text);
				setConnectionState('streaming');
				appendTimeline({
					timestamp: ev.data.timestamp,
					status: ev.data.status,
					step: ev.data.step,
					progressPct: ev.data.progressPct,
					message: ev.data.message,
				});
				return;
			}

			if (ev.event === 'run.ready_for_review') {
				terminalReached = true;
				setStatus('ready_for_review');
				setProgressPct(100);
				setStepText('Análise concluída e pronta para curadoria');
				setConnectionState('completed');
				appendTimeline({
					timestamp: new Date().toISOString(),
					status: 'ready_for_review',
					step: 'Análise concluída e pronta para curadoria',
					progressPct: 100,
				});
				onTerminalRef.current?.('ready_for_review');
				return;
			}

			if (ev.event === 'export.frozen') {
				terminalReached = true;
				setStatus('frozen');
				setProgressPct(100);
				setStepText('Pacote técnico emitido e execução congelada');
				setConnectionState('completed');
				onTerminalRef.current?.('frozen');
				return;
			}

			if (ev.event === 'run.failed' || ev.event === 'export.failed') {
				terminalReached = true;
				setStatus(ev.data.status);
				setFailureInfo({ errorCode: ev.data.errorCode, message: ev.data.message });
				setStepText(ev.data.message);
				setConnectionState('error');
				appendTimeline({
					timestamp: new Date().toISOString(),
					status: ev.data.status,
					step: ev.data.errorCode,
					progressPct: 100,
					message: ev.data.message,
				});
				onTerminalRef.current?.(ev.data.status);
			}
		};

		const connect = async () => {
			if (!active || controller.signal.aborted || terminalReached) {
				return;
			}

			setConnectionState(attempts === 0 ? 'connecting' : 'reconnecting');
			setStreamProblem(null);

			try {
				await streamRunEvents(
					runId,
					{
						onEvent: handleEvent,
						onHeartbeat: () => {
							if (active) {
								setLastHeartbeatAt(new Date().toISOString());
							}
						},
					},
					{ signal: controller.signal },
				);

				if (active && !terminalReached && !controller.signal.aborted) {
					if (attempts < MAX_RECONNECT_ATTEMPTS) {
						attempts += 1;
						setConnectionState('reconnecting');
						reconnectTimer = setTimeout(() => {
							void connect();
						}, RECONNECT_DELAY_MS);
					} else {
						setConnectionState('error');
						setStreamProblem(
							'A conexão SSE foi encerrada antes do término da análise. Recarregue o status se necessário.',
						);
					}
				}
			} catch (err) {
				if (!active || controller.signal.aborted) {
					return;
				}
				if (isApiProblemError(err) && err.status >= 400 && err.status < 500) {
					setConnectionState('error');
					setStreamProblem(err);
					return;
				}
				if (attempts < MAX_RECONNECT_ATTEMPTS) {
					attempts += 1;
					setConnectionState('reconnecting');
					reconnectTimer = setTimeout(() => {
						void connect();
					}, RECONNECT_DELAY_MS);
				} else {
					setConnectionState('error');
					setStreamProblem(
						isApiProblemError(err)
							? err
							: 'Falha ao acompanhar o stream em tempo real da execução.',
					);
				}
			}
		};

		void connect();

		return () => {
			active = false;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			controller.abort();
		};
	}, [runId, initialStatus, enabled]);

	return {
		connectionState,
		status,
		progressPct,
		stepText,
		timeline,
		failureInfo,
		lastHeartbeatAt,
		streamProblem,
	};
}
