import type { Metadata } from 'next';
import { Suspense } from 'react';
import { navigation } from '@/config/navigation';
import { TargetPlaceholder } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentSession.label };

/**
 * Fiche d'une séance de nettoyage (`?id=` : une seule coque statique, gardée par le service worker). Coque
 * provisoire : remplie par la version « terrain et hors ligne ».
 */
export default function AgentSessionPage() {
  return (
    <Suspense>
      <TargetPlaceholder kind="session" />
    </Suspense>
  );
}
