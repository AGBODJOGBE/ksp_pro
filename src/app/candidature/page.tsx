import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { ApplicationHome } from '@/features/cleaning';
import { RequireSession } from '@/features/identity';

export const metadata: Metadata = { title: navigation.application.label };

/** Candidature d'un agent du Nettoyage : accueil provisoire, le formulaire arrive à la version suivante. */
export default function ApplicationPage() {
  return (
    <RequireSession>
      <ApplicationHome />
    </RequireSession>
  );
}
