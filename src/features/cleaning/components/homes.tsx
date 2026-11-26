'use client';

import { useSyncExternalStore } from 'react';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Heading } from '@/components/ui/heading';
import { IconInvitation } from '@/components/ui/icons';
import { readInvitation, subscribeInvitation } from '@/features/cleaning/invitation';
import { cleaningTexts } from '@/features/cleaning/texts';

/** Accueil provisoire de l'espace agent : ce qui arrive avec les prochaines versions. */
export function AgentHome() {
  const t = cleaningTexts.agentHome;
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {t.title}
      </Heading>
      <ComingSoon title={t.soonTitle} items={t.soonItems}>
        {t.soonText}
      </ComingSoon>
    </div>
  );
}

/** Accueil provisoire de la candidature : le formulaire arrive, l'invitation reçue est gardée. */
export function ApplicationHome() {
  const t = cleaningTexts.applicationHome;
  // Lu dans l'onglet après l'hydratation (rien au rendu serveur).
  const invitation = useSyncExternalStore(subscribeInvitation, readInvitation, () => null);
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {t.title}
      </Heading>
      {invitation ? (
        <p className="rounded-card border-accent bg-accent-soft text-ink flex items-start gap-3 border-2 p-4 font-semibold">
          <IconInvitation className="text-accent-ink mt-0.5 size-6" />
          {t.invitationKept}
        </p>
      ) : null}
      <ComingSoon title={t.soonTitle}>{t.soonText}</ComingSoon>
    </div>
  );
}
