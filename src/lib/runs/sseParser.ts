import type {
	SseExportFrozenEvent,
	SseProgressEvent,
	SseRunReadyForReviewEvent,
	SseSnapshotEvent,
	SseTerminalFailureEvent,
} from '@/types/api';

export type RunSseEventName =
	| 'snapshot'
	| 'progress'
	| 'run.ready_for_review'
	| 'export.frozen'
	| 'run.failed'
	| 'export.failed';

export type ParsedRunSseEvent =
	| { id: string | null; event: 'snapshot'; data: SseSnapshotEvent }
	| { id: string | null; event: 'progress'; data: SseProgressEvent }
	| { id: string | null; event: 'run.ready_for_review'; data: SseRunReadyForReviewEvent }
	| { id: string | null; event: 'export.frozen'; data: SseExportFrozenEvent }
	| { id: string | null; event: 'run.failed' | 'export.failed'; data: SseTerminalFailureEvent };

const KNOWN_SSE_EVENTS = new Set<RunSseEventName>([
	'snapshot',
	'progress',
	'run.ready_for_review',
	'export.frozen',
	'run.failed',
	'export.failed',
]);

export function parseRunSsePayload(
	eventName: string,
	rawData: string,
	id: string | null,
): ParsedRunSseEvent | null {
	if (!KNOWN_SSE_EVENTS.has(eventName as RunSseEventName)) {
		return null;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawData);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return null;
	}

	switch (eventName as RunSseEventName) {
		case 'snapshot':
			return { id, event: 'snapshot', data: parsed as SseSnapshotEvent };
		case 'progress':
			return { id, event: 'progress', data: parsed as SseProgressEvent };
		case 'run.ready_for_review':
			return {
				id,
				event: 'run.ready_for_review',
				data: parsed as SseRunReadyForReviewEvent,
			};
		case 'export.frozen':
			return { id, event: 'export.frozen', data: parsed as SseExportFrozenEvent };
		case 'run.failed':
			return { id, event: 'run.failed', data: parsed as SseTerminalFailureEvent };
		case 'export.failed':
			return { id, event: 'export.failed', data: parsed as SseTerminalFailureEvent };
	}
}

export interface CreateSseFrameParserCallbacks {
	onEvent: (event: ParsedRunSseEvent) => void;
	onComment?: (comment: string) => void;
}

/**
 * Parser incremental compatível com streams chunked text/event-stream (WHATWG Server-Sent Events).
 */
export function createSseFrameParser(callbacks: CreateSseFrameParserCallbacks): {
	feed: (chunk: string) => void;
	flush: () => void;
} {
	let buffer = '';

	const processBlock = (rawBlock: string): void => {
		const trimmedBlock = rawBlock.trim();
		if (!trimmedBlock) {
			return;
		}

		let eventId: string | null = null;
		let eventName = 'message';
		const dataLines: string[] = [];

		const lines = rawBlock.split('\n');
		for (const rawLine of lines) {
			if (!rawLine) {
				continue;
			}
			if (rawLine.startsWith(':')) {
				callbacks.onComment?.(rawLine.slice(1).trim());
				continue;
			}

			const colonIndex = rawLine.indexOf(':');
			const field = colonIndex === -1 ? rawLine : rawLine.slice(0, colonIndex);
			let value = colonIndex === -1 ? '' : rawLine.slice(colonIndex + 1);
			if (value.startsWith(' ')) {
				value = value.slice(1);
			}

			if (field === 'id') {
				eventId = value;
			} else if (field === 'event') {
				eventName = value;
			} else if (field === 'data') {
				dataLines.push(value);
			}
		}

		if (dataLines.length === 0) {
			return;
		}

		const parsedEvent = parseRunSsePayload(eventName, dataLines.join('\n'), eventId);
		if (parsedEvent) {
			callbacks.onEvent(parsedEvent);
		}
	};

	return {
		feed: (chunk: string) => {
			if (!chunk) {
				return;
			}
			buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

			let separatorIndex = buffer.indexOf('\n\n');
			while (separatorIndex !== -1) {
				const frame = buffer.slice(0, separatorIndex);
				buffer = buffer.slice(separatorIndex + 2);
				processBlock(frame);
				separatorIndex = buffer.indexOf('\n\n');
			}
		},
		flush: () => {
			if (buffer.trim()) {
				processBlock(buffer);
			}
			buffer = '';
		},
	};
}
