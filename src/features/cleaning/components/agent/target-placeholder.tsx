'use client';

import { useSearchParams } from 'next/navigation';
import { ButtonLink } from '@/components/ui/button';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Heading } from '@/components/ui/heading';
import { IconArrowLeft } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { agentTexts } from '@/features/cleaning/agent-texts';

const t = agentTexts.placeholder;

/**
 * Fiche d'une visite ou d'une séance (`/agent/visite?id=…`, `/agent/seance?id=…`) : coque provisoire,
 * remplie par la version « terrain et hors ligne » (arrivée, photos, constat, déroulé, fin).
 */
export function TargetPlaceholder({ kind }: { kind: 'visit' | 'session' }) {
  const id = useSearchParams().get('id');
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {kind === 'visit' ? t.visitTitle : t.sessionTitle}
      </Heading>
      {id ? (
        <ComingSoon title={t.soonTitle}>{t.soonText}</ComingSoon>
      ) : (
        <p className="text-ink-muted">{t.missing}</p>
      )}
      <ButtonLink
        href={navigation.agentToday.href}
        variant="secondary"
        className="w-full sm:w-auto sm:justify-self-start"
      >
        <IconArrowLeft />
        {t.back}
      </ButtonLink>
    </div>
  );
}
