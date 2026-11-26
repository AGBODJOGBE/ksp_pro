import type { Metadata } from 'next';
import { Suspense } from 'react';
import { navigation } from '@/config/navigation';
import { VisitSheet } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentVisit.label };

/**
 * Fiche d'une visite des lieux (`?id=` : une seule coque statique, gardée par le service worker) : arrivée,
 * constat, photos, fin ou client absent, même sans réseau.
 */
export default function AgentVisitPage() {
  return (
    <Suspense>
      <VisitSheet />
    </Suspense>
  );
}
