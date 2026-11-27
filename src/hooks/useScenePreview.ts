'use client';

import { useEffect, useState } from 'react';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { fetchScenePreviewBlob } from '@/lib/scenes/sceneService';

export function useScenePreview(previewUrl: string | null, enabled: boolean) {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<ApiProblemError | string | null>(null);

	useEffect(() => {
		if (!enabled || !previewUrl) {
			return;
		}

		let active = true;
		let createdUrl: string | null = null;
		setIsLoading(true);
		setError(null);

		void (async () => {
			try {
				const blob = await fetchScenePreviewBlob(previewUrl);
				if (!active) {
					return;
				}
				createdUrl = URL.createObjectURL(blob);
				setObjectUrl(createdUrl);
			} catch (err) {
				if (active) {
					setError(
						isApiProblemError(err) ? err : 'Não foi possível carregar a miniatura da cena.',
					);
				}
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			active = false;
			if (createdUrl) {
				URL.revokeObjectURL(createdUrl);
			}
			setObjectUrl(null);
		};
	}, [previewUrl, enabled]);

	return { objectUrl, isLoading, error };
}
