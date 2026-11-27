'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchRunWaybackTimeline } from '@/lib/runs/curationService';
import type { WaybackVintageItem } from '@/types/api';

export interface UseRunWaybackResult {
	vintages: WaybackVintageItem[];
	maxZoom: number;
	selectedT0ReleaseNum: number | null;
	selectedT1ReleaseNum: number | null;
	setSelectedT0ReleaseNum: (releaseNum: number | null) => void;
	setSelectedT1ReleaseNum: (releaseNum: number | null) => void;
	selectedT0Vintage: WaybackVintageItem | undefined;
	selectedT1Vintage: WaybackVintageItem | undefined;
	isLoadingWayback: boolean;
	waybackError: string | null;
}

export function useRunWayback(runId: string, enabled = true): UseRunWaybackResult {
	const [vintages, setVintages] = useState<WaybackVintageItem[]>([]);
	const [maxZoom, setMaxZoom] = useState(17);
	const [selectedT0ReleaseNum, setSelectedT0ReleaseNum] = useState<number | null>(null);
	const [selectedT1ReleaseNum, setSelectedT1ReleaseNum] = useState<number | null>(null);
	const [isLoadingWayback, setIsLoadingWayback] = useState(false);
	const [waybackError, setWaybackError] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled || !runId) {
			return;
		}

		let cancelled = false;
		setIsLoadingWayback(true);
		setWaybackError(null);

		fetchRunWaybackTimeline(runId)
			.then((res) => {
				if (cancelled) return;
				setVintages(res.vintages);
				setMaxZoom(res.maxZoom);
				setSelectedT0ReleaseNum(
					res.selectedT0?.releaseNum ?? res.vintages.at(-1)?.releaseNum ?? null,
				);
				setSelectedT1ReleaseNum(
					res.selectedT1?.releaseNum ?? res.vintages[0]?.releaseNum ?? null,
				);
			})
			.catch(() => {
				if (cancelled) return;
				setWaybackError('Não foi possível consultar o histórico Wayback de alta resolução.');
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoadingWayback(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [runId, enabled]);

	const selectedT0Vintage = useMemo(
		() => vintages.find((v) => v.releaseNum === selectedT0ReleaseNum),
		[vintages, selectedT0ReleaseNum],
	);
	const selectedT1Vintage = useMemo(
		() => vintages.find((v) => v.releaseNum === selectedT1ReleaseNum),
		[vintages, selectedT1ReleaseNum],
	);

	return {
		vintages,
		maxZoom,
		selectedT0ReleaseNum,
		selectedT1ReleaseNum,
		setSelectedT0ReleaseNum,
		setSelectedT1ReleaseNum,
		selectedT0Vintage,
		selectedT1Vintage,
		isLoadingWayback,
		waybackError,
	};
}
