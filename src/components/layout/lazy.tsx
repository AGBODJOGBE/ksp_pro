'use client';

import dynamic from 'next/dynamic';

/**
 * Incitation à installer l'application : rien au rendu serveur (elle dépend du navigateur), chargée après
 * l'affichage pour rester hors du premier chargement des écrans.
 */
export const InstallPrompt = dynamic(
  () => import('./install-prompt').then((module_) => module_.InstallPrompt),
  {
    ssr: false,
  },
);
