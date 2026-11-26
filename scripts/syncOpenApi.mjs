import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const localSpecDir = path.join(rootDir, 'openapi');
const localSpecPath = path.join(localSpecDir, 'openapi.v1.json');
const outTypesDir = path.join(rootDir, 'src', 'types', 'generated');
const outTypesPath = path.join(outTypesDir, 'openapi.d.ts');
const siblingSpecPath = path.resolve(rootDir, '../sicam-api/openapi/openapi.v1.json');

function assertValidOpenApi31Json(rawText, sourceLabel) {
	let parsed;
	try {
		parsed = JSON.parse(rawText);
	} catch (err) {
		throw new Error(`Contrato OpenAPI inválido em ${sourceLabel}: ${err.message}`);
	}

	if (!parsed || typeof parsed.openapi !== 'string' || !parsed.openapi.startsWith('3.1')) {
		throw new Error(
			`Esperado contrato OpenAPI 3.1.x em ${sourceLabel}, recebido '${parsed?.openapi ?? 'desconhecido'}'.`,
		);
	}

	return `${JSON.stringify(parsed, null, 2)}\n`;
}

async function resolveSpecToLocalSnapshot() {
	mkdirSync(localSpecDir, { recursive: true });

	const specUrl = process.env.OPENAPI_SPEC_URL?.trim();
	if (specUrl) {
		console.log(`[api:sync] Baixando contrato OpenAPI 3.1 de ${specUrl}...`);
		const response = await fetch(specUrl, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			throw new Error(`Falha ao baixar ${specUrl}: HTTP ${response.status}`);
		}
		const normalized = assertValidOpenApi31Json(await response.text(), specUrl);
		writeFileSync(localSpecPath, normalized, 'utf8');
		return specUrl;
	}

	const configuredPath = process.env.OPENAPI_SPEC_PATH?.trim();
	const fileCandidates = configuredPath
		? [path.resolve(rootDir, configuredPath)]
		: [siblingSpecPath];

	for (const candidate of fileCandidates) {
		if (existsSync(candidate)) {
			console.log(`[api:sync] Sincronizando contrato OpenAPI 3.1 local de ${candidate}...`);
			const raw = readFileSync(candidate, 'utf8');
			const normalized = assertValidOpenApi31Json(raw, candidate);
			writeFileSync(localSpecPath, normalized, 'utf8');
			return candidate;
		}
	}

	if (existsSync(localSpecPath)) {
		console.log(`[api:sync] Utilizando snapshot versionado em ${localSpecPath}.`);
		assertValidOpenApi31Json(readFileSync(localSpecPath, 'utf8'), localSpecPath);
		return localSpecPath;
	}

	throw new Error(
		'Nenhuma fonte OpenAPI 3.1 encontrada (defina OPENAPI_SPEC_URL, OPENAPI_SPEC_PATH ou mantenha openapi/openapi.v1.json).',
	);
}

async function main() {
	const sourceUsed = await resolveSpecToLocalSnapshot();
	mkdirSync(outTypesDir, { recursive: true });

	const cliPath = path.join(rootDir, 'node_modules', 'openapi-typescript', 'bin', 'cli.js');
	if (!existsSync(cliPath)) {
		throw new Error(`CLI openapi-typescript não encontrada em ${cliPath}. Execute pnpm install primeiro.`);
	}

	console.log(`[api:sync] Gerando schema TypeScript estrito a partir de ${sourceUsed}...`);
	execFileSync(process.execPath, [cliPath, localSpecPath, '-o', outTypesPath], {
		stdio: 'inherit',
	});

	console.log(`[api:sync] Contrato tipado atualizado com sucesso em ${outTypesPath}.`);
}

main().catch((err) => {
	console.error('[api:sync] Erro:', err instanceof Error ? err.message : err);
	process.exit(1);
});
