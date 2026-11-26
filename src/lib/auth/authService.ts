import {
	apiClient,
	createSicamApiClient,
	type CreateSicamApiClientOptions,
	refreshSessionSingleFlight,
	type SicamApiClient,
	unwrapApiResult,
} from '@/lib/api/client';
import {
	clearAccessToken,
	getStoredOperator,
	setAuthSession,
	updateStoredOperator,
} from '@/lib/api/tokenStore';
import type {
	AuthenticatedOperator,
	AuthLoginBody,
	AuthLoginResponse,
} from '@/types/api';

export async function loginWithCredentials(
	credentials: AuthLoginBody,
	client: SicamApiClient = apiClient,
): Promise<AuthLoginResponse> {
	const result = await client.POST('/api/v1/auth/login', {
		body: {
			email: credentials.email.trim().toLowerCase(),
			password: credentials.password,
		},
	});

	const data = unwrapApiResult(result);
	setAuthSession({
		accessToken: data.accessToken,
		expiresInSeconds: data.expiresInSeconds,
		user: data.user,
	});
	return data;
}

export async function fetchCurrentProfile(
	client: SicamApiClient = apiClient,
): Promise<AuthenticatedOperator> {
	const result = await client.GET('/api/v1/auth/me');
	const user = unwrapApiResult(result);
	updateStoredOperator(user);
	return user;
}

export async function restoreSessionFromCookie(
	options?: CreateSicamApiClientOptions,
): Promise<{ accessToken: string; user: AuthenticatedOperator } | null> {
	const accessToken = await refreshSessionSingleFlight(options);
	if (!accessToken) {
		return null;
	}

	const storedUser = getStoredOperator();
	if (storedUser) {
		return { accessToken, user: storedUser };
	}

	try {
		const client = options ? createSicamApiClient(options) : apiClient;
		const user = await fetchCurrentProfile(client);
		return { accessToken, user };
	} catch {
		clearAccessToken();
		return null;
	}
}

export async function logoutSession(client: SicamApiClient = apiClient): Promise<void> {
	try {
		await client.POST('/api/v1/auth/logout');
	} catch {
		// Mesmo se o token já estiver expirado ou revogado no servidor, a sessão local em RAM é encerrada
	} finally {
		clearAccessToken();
	}
}
