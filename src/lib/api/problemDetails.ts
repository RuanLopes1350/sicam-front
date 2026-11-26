export interface InvalidParamDetail {
	field: string;
	reason: string;
	meta?: Record<string, unknown>;
}

export interface ProblemDetails {
	type: string;
	title: string;
	status: number;
	code: string;
	detail: string;
	instance: string;
	correlationId: string;
	invalidParams?: InvalidParamDetail[];
}

export class ApiProblemError extends Error {
	public readonly status: number;
	public readonly code: string;
	public readonly title: string;
	public readonly detail: string;
	public readonly instance: string;
	public readonly correlationId: string;
	public readonly invalidParams?: InvalidParamDetail[];

	constructor(problem: ProblemDetails) {
		super(problem.detail || problem.title || 'Erro na requisição à API SICAM.');
		this.name = 'ApiProblemError';
		this.status = problem.status;
		this.code = problem.code;
		this.title = problem.title;
		this.detail = problem.detail;
		this.instance = problem.instance;
		this.correlationId = problem.correlationId;
		this.invalidParams = problem.invalidParams;
	}
}

export function isApiProblemError(error: unknown): error is ApiProblemError {
	return error instanceof ApiProblemError;
}

export function parseProblemResponse(
	status: number,
	body: unknown,
	fallbackMessage = 'Falha inesperada na comunicação com a API.',
): ApiProblemError {
	if (body && typeof body === 'object' && !Array.isArray(body)) {
		const record = body as Record<string, unknown>;
		const code = typeof record.code === 'string' ? record.code : `ERR_HTTP_${status}`;
		const title =
			typeof record.title === 'string' ? record.title : 'Erro de processamento na API';
		const detail = typeof record.detail === 'string' ? record.detail : fallbackMessage;
		const instance = typeof record.instance === 'string' ? record.instance : '';
		const correlationId =
			typeof record.correlationId === 'string' ? record.correlationId : '';
		const type =
			typeof record.type === 'string' ? record.type : 'about:blank';
		const rawStatus =
			typeof record.status === 'number' && Number.isFinite(record.status)
				? record.status
				: status;

		const invalidParams = Array.isArray(record.invalidParams)
			? (record.invalidParams.filter(
					(item) =>
						item &&
						typeof item === 'object' &&
						typeof (item as { field?: unknown }).field === 'string' &&
						typeof (item as { reason?: unknown }).reason === 'string',
				) as InvalidParamDetail[])
			: undefined;

		return new ApiProblemError({
			type,
			title,
			status: rawStatus,
			code,
			detail,
			instance,
			correlationId,
			...(invalidParams && invalidParams.length > 0 ? { invalidParams } : {}),
		});
	}

	return new ApiProblemError({
		type: 'about:blank',
		title: 'Erro na API',
		status,
		code: `ERR_HTTP_${status}`,
		detail: typeof body === 'string' && body.trim() ? body : fallbackMessage,
		instance: '',
		correlationId: '',
	});
}
