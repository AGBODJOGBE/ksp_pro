'use client';

import dynamic from 'next/dynamic';
import { SkeletonCards } from '@/components/ui/skeleton';

/*
 * Écrans de l'espace partenaire chargés à la demande : importer la fonctionnalité (cadre de l'espace) ne
 * fait pas télécharger ses écrans ni leurs textes. Chaque page ne charge que le sien, pendant que la
 * session se vérifie. Libellé d'attente écrit ici : ce relais est lu par plusieurs pages.
 */

function Loading() {
  return <SkeletonCards label="Chargement…" rows={2} />;
}

export const PartnerAssignments = dynamic(
  () => import('./assignment-list').then((module_) => module_.PartnerAssignments),
  { loading: Loading },
);

export const AssignmentFileScreen = dynamic(
  () => import('./assignment-file').then((module_) => module_.AssignmentFileScreen),
  { loading: Loading },
);

export const PartnerAccount = dynamic(
  () => import('./partner-account').then((module_) => module_.PartnerAccount),
  { loading: Loading },
);
