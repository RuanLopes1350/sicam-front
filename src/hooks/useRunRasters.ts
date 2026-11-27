'use client';

import { useEffect, useRef, useState } from 'react';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { fetchRunRasterBlob } from '@/lib/runs/curationService';
import type { RunRasterAssetItem, RunRasterAssetType } from '@/types/api';

export interface LoadedRasterAsset {
	objectUrl: string;
	bounds4674: [number, number, number, number];
}

export type LoadedRasterMap = Partial<Record<RunRasterAssetType, LoadedRasterAsset>>;

export function useRunRasters(
	runId: string,
	rasterAssets: readonly RunRasterAssetItem[],
	enabled: boolean,
) {
	const [rasters, setRasters] = useState<LoadedRasterMap>({});
	const [isLoadingRasters, setIsLoadingRasters] = useState(false);
	const [rasterError, setRasterError] = useState<ApiProblemError | string | null>(null);

	const assetsSignature = rasterAssets
		.map((a) => `${a.assetType}:${a.sha256}`)
		.sort()
		.join('|');
	const assetsRef = useRef(rasterAssets);
	assetsRef.current = rasterAssets;

	useEffect(() => {
		if (!enabled || !runId || assetsRef.current.length === 0) {
			setIsLoadingRasters(false);
			return;
		}

		let active = true;
		const controller = new AbortController();
		const createdUrls: string[] = [];

		setIsLoadingRasters(true);
		setRasterError(null);

		void (async () => {
			try {
				const entries = await Promise.all(
					assetsRef.current.map(async (asset) => {
						const blob = await fetchRunRasterBlob(runId, asset.assetType, {
							signal: controller.signal,
							upscale: asset.assetType === 'delta_ndvi_mask' ? 1 : 4,
						});
						const objectUrl = URL.createObjectURL(blob);
						createdUrls.push(objectUrl);
						return [
							asset.assetType,
							{
								objectUrl,
								bounds4674: asset.bounds4674,
							} satisfies LoadedRasterAsset,
						] as const;
					}),
				);

				if (!active) {
					for (const url of createdUrls) {
						URL.revokeObjectURL(url);
					}
					return;
				}

				const nextMap: LoadedRasterMap = {};
				for (const [key, val] of entries) {
					nextMap[key] = val;
				}
				setRasters(nextMap);
			} catch (err) {
				if (!active || controller.signal.aborted) {
					return;
				}
				setRasterError(
					isApiProblemError(err)
						? err
						: 'Não foi possível carregar as imagens raster autenticadas.',
				);
			} finally {
				if (active) {
					setIsLoadingRasters(false);
				}
			}
		})();

		return () => {
			active = false;
			controller.abort();
			for (const url of createdUrls) {
				URL.revokeObjectURL(url);
			}
			setRasters({});
		};
	}, [runId, enabled, assetsSignature]);

	return {
		rasters,
		isLoadingRasters,
		rasterError,
	};
}
