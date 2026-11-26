'use client';

import { useId } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { IconAlert } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { RefreshAccessButton } from '@/features/identity';
import { recoveryTexts } from '@/features/recovery/texts';

const t = recoveryTexts.denied;

/**
 * Refus de la gateway (403) sur une route du partenaire. En réel aujourd'hui (prérequis back B1) : les
 * routes `/recovery/partner/*` sont contrôlées sur les rôles du jeton, qui ne portent que `customer` sur le
 * web. Message clair, « Actualiser mes accès » (un rôle donné par KSP n'entre dans le jeton qu'à son
 * renouvellement), puis « Réessayer » (nouvelle lecture, demandée par la personne).
 */
export function AccessDenied({
  onRetry,
  headingLevel = 'h1',
}: {
  onRetry?: () => void;
  headingLevel?: 'h1' | 'h2';
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-panel border-line bg-surface grid gap-4 border p-5 shadow-xs sm:p-7"
    >
      <span
        aria-hidden="true"
        className="bg-warning-soft text-warning grid size-12 place-items-center rounded-full"
      >
        <IconAlert className="size-6" />
      </span>
      <Heading as={headingLevel} size="h2" id={titleId}>
        {t.title}
      </Heading>
      <p className="text-ink-muted text-lg">{t.text}</p>
      <RefreshAccessButton variant="action" className="sm:max-w-sm" />
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {recoveryTexts.retry}
          </Button>
        ) : null}
        <ButtonLink href={navigation.home.href} variant="ghost">
          {t.back}
        </ButtonLink>
      </div>
    </section>
  );
}
