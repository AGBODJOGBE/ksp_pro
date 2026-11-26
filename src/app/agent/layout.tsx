import type { ReactNode } from 'react';
import { AgentShell } from '@/features/cleaning';
import { RequireSession } from '@/features/identity';
import { SpaceGate } from '@/features/spaces';

/**
 * Espace agent du Nettoyage : garde de session et du droit d'agent (une seule fois pour tout l'espace),
 * puis le cadre (navigation du bas sur téléphone). Chaque page rend un écran client (option A, F-005).
 */
export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <SpaceGate space="agent">
        <AgentShell>{children}</AgentShell>
      </SpaceGate>
    </RequireSession>
  );
}
