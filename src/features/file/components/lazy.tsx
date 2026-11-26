'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/*
 * Champ photo chargé à la demande : importer la fonctionnalité (dépôt d'une photo de terrain, compression)
 * ne fait pas télécharger ce composant, seulement les écrans qui l'affichent (candidature).
 */
export const PhotoField = dynamic(() => import('./photo-field').then((module_) => module_.PhotoField), {
  loading: () => <Skeleton className="rounded-card aspect-[4/3] w-full max-w-sm" />,
});
