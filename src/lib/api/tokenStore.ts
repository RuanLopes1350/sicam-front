import type { AuthenticatedOperator } from '@/types/api';

export type AuthTokenListener = (token: string | null) => void;
export type SessionExpiredListener = () => void;
export type AuthSessionListener = () => void;

// RNF-01 & Zero Trust: Access Token e perfil armazenados estritamente em memória RAM (nunca localStorage/sessionStorage)
let currentAccessToken: string | null = null;
let expiresAtEpochMs: number | null = null;
let currentOperator: AuthenticatedOperator | null = null;

const tokenListeners = new Set<AuthTokenListener>();
const sessionExpiredListeners = new Set<SessionExpiredListener>();
const sessionListeners = new Set<AuthSessionListener>();

function notifyTokenListeners(): void {
	for (const listener of tokenListeners) {
		listener(currentAccessToken);
	}
}

function notifySessionListeners(): void {
	for (const listener of sessionListeners) {
		listener();
	}
}

export function getAccessToken(): string | null {
	return currentAccessToken;
}

export function getAccessTokenExpiresAtMs(): number | null {
	return expiresAtEpochMs;
}

export function getStoredOperator(): AuthenticatedOperator | null {
	return currentOperator;
}

export function setAccessToken(token: string, expiresInSeconds?: number): void {
	currentAccessToken = token;
	expiresAtEpochMs =
		typeof expiresInSeconds === 'number' && expiresInSeconds > 0
			? Date.now() + expiresInSeconds * 1000
			: null;
	notifyTokenListeners();
	notifySessionListeners();
}

export function setAuthSession(params: {
	accessToken: string;
	expiresInSeconds?: number;
	user: AuthenticatedOperator;
}): void {
	currentAccessToken = params.accessToken;
	expiresAtEpochMs =
		typeof params.expiresInSeconds === 'number' && params.expiresInSeconds > 0
			? Date.now() + params.expiresInSeconds * 1000
			: null;
	currentOperator = params.user;
	notifyTokenListeners();
	notifySessionListeners();
}

export function updateStoredOperator(user: AuthenticatedOperator | null): void {
	currentOperator = user;
	notifySessionListeners();
}

export function clearAccessToken(): void {
	if (currentAccessToken === null && expiresAtEpochMs === null && currentOperator === null) {
		return;
	}
	currentAccessToken = null;
	expiresAtEpochMs = null;
	currentOperator = null;
	notifyTokenListeners();
	notifySessionListeners();
}

export function subscribeAuthToken(listener: AuthTokenListener): () => void {
	tokenListeners.add(listener);
	return () => {
		tokenListeners.delete(listener);
	};
}

export function subscribeAuthSession(listener: AuthSessionListener): () => void {
	sessionListeners.add(listener);
	return () => {
		sessionListeners.delete(listener);
	};
}

export function onSessionExpired(listener: SessionExpiredListener): () => void {
	sessionExpiredListeners.add(listener);
	return () => {
		sessionExpiredListeners.delete(listener);
	};
}

export function notifySessionExpired(): void {
	clearAccessToken();
	for (const listener of sessionExpiredListeners) {
		listener();
	}
}

export function resetTokenStoreForTesting(): void {
	currentAccessToken = null;
	expiresAtEpochMs = null;
	currentOperator = null;
	tokenListeners.clear();
	sessionExpiredListeners.clear();
	sessionListeners.clear();
}
