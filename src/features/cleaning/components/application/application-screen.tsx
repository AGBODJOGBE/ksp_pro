'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconNettoyage, IconRefresh } from '@/components/ui/icons';
import { SkeletonCards } from '@/components/ui/skeleton';
import { navigation } from '@/config/navigation';
import { ApiError, grantsFromAccessToken, type Session, useSession } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatShortDate, formatTime } from '@/lib/format';
import { RefreshAccessButton } from '@/features/identity';
import { getMyAgentProfile } from '@/features/cleaning/api';
import { applicationTexts as t } from '@/features/cleaning/application/texts';
import type { AgentProfile } from '@/features/cleaning/schemas';
import { agentStatusView } from '@/features/cleaning/texts';
import { ApplicationForm } from './application-form';

/** Permission d'un agent validé, lue dans le jeton (affichage seulement : la gateway reste juge). */
const AGENT_PERMISSION = 'cleaning.session.perform';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; profile: AgentProfile | null; checkedAt: number }
  | { status: 'error'; message: string };

const describe = (error: unknown) => (error instanceof ApiError ? error.message : t.genericError);

/**
 * `/candidature` : l'état de la candidature (`GET /cleaning/agent/me`), ou le formulaire si le compte n'a
 * jamais candidaté (404 `CLEANING_AGENT_NOT_FOUND`).
 */
export function ApplicationScreen() {
  const current = useSession();
  if (!current) return null;
  return <Screen session={current} />;
}

function Screen({ session }: { session: Session }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info'; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getMyAgentProfile(controller.signal).then(
      (profile) => {
        setLoad({ status: 'ready', profile, checkedAt: Date.now() });
        setChecking(false);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad((previous) =>
          // Une actualisation qui échoue garde l'état déjà affiché, avec le message.
          previous.status === 'ready' && previous.profile
            ? previous
            : { status: 'error', message: describe(error) },
        );
        setNotice({ tone: 'info', text: describe(error) });
        setChecking(false);
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setChecking(true);
    setAttempt((value) => value + 1);
  }, []);

  if (load.status === 'loading') return <SkeletonCards label={t.loading} rows={2} />;

  if (load.status === 'error') {
    return (
      <div className="grid gap-4">
        <Heading as="h1" size="h2">
          {t.status.title}
        </Heading>
        <FormMessage>{load.message}</FormMessage>
        <Button
          size="lg"
          className="w-full sm:w-auto sm:justify-self-start"
          onClick={() => {
            setNotice(null);
            setLoad({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          {t.retry}
        </Button>
      </div>
    );
  }

  if (!load.profile) {
    return (
      <ApplicationForm
        session={session}
        onSubmitted={(profile) => {
          setNotice({ tone: 'success', text: t.sent });
          setLoad({ status: 'ready', profile, checkedAt: Date.now() });
          window.scrollTo?.({ top: 0 });
        }}
        onAlreadyRegistered={(message) => {
          setNotice({ tone: 'info', text: message });
          setLoad({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }

  return (
    <ApplicationStatus
      session={session}
      profile={load.profile}
      checkedAt={load.checkedAt}
      checking={checking}
      notice={notice}
      onCheck={() => {
        setNotice(null);
        reload();
      }}
    />
  );
}

/** Suivi de la candidature : statut, ce qu'il faut faire ensuite. Aucun motif de refus (contrat). */
export function ApplicationStatus({
  session,
  profile,
  checkedAt,
  checking,
  notice,
  onCheck,
}: {
  session: Session;
  profile: AgentProfile;
  checkedAt: number;
  checking: boolean;
  notice: { tone: 'success' | 'info'; text: string } | null;
  onCheck: () => void;
}) {
  const view = agentStatusView(profile.status);
  const isAgent = (grantsFromAccessToken(session.accessToken).permissions ?? []).includes(AGENT_PERMISSION);
  const waiting = profile.status === 'applicant' || profile.status === 'under_review';
  const accepted = profile.status === 'active';
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {t.status.title}
      </Heading>
      <FormMessage tone={notice?.tone ?? 'info'}>{notice?.text}</FormMessage>
      <section
        aria-labelledby="candidature-statut"
        className={cn(
          'rounded-card bg-surface grid gap-3 border-2 p-5 shadow-xs sm:p-6',
          accepted ? 'border-accent' : 'border-line',
        )}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={cn(
              'rounded-icon grid size-14 shrink-0 place-items-center',
              accepted ? 'bg-accent text-on-accent' : 'bg-brand text-on-brand',
            )}
          >
            <IconNettoyage className="size-7" />
          </span>
          <div className="grid min-w-0 gap-1.5">
            <Badge tone={view.tone} dot className="justify-self-start">
              {view.label}
            </Badge>
            <h2 id="candidature-statut" className="font-display text-ink text-xl leading-snug font-bold">
              {view.title}
            </h2>
            <p className="text-ink-muted">{view.text}</p>
            {profile.status === 'rejected' ? <p className="text-ink-muted">{t.status.rejectedHint}</p> : null}
            <p className="text-small text-ink-subtle">
              {t.status.sentOn(formatShortDate(profile.createdAt))}
            </p>
          </div>
        </div>
      </section>
      {accepted ? (
        isAgent ? (
          <ButtonLink href={navigation.agent.href} variant="action" size="lg" className="w-full sm:w-auto">
            {t.status.openAgent}
          </ButtonLink>
        ) : (
          <RefreshAccessButton variant="action" className="sm:max-w-sm" />
        )
      ) : null}
      {waiting ? (
        <div className="grid justify-items-start gap-2">
          <Button variant="secondary" onClick={onCheck} disabled={checking} aria-busy={checking || undefined}>
            <IconRefresh className={cn(checking && 'motion-safe:animate-spin')} />
            {checking ? t.status.checking : t.status.check}
          </Button>
          <p role="status" className="text-small text-ink-muted">
            {checking ? '' : t.status.checkedAt(formatTime(new Date(checkedAt).toISOString()))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
