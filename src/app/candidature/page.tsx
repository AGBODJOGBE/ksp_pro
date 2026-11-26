import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { ApplicationScreen } from '@/features/cleaning';
import { RequireSession } from '@/features/identity';

export const metadata: Metadata = { title: navigation.application.label };

/**
 * Candidature d'un agent du Nettoyage : l'état de la candidature, ou le formulaire en étapes si le compte
 * n'a jamais candidaté. Coque statique, écran client (option A, F-005).
 */
export default function ApplicationPage() {
  return (
    <RequireSession>
      <ApplicationScreen />
    </RequireSession>
  );
}
