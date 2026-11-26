'use client';

import {
	createContext,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { refreshSessionSingleFlight } from '@/lib/api/client';
import { ApiProblemError, parseProblemResponse } from '@/lib/api/problemDetails';
import {
	getAccessToken,
	getAccessTokenExpiresAtMs,
	getStoredOperator,
	onSessionExpired,
	subscribeAuthSession,
} from '@/lib/api/tokenStore';
import {
	fetchCurrentProfile,
	loginWithCredentials,
	logoutSession,
	restoreSessionFromCookie,
} from '@/lib/auth/authService';
import type { AuthenticatedOperator, AuthLoginBody } from '@/types/api';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
	status: AuthStatus;
	user: AuthenticatedOperator | null;
	sessionExpiredNotice: string | null;
	login: (credentials: AuthLoginBody) => Promise<AuthenticatedOperator>;
	logout: () => Promise<void>;
	refreshProfile: () => Promise<AuthenticatedOperator>;
	dismissExpiredNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const SILENT_REFRESH_LEAD_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

export function AuthProvider({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<AuthStatus>(() =>
		getAccessToken() && getStoredOperator() ? 'authenticated' : 'initializing',
	);
	const [user, setUser] = useState<AuthenticatedOperator | null>(() => getStoredOperator());
	const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

	useEffect(() => {
		let active = true;

		const unsubscribeExpired = onSessionExpired(() => {
			if (!active) return;
			setUser(null);
			setStatus('unauthenticated');
			setSessionExpiredNotice(
				'Sua sessão expirou ou foi revogada. Autentique-se novamente para continuar.',
			);
		});

		const unsubscribeSession = subscribeAuthSession(() => {
			if (!active) return;
			const nextUser = getStoredOperator();
			const nextToken = getAccessToken();
			if (nextToken && nextUser) {
				setUser(nextUser);
				setStatus('authenticated');
			}
		});

		const existingToken = getAccessToken();
		const existingUser = getStoredOperator();
		if (existingToken && existingUser) {
			setUser(existingUser);
			setStatus('authenticated');
		} else {
			void restoreSessionFromCookie().then((restored) => {
				if (!active) return;
				if (restored) {
					setUser(restored.user);
					setStatus('authenticated');
					setSessionExpiredNotice(null);
				} else {
					setUser(null);
					setStatus('unauthenticated');
				}
			});
		}

		return () => {
			active = false;
			unsubscribeExpired();
			unsubscribeSession();
		};
	}, []);

	useEffect(() => {
		if (status !== 'authenticated' || !user) {
			return;
		}

		const expiresAt = getAccessTokenExpiresAtMs();
		if (!expiresAt) {
			return;
		}

		const delayMs = Math.max(MIN_REFRESH_DELAY_MS, expiresAt - Date.now() - SILENT_REFRESH_LEAD_MS);
		const timerId = window.setTimeout(() => {
			void refreshSessionSingleFlight().then((newToken) => {
				if (newToken) {
					const updatedUser = getStoredOperator();
					if (updatedUser) {
						setUser(updatedUser);
					}
				}
			});
		}, delayMs);

		return () => {
			window.clearTimeout(timerId);
		};
	}, [status, user]);

	const login = useCallback(async (credentials: AuthLoginBody): Promise<AuthenticatedOperator> => {
		try {
			const response = await loginWithCredentials(credentials);
			setUser(response.user);
			setStatus('authenticated');
			setSessionExpiredNotice(null);
			return response.user;
		} catch (err) {
			if (err instanceof ApiProblemError) {
				throw err;
			}
			throw parseProblemResponse(
				500,
				err instanceof Error ? err.message : 'Erro ao autenticar operador.',
			);
		}
	}, []);

	const logout = useCallback(async (): Promise<void> => {
		await logoutSession();
		setUser(null);
		setStatus('unauthenticated');
		setSessionExpiredNotice(null);
	}, []);

	const refreshProfile = useCallback(async (): Promise<AuthenticatedOperator> => {
		const freshUser = await fetchCurrentProfile();
		setUser(freshUser);
		return freshUser;
	}, []);

	const dismissExpiredNotice = useCallback(() => {
		setSessionExpiredNotice(null);
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({
			status,
			user,
			sessionExpiredNotice,
			login,
			logout,
			refreshProfile,
			dismissExpiredNotice,
		}),
		[status, user, sessionExpiredNotice, login, logout, refreshProfile, dismissExpiredNotice],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
