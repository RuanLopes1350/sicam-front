function resolveApiBaseUrl(raw: string | undefined): string {
	if (raw === undefined) {
		return 'http://localhost:3333';
	}
	const trimmed = raw.trim();
	if (trimmed === '') {
		// Permite caminho relativo sob mesmo domínio quando servido via Traefik v3 (ADR-08)
		return '';
	}
	return trimmed.replace(/\/+$/, '');
}

export const clientEnv = {
	API_BASE_URL: resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
} as const;
