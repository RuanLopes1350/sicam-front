import { apiClient, type SicamApiClient, unwrapApiResult } from '@/lib/api/client';
import type {
	CreateUserBody,
	CreateUserResponse,
	UpdateUserBody,
	UpdateUserResponse,
	UsersListQuery,
	UsersListResponse,
} from '@/types/api';

/**
 * Lista contas de operadores cadastradas com filtros opcionais de papel e status.
 */
export async function listUsers(
	query?: UsersListQuery,
	client: SicamApiClient = apiClient,
): Promise<UsersListResponse> {
	const cleanQuery: UsersListQuery = {};
	if (query?.role) {
		cleanQuery.role = query.role;
	}
	if (query?.active === 'true' || query?.active === 'false') {
		cleanQuery.active = query.active;
	}

	const result = await client.GET('/api/v1/users', {
		params: {
			...(Object.keys(cleanQuery).length > 0 ? { query: cleanQuery } : {}),
		},
	});

	return unwrapApiResult(result);
}

/**
 * Cadastra novo operador com política mínima de 12 caracteres na senha.
 */
export async function createUser(
	body: CreateUserBody,
	client: SicamApiClient = apiClient,
): Promise<CreateUserResponse> {
	const normalized: CreateUserBody = {
		fullName: body.fullName.trim(),
		registrationCode: body.registrationCode.trim(),
		email: body.email.trim().toLowerCase(),
		password: body.password,
		role: body.role,
	};

	const result = await client.POST('/api/v1/users', {
		body: normalized,
	});

	return unwrapApiResult(result);
}

/**
 * Atualiza nome completo, papel RBAC ou status ativo (revogando sessões ao desativar).
 */
export async function updateUser(
	userId: string,
	body: UpdateUserBody,
	client: SicamApiClient = apiClient,
): Promise<UpdateUserResponse> {
	const patch: UpdateUserBody = {};
	if (body.fullName !== undefined) {
		patch.fullName = body.fullName.trim();
	}
	if (body.role !== undefined) {
		patch.role = body.role;
	}
	if (body.active !== undefined) {
		patch.active = body.active;
	}

	const result = await client.PATCH('/api/v1/users/{userId}', {
		params: {
			path: { userId },
		},
		body: patch,
	});

	return unwrapApiResult(result);
}
