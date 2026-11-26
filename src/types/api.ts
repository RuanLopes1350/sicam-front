import type { components, paths } from '@/types/generated/openapi';

export type { components, paths };

export type SystemCapabilitiesResponse =
	paths['/api/v1/system/capabilities']['get']['responses'][200]['content']['application/json'];

export type HealthLiveResponse =
	paths['/api/v1/health/live']['get']['responses'][200]['content']['application/json'];

export type HealthReadyResponse =
	paths['/api/v1/health/ready']['get']['responses'][200]['content']['application/json'];

export type AuthLoginBody =
	paths['/api/v1/auth/login']['post']['requestBody']['content']['application/json'];

export type AuthLoginResponse =
	paths['/api/v1/auth/login']['post']['responses'][200]['content']['application/json'];

export type AuthenticatedOperator = AuthLoginResponse['user'];
export type OperatorRole = AuthenticatedOperator['role'];

export type AuthMeResponse =
	paths['/api/v1/auth/me']['get']['responses'][200]['content']['application/json'];

export type CasesListResponse =
	paths['/api/v1/cases']['get']['responses'][200]['content']['application/json'];

export type CaseListItem = CasesListResponse['items'][number];

export type CaseDetailResponse =
	paths['/api/v1/cases/{caseId}']['get']['responses'][200]['content']['application/json'];

export type RunDetailResponse =
	paths['/api/v1/runs/{runId}']['get']['responses'][200]['content']['application/json'];

export type RunStatus = RunDetailResponse['status'];

export type RunFeaturesResponse =
	paths['/api/v1/runs/{runId}/features']['get']['responses'][200]['content']['application/json'];

export type RunFeaturesJsonResponse = Extract<RunFeaturesResponse, { format: 'json' }>;
export type RunFeaturesGeoJsonResponse = Extract<
	RunFeaturesResponse,
	{ type: 'FeatureCollection' }
>;

export type DetectedFeatureItem = RunFeaturesJsonResponse['items'][number];

export type ExportMetadataResponse =
	paths['/api/v1/runs/{runId}/export']['get']['responses'][200]['content']['application/json'];

export type IntegrityVerifyResponse =
	paths['/api/v1/integrity/verify']['post']['responses'][200]['content']['application/json'];

export type AuditLogsResponse =
	paths['/api/v1/audit-logs']['get']['responses'][200]['content']['application/json'];

export type SseSnapshotEvent = components['schemas']['SseSnapshotEvent'];
export type SseProgressEvent = components['schemas']['SseProgressEvent'];
export type SseRunReadyForReviewEvent = components['schemas']['SseRunReadyForReviewEvent'];
export type SseExportFrozenEvent = components['schemas']['SseExportFrozenEvent'];
export type SseTerminalFailureEvent = components['schemas']['SseTerminalFailureEvent'];
