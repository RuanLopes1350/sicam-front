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

export type CasesListQuery = NonNullable<paths['/api/v1/cases']['get']['parameters']['query']>;
export type CaseStatusFilter = NonNullable<CasesListQuery['status']>;

export type CaseListItem = CasesListResponse['items'][number];

export type CaseDetailResponse =
	paths['/api/v1/cases/{caseId}']['get']['responses'][200]['content']['application/json'];

export type CaseRunSummaryItem = CaseDetailResponse['runs'][number];

export type CreateCaseBody =
	paths['/api/v1/cases']['post']['requestBody']['content']['application/json'];

export type CreateCaseResponse =
	paths['/api/v1/cases']['post']['responses'][201]['content']['application/json'];

export type AoiPolygonGeoJson = CreateCaseBody['aoiGeoJson'];

export type UpdateCaseBody =
	paths['/api/v1/cases/{caseId}']['patch']['requestBody']['content']['application/json'];

export type UpdateCaseResponse =
	paths['/api/v1/cases/{caseId}']['patch']['responses'][200]['content']['application/json'];

export type TerritoryStatesResponse =
	paths['/api/v1/territories/states']['get']['responses'][200]['content']['application/json'];

export type TerritoryStateItem = TerritoryStatesResponse['items'][number];

export type TerritoryMunicipalitiesQuery = NonNullable<
	paths['/api/v1/territories/municipalities']['get']['parameters']['query']
>;

export type TerritoryMunicipalitiesResponse =
	paths['/api/v1/territories/municipalities']['get']['responses'][200]['content']['application/json'];

export type TerritoryMunicipalityItem = TerritoryMunicipalitiesResponse['items'][number];

export type SceneSearchBody =
	paths['/api/v1/cases/{caseId}/scenes/search']['post']['requestBody']['content']['application/json'];

export type SceneSearchResponse =
	paths['/api/v1/cases/{caseId}/scenes/search']['post']['responses'][200]['content']['application/json'];

export type SceneCandidate = SceneSearchResponse['t0Candidates'][number];
export type StacProvider = SceneCandidate['provider'];
export type ProviderWarning = SceneSearchResponse['providerWarnings'][number];

export type CreateRunBody =
	paths['/api/v1/cases/{caseId}/runs']['post']['requestBody']['content']['application/json'];

export type RunPresetName = CreateRunBody['presetName'];
export type CustomAlgorithmParams = NonNullable<CreateRunBody['customParams']>;
export type AnalysisPresets = SystemCapabilitiesResponse['analysis']['presets'];
export type AnalysisHardBounds = SystemCapabilitiesResponse['analysis']['hardBounds'];

export type RunDetailResponse =
	paths['/api/v1/runs/{runId}']['get']['responses'][200]['content']['application/json'];

export type RunStatus = RunDetailResponse['status'];

export type CreateRunAcceptedResponse =
	paths['/api/v1/cases/{caseId}/runs']['post']['responses'][202]['content']['application/json'];

export type RunRasterAssetItem = RunDetailResponse['rasterAssets'][number];

export type RunFeaturesResponse =
	paths['/api/v1/runs/{runId}/features']['get']['responses'][200]['content']['application/json'];

export type RunFeaturesJsonResponse = Extract<RunFeaturesResponse, { format: 'json' }>;
export type RunFeaturesGeoJsonResponse = Extract<
	RunFeaturesResponse,
	{ type: 'FeatureCollection' }
>;

export type DetectedFeatureItem = RunFeaturesJsonResponse['items'][number];
export type DetectedFeatureGeoJson = RunFeaturesGeoJsonResponse['features'][number];
export type FeatureClass = DetectedFeatureItem['featureClass'];
export type FeatureReviewStatus = DetectedFeatureItem['reviewStatus'];
export type RunRasterAssetType = RunRasterAssetItem['assetType'];
export type RunAreaSummary = RunDetailResponse['summary'];

export type RunFeaturesQuery = NonNullable<
	paths['/api/v1/runs/{runId}/features']['get']['parameters']['query']
>;

export type ReviewFeatureBody =
	paths['/api/v1/runs/{runId}/features/{featureId}/review']['patch']['requestBody']['content']['application/json'];

export type ReviewFeatureResponse =
	paths['/api/v1/runs/{runId}/features/{featureId}/review']['patch']['responses'][200]['content']['application/json'];

export type ExportMetadataResponse =
	paths['/api/v1/runs/{runId}/export']['get']['responses'][200]['content']['application/json'];

export type RequestExportBody =
	paths['/api/v1/runs/{runId}/export']['post']['requestBody']['content']['application/json'];

export type PaperFormat = NonNullable<RequestExportBody['paperFormat']>;

export type RequestExportAcceptedResponse =
	paths['/api/v1/runs/{runId}/export']['post']['responses'][202]['content']['application/json'];

export type ExportArtifactType = NonNullable<
	NonNullable<
		paths['/api/v1/exports/{exportId}/download']['get']['parameters']['query']
	>['artifact']
>;

export type IntegrityVerifyResponse =
	paths['/api/v1/integrity/verify']['post']['responses'][200]['content']['application/json'];

export type IntegrityMatchedArtifact = NonNullable<IntegrityVerifyResponse['matchedArtifact']>;
export type IntegrityVerifiedRecord = NonNullable<IntegrityVerifyResponse['record']>;

export type AuditLogsResponse =
	paths['/api/v1/audit-logs']['get']['responses'][200]['content']['application/json'];

export type AuditLogsQuery = NonNullable<
	paths['/api/v1/audit-logs']['get']['parameters']['query']
>;

export type AuditLogItem = AuditLogsResponse['items'][number];
export type AuditAction = AuditLogItem['action'];

export type UsersListResponse =
	paths['/api/v1/users']['get']['responses'][200]['content']['application/json'];

export type UserAccountItem = UsersListResponse['items'][number];

export type UsersListQuery = NonNullable<
	paths['/api/v1/users']['get']['parameters']['query']
>;

export type CreateUserBody =
	paths['/api/v1/users']['post']['requestBody']['content']['application/json'];

export type CreateUserResponse =
	paths['/api/v1/users']['post']['responses'][201]['content']['application/json'];

export type UpdateUserBody =
	paths['/api/v1/users/{userId}']['patch']['requestBody']['content']['application/json'];

export type UpdateUserResponse =
	paths['/api/v1/users/{userId}']['patch']['responses'][200]['content']['application/json'];

export type SseSnapshotEvent = components['schemas']['SseSnapshotEvent'];
export type SseProgressEvent = components['schemas']['SseProgressEvent'];
export type SseRunReadyForReviewEvent = components['schemas']['SseRunReadyForReviewEvent'];
export type SseExportFrozenEvent = components['schemas']['SseExportFrozenEvent'];
export type SseTerminalFailureEvent = components['schemas']['SseTerminalFailureEvent'];
