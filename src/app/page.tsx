import type { Metadata } from 'next';
import { RequireSession } from '@/features/identity';
import { SpaceChooser } from '@/features/spaces';

export const metadata: Metadata = { title: 'Mes espaces' };

/**
 * Choix de l'espace (adresse de départ de l'application installée) : coque statique, choix dans un
 * composant client d'après le jeton et la gateway (F-005, option A).
 */
export default function HomePage() {
  return (
    <RequireSession>
      <SpaceChooser />
    </RequireSession>
  );
}
