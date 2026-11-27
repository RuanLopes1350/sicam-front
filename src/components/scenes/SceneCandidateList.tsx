'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import {
	SCENE_SORT_LABELS,
	type SceneSortMode,
	sortSceneCandidates,
} from '@/lib/scenes/sceneSelection';
import type { SceneCandidate } from '@/types/api';
import { SceneCandidateCard } from './SceneCandidateCard';

export interface SceneCandidateListProps {
	slot: 'T0' | 'T1';
	title: string;
	subtitle?: string;
	candidates: readonly SceneCandidate[];
	selectedKey: string | null;
	onSelect: (candidate: SceneCandidate) => void;
}

export function SceneCandidateList({
	slot,
	title,
	subtitle,
	candidates,
	selectedKey,
	onSelect,
}: SceneCandidateListProps) {
	const [sortMode, setSortMode] = useState<SceneSortMode>('aoi_cloud_asc');
	const sortedCandidates = sortSceneCandidates(candidates, sortMode);

	return (
		<Card>
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div className="space-y-1">
						<CardTitle>{title}</CardTitle>
						{subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
					</div>
					<Badge variant="neutral">
						{candidates.length} {candidates.length === 1 ? 'cena' : 'cenas'}
					</Badge>
				</div>

				<Select
					label="Ordenar por"
					value={sortMode}
					onChange={(event) => setSortMode(event.target.value as SceneSortMode)}
				>
					{(Object.keys(SCENE_SORT_LABELS) as SceneSortMode[]).map((mode) => (
						<option key={mode} value={mode}>
							{SCENE_SORT_LABELS[mode]}
						</option>
					))}
				</Select>
			</CardHeader>

			<CardContent>
				{sortedCandidates.length === 0 ? (
					<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
						Nenhuma cena encontrada nesta janela temporal.
					</div>
				) : (
					<div className="space-y-3">
						{sortedCandidates.map((candidate) => (
							<SceneCandidateCard
								key={candidate.candidateKey}
								candidate={candidate}
								slotLabel={slot}
								selected={selectedKey === candidate.candidateKey}
								onSelect={() => onSelect(candidate)}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
