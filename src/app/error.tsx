'use client';

import { useEffect } from 'react';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button, ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { IconAlert } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';

/** Erreur d'affichage : message clair, « Réessayer » en action principale, retour aux espaces. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getDictionary();
  useEffect(() => {
    // Remonté vers l'outil de suivi des erreurs (Sentry) quand il sera branché.
    console.error(error);
  }, [error]);
  return (
    <section className="grid justify-items-start gap-4">
      <span
        aria-hidden="true"
        className="rounded-icon bg-accent text-on-accent grid size-16 place-items-center"
      >
        <IconAlert className="size-8" />
      </span>
      <Heading as="h1" size="h2">
        {t.errors.genericTitle}
      </Heading>
      <p className="text-ink-muted text-lg">{t.errors.genericText}</p>
      <BottomBar>
        <Button onClick={reset} variant="action" size="lg" className="w-full sm:w-auto">
          {t.common.retry}
        </Button>
        <ButtonLink href="/" variant="ghost" className="w-full sm:w-auto">
          {t.common.backToSpaces}
        </ButtonLink>
      </BottomBar>
    </section>
  );
}
