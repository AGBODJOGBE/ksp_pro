import type { Metadata } from 'next';
import { Suspense } from 'react';
import { partnerNavigation } from '@/config/partner-navigation';
import { AssignmentFileScreen } from '@/features/recovery';

export const metadata: Metadata = { title: partnerNavigation.file.label };

/**
 * Fiche d'un dossier confié (`?id=` : une seule coque statique). Chaque ouverture est inscrite au journal
 * d'audit du back : une seule lecture, jamais préchargée. Formulaires de l'acte et de l'encaissement dans
 * la même page (`&action=`).
 */
export default function PartnerFilePage() {
  return (
    <Suspense>
      <AssignmentFileScreen />
    </Suspense>
  );
}
