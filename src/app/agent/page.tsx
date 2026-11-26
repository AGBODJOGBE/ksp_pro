import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { AgentHome } from '@/features/cleaning';
import { RequireSession } from '@/features/identity';
import { SpaceGate } from '@/features/spaces';

export const metadata: Metadata = { title: navigation.agent.label };

/** Espace agent du Nettoyage : accueil provisoire, rempli par les prochaines versions. */
export default function AgentPage() {
  return (
    <RequireSession>
      <SpaceGate space="agent">
        <AgentHome />
      </SpaceGate>
    </RequireSession>
  );
}
