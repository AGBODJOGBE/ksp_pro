'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { BottomBar } from '@/components/ui/bottom-bar';
import { ButtonArrow, ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { IconCheck, IconChevronRight, IconInvitation } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { useSession } from '@/lib/api';
import {
  isInvitationId,
  keepInvitation,
  readInvitation,
  subscribeInvitation,
} from '@/features/cleaning/invitation';
import { cleaningTexts } from '@/features/cleaning/texts';

/**
 * Lien d'invitation d'un agent : explique qu'il faut se connecter avec le numéro invité, et garde
 * l'invitation sur l'appareil pour la candidature. Aucune lecture de l'invitation : la route n'existe
 * pas, la gateway la vérifiera à l'envoi de la candidature.
 */
export function InvitationWelcome({ id }: { id: string }) {
  const t = cleaningTexts.invitation;
  const connected = useSession() !== null;
  const valid = isInvitationId(id);
  const kept = useSyncExternalStore(
    subscribeInvitation,
    () => valid && readInvitation() === id.toLowerCase(),
    () => false,
  );

  // Garde l'invitation sur l'appareil (système extérieur) ; l'écran suit le stockage.
  useEffect(() => {
    if (valid) keepInvitation(id);
  }, [id, valid]);

  if (!valid) {
    return (
      <section aria-labelledby="invitation-titre" className="grid gap-3">
        <Heading as="h1" size="h2" id="invitation-titre">
          {t.invalidTitle}
        </Heading>
        <p className="text-ink-muted">{t.invalidText}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="invitation-titre">
      <span
        aria-hidden="true"
        className="rounded-icon bg-accent text-on-accent pop grid size-16 place-items-center"
      >
        <IconInvitation className="size-8" />
      </span>
      <Heading as="h1" size="h2" id="invitation-titre" className="mt-5">
        {t.title}
      </Heading>
      <p className="text-ink mt-3 text-lg">{t.text}</p>
      <p className="text-ink-muted mt-2">{t.validity}</p>
      <p role="status" className="text-action-ink mt-4 flex items-center gap-2 font-semibold empty:hidden">
        {kept ? (
          <>
            <IconCheck className="size-5" />
            {t.kept}
          </>
        ) : null}
      </p>
      <BottomBar>
        <ButtonLink
          href={navigation.application.href}
          variant="action"
          size="lg"
          className="w-full sm:w-auto"
        >
          {connected ? t.continue : t.signIn}
          <ButtonArrow>
            <IconChevronRight />
          </ButtonArrow>
        </ButtonLink>
      </BottomBar>
    </section>
  );
}
