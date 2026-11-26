'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, unwrapApiResult } from '@/lib/api/client';
import { ApiProblemError, parseProblemResponse } from '@/lib/api/problemDetails';
import type { SystemCapabilitiesResponse } from '@/types/api';

export function useSystemCapabilities(enabled = true) {
	const [capabilities, setCapabilities] = useState<SystemCapabilitiesResponse | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(enabled);
	const [error, setError] = useState<ApiProblemError | null>(null);

	const load = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await apiClient.GET('/api/v1/system/capabilities');
			setCapabilities(unwrapApiResult(result));
		} catch (err) {
			setError(
				err instanceof ApiProblemError
					? err
					: parseProblemResponse(500, err instanceof Error ? err.message : null),
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!enabled) {
			setIsLoading(false);
			return;
		}
		void load();
	}, [enabled, load]);

	return { capabilities, isLoading, error, reload: load };
}
