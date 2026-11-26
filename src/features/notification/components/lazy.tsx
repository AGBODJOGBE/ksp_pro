'use client';

import dynamic from 'next/dynamic';
import { SkeletonCards } from '@/components/ui/skeleton';

/*
 * Écrans des notifications chargés à la demande : importer la fonctionnalité ne fait pas télécharger ses
 * écrans ni ses textes.
 */

/** Sans état de chargement : la pastille apparaît dès qu'elle est prête, sans décaler la page. */
export const NotificationBell = dynamic(() =>
  import('./notification-bell').then((module_) => module_.NotificationBell),
);

export const NotificationCenter = dynamic(
  () => import('./notification-center').then((module_) => module_.NotificationCenter),
  { loading: () => <SkeletonCards label="Chargement…" rows={2} /> },
);
