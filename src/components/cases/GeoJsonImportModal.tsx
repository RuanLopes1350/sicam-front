'use client';

import { FileCode2, Upload } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { parseGeoJsonPolygonInput } from '@/lib/geo/aoiGeometry';
import type { AoiPolygonGeoJson } from '@/types/api';

export interface GeoJsonImportModalProps {
	open: boolean;
	onClose: () => void;
	onImport: (aoi: AoiPolygonGeoJson) => void;
}

const SAMPLE_PLACEHOLDER = `{
  "type": "Polygon",
  "coordinates": [
    [
      [-63.905, -8.765],
      [-63.890, -8.765],
      [-63.890, -8.750],
      [-63.905, -8.750],
      [-63.905, -8.765]
    ]
  ]
}`;

export function GeoJsonImportModal({
	open,
	onClose,
	onImport,
}: GeoJsonImportModalProps) {
	const [rawJson, setRawJson] = useState('');
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		setRawJson('');
		setErrorMsg(null);
	}, [open]);

	async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		setErrorMsg(null);
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			setErrorMsg('O arquivo GeoJSON excede o limite de 2 MB.');
			return;
		}
		try {
			const content = await file.text();
			setRawJson(content);
		} catch {
			setErrorMsg('Não foi possível ler o arquivo selecionado.');
		}
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMsg(null);

		if (!rawJson.trim()) {
			setErrorMsg('Cole o código GeoJSON ou carregue um arquivo .geojson / .json.');
			return;
		}

		try {
			const polygon = parseGeoJsonPolygonInput(rawJson);
			onImport(polygon);
			onClose();
		} catch (err) {
			setErrorMsg(
				err instanceof Error ? err.message : 'Falha ao interpretar o polígono GeoJSON.',
			);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Importar AOI via GeoJSON (SIRGAS 2000 / WGS84)"
			description="Aceita Polygon, Feature<Polygon> ou FeatureCollection contendo 1 polígono simples sem buracos."
			maxWidthClassName="max-w-xl"
			footer={
				<>
					<Button variant="outline" onClick={onClose}>
						Cancelar
					</Button>
					<Button type="submit" form="geojson-import-form">
						<FileCode2 className="h-4 w-4" aria-hidden="true" />
						Aplicar Polígono no Mapa
					</Button>
				</>
			}
		>
			<form id="geojson-import-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
				{errorMsg ? (
					<AlertBanner variant="error" title="GeoJSON inválido" message={errorMsg} />
				) : null}

				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-semibold text-slate-700">
						Conteúdo GeoJSON (coordenadas [longitude, latitude])
					</span>
					<div>
						<input
							ref={fileInputRef}
							type="file"
							accept=".geojson,.json,application/geo+json,application/json"
							className="sr-only"
							onChange={(event) => void handleFileChange(event)}
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => fileInputRef.current?.click()}
						>
							<Upload className="h-3.5 w-3.5" aria-hidden="true" />
							Carregar arquivo .geojson
						</Button>
					</div>
				</div>

				<textarea
					rows={10}
					value={rawJson}
					onChange={(event) => {
						setRawJson(event.target.value);
						setErrorMsg(null);
					}}
					placeholder={SAMPLE_PLACEHOLDER}
					className="block w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
				/>
			</form>
		</Modal>
	);
}
