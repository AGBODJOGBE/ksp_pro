'use client';

import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { navigation } from '@/config/navigation';
import { getDictionary } from '@/i18n';
import { grantsFromAccessToken, useSession } from '@/lib/api';
import { RefreshAccessButton } from '@/features/identity';
import { hasSpace, type Space } from '@/features/spaces/choice';
import { spacesTexts } from '@/features/spaces/texts';

/**
 * Garde d'un espace (sous `RequireSession`) : sans le droit dans le jeton, un message clair, « Actualiser
 * mes accès » et le retour au choix de l'espace, au lieu d'un écran qui échouerait sur des 403. Le
 * backend reste seul juge des droits.
 */
export function SpaceGate({ space, children }: { space: Space; children: ReactNode }) {
  const current = useSession();
  if (!current) return null;
  if (hasSpace(grantsFromAccessToken(current.accessToken), space)) return <>{children}</>;

  const t = spacesTexts.denied;
  return (
    <section aria-labelledby="acces-titre" className="grid gap-4">
      <Heading as="h1" size="h2" id="acces-titre">
        {space === 'agent' ? t.agentTitle : t.partnerTitle}
      </Heading>
      <p className="text-ink-muted text-lg">{t.text}</p>
      <RefreshAccessButton variant="action" className="sm:max-w-sm" />
      <ButtonLink
        href={navigation.home.href}
        variant="ghost"
        className="w-full sm:w-auto sm:justify-self-start"
      >
        {getDictionary().common.backToSpaces}
      </ButtonLink>
    </section>
  );
}
