'use client';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { computeSeasonalityGap } from '@/lib/scenes/sceneSelection';
import type { SceneCandidate } from '@/types/api';

export interface SeasonalityAlertProps {
	t0: SceneCandidate | null;
	t1: SceneCandidate | null;
}

export function SeasonalityAlert({ t0, t1 }: SeasonalityAlertProps) {
	if (!t0 || !t1) {
		return null;
	}

	const { minDiffDays, warning } = computeSeasonalityGap(t0.acquiredAt, t1.acquiredAt);
	const roundedDays = Math.round(minDiffDays);

	if (warning) {
		return (
			<AlertBanner
				variant="warning"
				title="Alerta de sazonalidade (> 60 dias de defasagem fenológica)"
				message={`A diferença sazonal entre as cenas T0 e T1 é de ${roundedDays} dias no ciclo anual. Comparar estação seca e estação chuvosa eleva o risco de falsos positivos por alteração fenológica natural da vegetação.`}
			/>
		);
	}

	return (
		<AlertBanner
			variant="success"
			title={`Pareamento sazonal adequado (defasagem de ${roundedDays} dias)`}
			message="O par T0 × T1 encontra-se dentro da janela fenológica recomendada (≤ 60 dias no ciclo anual), reduzindo ruído sazonal no ΔNDVI."
		/>
	);
}
