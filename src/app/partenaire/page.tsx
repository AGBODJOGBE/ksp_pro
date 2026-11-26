import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { PartnerAssignments } from '@/features/recovery';

export const metadata: Metadata = { title: navigation.partner.label };

/** « Mes dossiers » : les dossiers confiés au partenaire, par statut (en cours, retirés, terminés). */
export default function PartnerAssignmentsPage() {
  return <PartnerAssignments />;
}
