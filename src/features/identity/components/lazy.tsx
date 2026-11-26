'use client';

import dynamic from 'next/dynamic';

/*
 * Écrans du compte chargés à la demande (relais du portail, docs/architecture.md) : la garde de session,
 * importée par toutes les pages, ne fait pas télécharger la connexion, le profil ni le menu du compte.
 * Libellés écrits ici plutôt que lus dans le dictionnaire : ce relais est lu par toutes les pages.
 */

function Checking() {
  return (
    <p role="status" className="text-ink-muted text-center">
      Vérification de votre session…
    </p>
  );
}

function Loading() {
  return (
    <p role="status" className="text-ink-muted">
      Chargement…
    </p>
  );
}

/** Connexion (page `/connexion` seulement). */
export const LoginFlow = dynamic(() => import('./login-flow').then((module_) => module_.LoginFlow), {
  loading: Checking,
});

/** « Complétez votre profil » : rare (première connexion), jamais dans le premier chargement. */
export const ProfileForm = dynamic(() => import('./profile-form').then((module_) => module_.ProfileForm), {
  loading: Loading,
});

/** Menu du compte de l'en-tête : rien au rendu serveur (aucune session), chargé après l'affichage. */
export const AccountMenu = dynamic(() => import('./account-menu').then((module_) => module_.AccountMenu), {
  ssr: false,
});
