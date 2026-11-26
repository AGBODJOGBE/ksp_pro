'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Skeleton } from '@/components/ui/skeleton';
import { navigation } from '@/config/navigation';
import { getDictionary } from '@/i18n';
import { isDeletionPending, session, useSession } from '@/lib/api';
import { describeError } from '@/features/identity/errors';
import { loginHref } from '@/features/identity/return-path';
import { DeletionPending } from './deletion-pending';
import { ProfileForm } from './lazy';

type Phase = 'checking' | 'unavailable' | 'ready';

/** Page demandée, recherche comprise, pour y revenir après la connexion. */
function currentPath(pathname: string): string {
  return typeof window === 'undefined' ? pathname : `${pathname}${window.location.search}`;
}

/**
 * Garde des pages connectées. Au chargement : session en mémoire, sinon renouvellement silencieux
 * (cookie posé par la gateway). Sans session : direction la connexion, avec retour ici ensuite.
 * Profil incomplet : « Complétez votre profil » avant tout le reste. Compte en cours de suppression
 * (ADR-036) : explication et lien vers le portail. Le backend reste seul juge des droits : cette garde
 * n'évite que d'afficher un espace vide ou en erreur.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const t = getDictionary();
  const { replace } = useRouter();
  const pathname = usePathname();
  const current = useSession();
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    session.restore().then((result) => {
      if (!active) return;
      if (result.status === 'anonymous') {
        replace(loginHref(currentPath(pathname)));
      } else if (result.status === 'unavailable') {
        setError(describeError(result.error).message);
        setPhase('unavailable');
      } else {
        setPhase('ready');
      }
    });
    return () => {
      active = false;
    };
  }, [attempt, pathname, replace]);

  if (current) {
    if (isDeletionPending(current)) return <DeletionPending />;
    return current.profileIncomplete ? <ProfileForm autoFocus /> : <>{children}</>;
  }

  if (phase === 'unavailable') {
    return (
      <div className="grid gap-5">
        <FormMessage>{`${t.account.unavailable} ${error ?? ''}`.trim()}</FormMessage>
        <Button
          size="lg"
          className="w-full sm:w-auto sm:justify-self-start"
          onClick={() => {
            setPhase('checking');
            setAttempt((value) => value + 1);
          }}
        >
          {t.common.retry}
        </Button>
      </div>
    );
  }

  // Session terminée pendant la visite (déconnexion dans un autre onglet, session révoquée).
  if (phase === 'ready') {
    return (
      <div>
        <Heading as="h1" size="h2">
          {t.account.endedTitle}
        </Heading>
        <p className="text-ink-muted mt-3">{t.account.endedText}</p>
        <ButtonLink href={loginHref(currentPath(pathname))} size="lg" className="mt-6 w-full sm:w-auto">
          {navigation.login.label}
        </ButtonLink>
      </div>
    );
  }

  // Attente de la session : squelette du titre et de deux cartes, annoncé une seule fois.
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">{t.account.loading}</span>
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="rounded-card mt-2 h-24 w-full" />
      <Skeleton className="rounded-card h-24 w-full" />
    </div>
  );
}
