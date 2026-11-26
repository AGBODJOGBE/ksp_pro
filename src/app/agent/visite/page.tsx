import type { Metadata } from 'next';
import { Suspense } from 'react';
import { navigation } from '@/config/navigation';
import { TargetPlaceholder } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentVisit.label };

/**
 * Fiche d'une visite des lieux (`?id=` : une seule coque statique, gardée par le service worker). Coque
 * provisoire : remplie par la version « terrain et hors ligne ».
 */
export default function AgentVisitPage() {
  return (
    <Suspense>
      <TargetPlaceholder kind="visit" />
    </Suspense>
  );
}
