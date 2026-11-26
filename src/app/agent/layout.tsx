import type { ReactNode } from 'react';
import { AgentShell } from '@/features/cleaning';
import { RequireSession } from '@/features/identity';
import { SpaceGate } from '@/features/spaces';

/**
 * Espace agent du Nettoyage : garde de session et du droit d'agent (une seule fois pour tout l'espace),
 * puis le cadre (navigation du bas sur téléphone). Chaque page rend un écran client (option A, F-005).
 * Hors connexion (F-022), l'espace s'ouvre sur les données gardées sur le téléphone.
 */
export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession allowOffline>
      <SpaceGate space="agent" allowOffline>
        <AgentShell>{children}</AgentShell>
      </SpaceGate>
    </RequireSession>
  );
}
