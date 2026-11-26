'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceCard } from '@/components/ui/choice-card';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconArrowUpRight, IconNettoyage, IconRecouvrement } from '@/components/ui/icons';
import { SkeletonCards } from '@/components/ui/skeleton';
import { navigation } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { getDictionary } from '@/i18n';
import { ApiError, grantsFromAccessToken, type Session, useSession } from '@/lib/api';
import { type AgentProfile, agentStatusView, cleaningTexts, getMyAgentProfile } from '@/features/cleaning';
import { RefreshAccessButton } from '@/features/identity';
import { chooseSpace, type Space } from '@/features/spaces/choice';
import { spacesTexts } from '@/features/spaces/texts';

const SPACE_HREF: Record<Space, string> = {
  agent: navigation.agent.href,
  partner: navigation.partner.href,
};

/**
 * Choix de l'espace (`/`), sous la garde de session : un seul espace s'ouvre directement ; agent et
 * partenaire, deux grandes cartes ; sinon, l'état de la candidature d'agent, ou « Devenir agent KSP ».
 * Le choix suit le jeton en mémoire : « Actualiser mes accès » le refait avec le nouveau jeton.
 */
export function SpaceChooser() {
  const current = useSession();
  if (!current) return null;
  return <Chooser session={current} />;
}

function Chooser({ session }: { session: Session }) {
  const { replace } = useRouter();
  const choice = useMemo(
    () => chooseSpace(grantsFromAccessToken(session.accessToken)),
    [session.accessToken],
  );
  const t = spacesTexts;
  const single = choice.kind === 'open' ? SPACE_HREF[choice.space] : null;
  // Candidature acceptée : actualiser les accès devient l'action principale de l'écran.
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (single) replace(single);
  }, [replace, single]);

  if (single) {
    return (
      <p role="status" className="text-ink-muted">
        {t.opening}
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.greeting(session.user.firstName)}
        </Heading>
        <p className="text-ink-muted mt-2 text-lg">{choice.kind === 'both' ? t.chooseLead : t.noSpaceLead}</p>
      </div>
      {choice.kind === 'both' ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <ChoiceCard
              href={SPACE_HREF.agent}
              title={t.agent.title}
              text={t.agent.text}
              icon={<IconNettoyage className="size-7" />}
            />
          </li>
          <li>
            <ChoiceCard
              href={SPACE_HREF.partner}
              title={t.partner.title}
              text={t.partner.text}
              icon={<IconRecouvrement className="size-7" />}
            />
          </li>
        </ul>
      ) : (
        // Clé : un nouveau jeton (accès actualisés) relit la candidature.
        <Application key={session.accessToken} onAccepted={setAccepted} />
      )}
      <div className="border-line grid gap-3 border-t pt-5">
        <p className="text-ink-muted">{t.accessHint}</p>
        <RefreshAccessButton variant={accepted ? 'action' : 'secondary'} className="sm:max-w-sm" />
      </div>
    </div>
  );
}

type Load =
  | { status: 'loading' }
  | { status: 'ready'; profile: AgentProfile | null }
  | { status: 'error'; message: string };

/** État de la candidature d'agent (`GET /cleaning/agent/me`), ou « Devenir agent KSP ». */
function Application({ onAccepted }: { onAccepted: (accepted: boolean) => void }) {
  const { common, login } = getDictionary();
  const t = spacesTexts;
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getMyAgentProfile(controller.signal)
      .then((profile) => {
        setLoad({ status: 'ready', profile });
        onAccepted(profile ? agentStatusView(profile.status).suggestRefresh === true : false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof ApiError ? error.message : login.genericError;
        setLoad({ status: 'error', message: `${t.loadError} ${message}` });
      });
    return () => controller.abort();
  }, [attempt, login.genericError, onAccepted, t.loadError]);

  if (load.status === 'loading') return <SkeletonCards label={t.checking} rows={1} />;

  if (load.status === 'error') {
    return (
      <div className="grid gap-3">
        <FormMessage>{load.message}</FormMessage>
        <Button
          size="lg"
          className="w-full sm:w-auto sm:justify-self-start"
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          {common.retry}
        </Button>
      </div>
    );
  }

  const { profile } = load;
  if (!profile) {
    return (
      <div className="grid gap-3">
        <ChoiceCard
          href={navigation.application.href}
          title={cleaningTexts.becomeAgent.title}
          text={cleaningTexts.becomeAgent.text}
          icon={<IconNettoyage className="size-7" />}
          highlight
        />
        <CustomerHint />
      </div>
    );
  }

  const view = agentStatusView(profile.status);
  return (
    <div className="grid gap-3">
      <ChoiceCard
        href={navigation.application.href}
        title={view.title}
        text={view.text}
        icon={<IconNettoyage className="size-7" />}
        badge={
          <Badge tone={view.tone} dot>
            {view.label}
          </Badge>
        }
        highlight={view.suggestRefresh}
      />
    </div>
  );
}

function CustomerHint() {
  const t = spacesTexts;
  return (
    <p className="text-ink-muted">
      {t.customerTitle}{' '}
      <a
        href={siteConfig.portailUrl}
        className="text-ink inline-flex min-h-12 items-center gap-1 font-semibold underline underline-offset-4"
      >
        {t.customerLink}
        <IconArrowUpRight className="size-4" />
      </a>
    </p>
  );
}
