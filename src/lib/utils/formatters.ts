export function formatAreaHa(areaHa: number | null | undefined, decimals = 2): string {
	if (areaHa === null || areaHa === undefined || !Number.isFinite(areaHa)) {
		return '—';
	}
	return `${areaHa.toLocaleString('pt-BR', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	})} ha`;
}

export function formatScale(scaleDenominator: number | null | undefined): string {
	if (
		scaleDenominator === null ||
		scaleDenominator === undefined ||
		!Number.isFinite(scaleDenominator) ||
		scaleDenominator <= 0
	) {
		return '—';
	}
	return `1:${Math.round(scaleDenominator).toLocaleString('pt-BR')}`;
}

export function truncateSha256(hash: string | null | undefined, head = 12, tail = 8): string {
	if (!hash) {
		return '—';
	}
	const clean = hash.trim();
	if (clean.length <= head + tail + 3) {
		return clean;
	}
	return `${clean.slice(0, head)}...${clean.slice(-tail)}`;
}

export function formatDateTimePtBr(isoString: string | null | undefined): string {
	if (!isoString) {
		return '—';
	}
	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) {
		return '—';
	}
	return date.toLocaleString('pt-BR', {
		timeZone: 'UTC',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

export function formatBytesPtBr(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
		return '—';
	}
	if (bytes === 0) {
		return '0 B';
	}
	if (bytes < 1024) {
		return `${Math.round(bytes)} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} KB`;
	}
	return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`;
}
