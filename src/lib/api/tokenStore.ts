export type AuthTokenListener = (token: string | null) => void;
export type SessionExpiredListener = () => void;

// RNF-01 & Zero Trust: Access Token armazenado estritamente em memória RAM (nunca localStorage/sessionStorage)
let currentAccessToken: string | null = null;
let expiresAtEpochMs: number | null = null;

const tokenListeners = new Set<AuthTokenListener>();
const sessionExpiredListeners = new Set<SessionExpiredListener>();

function notifyTokenListeners(): void {
	for (const listener of tokenListeners) {
		listener(currentAccessToken);
	}
}

export function getAccessToken(): string | null {
	return currentAccessToken;
}

export function getAccessTokenExpiresAtMs(): number | null {
	return expiresAtEpochMs;
}

export function setAccessToken(token: string, expiresInSeconds?: number): void {
	currentAccessToken = token;
	expiresAtEpochMs =
		typeof expiresInSeconds === 'number' && expiresInSeconds > 0
			? Date.now() + expiresInSeconds * 1000
			: null;
	notifyTokenListeners();
}

export function clearAccessToken(): void {
	if (currentAccessToken === null && expiresAtEpochMs === null) {
		return;
	}
	currentAccessToken = null;
	expiresAtEpochMs = null;
	notifyTokenListeners();
}

export function subscribeAuthToken(listener: AuthTokenListener): () => void {
	tokenListeners.add(listener);
	return () => {
		tokenListeners.delete(listener);
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
	tokenListeners.clear();
	sessionExpiredListeners.clear();
}
