import { ArchitectureReadinessPanel } from '@/components/layout/ArchitectureReadinessPanel';
import { InstitutionalHeader } from '@/components/layout/InstitutionalHeader';

export default function HomePage() {
	return (
		<main className="min-h-screen bg-surface-subtle">
			<InstitutionalHeader />
			<ArchitectureReadinessPanel />
		</main>
	);
}
