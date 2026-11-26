import type { ReactNode } from 'react';
import { RequireSession } from '@/features/identity';
import { UnreadBadge } from '@/features/notification';
import { PartnerShell } from '@/features/recovery';
import { SpaceGate } from '@/features/spaces';

/**
 * Espace partenaire du Recouvrement (huissiers, avocats) : garde de session et du droit de partenaire (une
 * seule fois pour tout l'espace), puis le cadre (Dossiers, Notifications, Compte). En ligne seulement
 * (F-022) : aucune donnée du dossier n'est gardée sur l'appareil.
 */
export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <SpaceGate space="partner">
        <PartnerShell notificationBadge={<UnreadBadge />}>{children}</PartnerShell>
      </SpaceGate>
    </RequireSession>
  );
}
