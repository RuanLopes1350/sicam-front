'use client';

import { FileCheck2 } from 'lucide-react';
import { useState } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { IntegrityResultCard } from '@/components/integrity/IntegrityResultCard';
import { IntegrityVerifierForm } from '@/components/integrity/IntegrityVerifierForm';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { type ApiProblemError, isApiProblemError } from '@/lib/api/problemDetails';
import { verifyIntegrityByFile, verifyIntegrityByHash } from '@/lib/integrity/integrityService';
import type { IntegrityVerifyResponse } from '@/types/api';

function IntegrityContent() {
	const [isVerifying, setIsVerifying] = useState(false);
	const [result, setResult] = useState<IntegrityVerifyResponse | null>(null);
	const [problem, setProblem] = useState<ApiProblemError | null>(null);
	const [genericError, setGenericError] = useState<string | null>(null);

	async function handleVerifyFile(file: File) {
		setIsVerifying(true);
		setResult(null);
		setProblem(null);
		setGenericError(null);

		try {
			const response = await verifyIntegrityByFile(file, { fileName: file.name });
			setResult(response);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setGenericError('Não foi possível concluir a verificação do arquivo enviado.');
			}
		} finally {
			setIsVerifying(false);
		}
	}

	async function handleVerifyHash(sha256: string) {
		setIsVerifying(true);
		setResult(null);
		setProblem(null);
		setGenericError(null);

		try {
			const response = await verifyIntegrityByHash(sha256);
			setResult(response);
		} catch (err) {
			if (isApiProblemError(err)) {
				setProblem(err);
			} else {
				setGenericError('Não foi possível consultar o código SHA-256 na base oficial.');
			}
		} finally {
			setIsVerifying(false);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
					<FileCheck2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
					Verificação de Integridade Criptográfica SHA-256
				</h1>
				<p className="text-sm text-slate-600">
					Validação oficial de autenticidade para Cartas-Imagem PDF e Pacotes Técnicos .zip emitidos pelo SICAM (RF-32).
				</p>
			</div>

			{problem ? <AlertBanner problem={problem} /> : null}
			{genericError ? (
				<AlertBanner
					variant="error"
					title="Falha na verificação de integridade"
					message={genericError}
				/>
			) : null}

			<IntegrityVerifierForm
				isVerifying={isVerifying}
				onVerifyFile={(file) => void handleVerifyFile(file)}
				onVerifyHash={(sha256) => void handleVerifyHash(sha256)}
			/>

			{result ? <IntegrityResultCard result={result} /> : null}
		</div>
	);
}

export default function IntegrityPage() {
	return (
		<RequireAuth allowedRoles={['analyst', 'auditor', 'admin']}>
			<IntegrityContent />
		</RequireAuth>
	);
}
