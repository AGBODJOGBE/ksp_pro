'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BackendPending } from '@/components/ui/backend-pending';
import { FormMessage } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { Heading } from '@/components/ui/heading';
import { IconChevronRight, IconClock } from '@/components/ui/icons';
import { SkeletonCards } from '@/components/ui/skeleton';
import { navigation } from '@/config/navigation';
import { beninDate, beninSlot, formatDate, formatTime } from '@/lib/format';
import type { Cached } from '@/lib/offline/today';
import { useNow } from '@/lib/use-now';
import { listMyAssignments } from '@/features/cleaning/agent-api';
import { agentTexts } from '@/features/cleaning/agent-texts';
import { cachePlanning, prefetchToday, readCachedPlanning } from '@/features/cleaning/field/today-cache';
import { useFieldAccount } from '@/features/cleaning/field/account';
import type { Assignment, AssignmentList } from '@/features/cleaning/schemas';
import { AssignmentCard, isInForce } from './assignment-card';
import { LoadFailure } from './states';
import { isIndependent, useAgentProfile, useLoad } from './use-load';

const t = agentTexts.today;

/** Bornes du jour au Bénin (minuit à minuit), fixées à l'ouverture de l'écran. */
function todayRange() {
  const opened = Date.now();
  const today = beninDate(new Date(opened));
  return {
    opened,
    from: beninSlot(today, '00:00', '00:00').start,
    to: beninSlot(beninDate(new Date(opened), 1), '00:00', '00:00').start,
  };
}

const loadPending = (signal: AbortSignal) =>
  listMyAssignments({ status: 'pending_confirmation', limit: 1 }, signal);

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="text-small text-ink-muted font-semibold tracking-wide uppercase">
        {title}
      </h2>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}

/**
 * « Aujourd'hui » : les interventions du jour (`GET /me/assignments`, de minuit à minuit, heure du Bénin),
 * la prochaine en tête, puis le reste de la journée, ce qui est passé, ce qui est annulé ou retiré.
 * Un indépendant y répond aux affectations en attente ; un bandeau signale celles des 7 prochains jours.
 *
 * Hors connexion (F-022) : la journée gardée sur le téléphone s'affiche d'abord (avec l'heure de sa mise à
 * jour), puis la gateway la remplace. Chaque lecture réussie est gardée, avec les fiches du jour.
 */
export function AgentToday({ aside }: { aside?: ReactNode }) {
  const now = useNow();
  const [range] = useState(todayRange);
  const profile = useAgentProfile();
  const loadToday = useCallback(
    (signal: AbortSignal) => listMyAssignments({ from: range.from, to: range.to, limit: 100 }, signal),
    [range],
  );
  const today = useLoad<AssignmentList>(loadToday);
  const pending = useLoad<AssignmentList>(loadPending);
  const userId = useFieldAccount();
  const [cached, setCached] = useState<Cached<AssignmentList> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readCachedPlanning(userId).then((copy) => {
      // Seule la journée en cours compte : une copie d'hier n'est pas montrée.
      if (active && copy && beninDate(new Date(copy.savedAt)) === beninDate(new Date(range.opened)))
        setCached(copy);
    });
    return () => {
      active = false;
    };
  }, [userId, range.opened]);

  // Journée lue : gardée sur le téléphone, avec les fiches du jour (lisibles sans réseau).
  const fresh = today.state.status === 'ready' ? today.state.data : null;
  useEffect(() => {
    if (!userId || !fresh) return;
    const controller = new AbortController();
    void cachePlanning(userId, fresh).then(() => prefetchToday(userId, fresh.data, controller.signal));
    return () => controller.abort();
  }, [userId, fresh]);
  const canRespond = isIndependent(profile.state);
  const reference = now ?? range.opened;

  const replace = (updated: Assignment) => {
    if (today.state.status !== 'ready') return;
    const list = today.state.data;
    today.set({
      ...list,
      data: list.data.map((item) => (item.assignmentId === updated.assignmentId ? updated : item)),
    });
    pending.refresh();
  };
  const stale = () => {
    today.refresh();
    pending.refresh();
  };

  const card = (assignment: Assignment, highlight = false) => (
    <li key={assignment.assignmentId}>
      <AssignmentCard
        assignment={assignment}
        canRespond={canRespond}
        now={now}
        onUpdated={replace}
        onStale={stale}
        highlight={highlight}
      />
    </li>
  );

  // Sans réponse de la gateway (chargement, réseau coupé) : la journée gardée sur le téléphone.
  const showCopy = cached && (today.state.status === 'loading' || today.state.status === 'error');
  const list: AssignmentList | null = fresh ?? (showCopy ? cached.data : null);

  let body: ReactNode;
  if (!list && today.state.status === 'loading') body = <SkeletonCards label={t.loading} rows={2} />;
  else if (!list && today.state.status === 'error')
    body = (
      <LoadFailure
        message={today.state.message}
        correlationId={today.state.correlationId}
        onRetry={today.reload}
      />
    );
  else if (!list && today.state.status === 'pending')
    body = (
      <BackendPending
        id="aujourdhui-attente"
        title={t.title}
        needs={[{ method: 'GET', path: '/api/v1/cleaning/agent/me/assignments', purpose: 'Mon planning' }]}
      >
        {t.emptyHint}
      </BackendPending>
    );
  else if (list) {
    const items = list.data;
    const active = items.filter(isInForce);
    const upcoming = active.filter((item) => Date.parse(item.end) > reference);
    const past = active.filter((item) => Date.parse(item.end) <= reference);
    const other = items.filter((item) => !isInForce(item));
    const [next, ...later] = upcoming;
    body = items.length ? (
      <div className="grid gap-8">
        {next ? (
          <Group id="aujourdhui-prochaine" title={t.next}>
            {card(next, true)}
          </Group>
        ) : null}
        {later.length ? (
          <Group id="aujourdhui-plus-tard" title={t.later}>
            {later.map((item) => card(item))}
          </Group>
        ) : null}
        {past.length ? (
          <Group id="aujourdhui-passees" title={t.done}>
            {past.map((item) => card(item))}
          </Group>
        ) : null}
        {other.length ? (
          <Group id="aujourdhui-autres" title={t.other}>
            {other.map((item) => card(item))}
          </Group>
        ) : null}
        {list.nextCursor ? (
          <Link
            href={navigation.agentAssignments.href}
            className="text-ink min-h-12 font-semibold underline underline-offset-4"
          >
            {t.more}
          </Link>
        ) : null}
      </div>
    ) : (
      <EmptyState
        title={t.empty}
        action={
          <Link
            href={navigation.agentAssignments.href}
            className="text-ink inline-flex min-h-12 items-center gap-1 font-semibold underline underline-offset-4"
          >
            {t.seeAll}
            <IconChevronRight className="size-4" />
          </Link>
        }
      >
        {t.emptyHint}
      </EmptyState>
    );
  }

  const waiting = pending.state.status === 'ready' ? pending.state.data.total : 0;
  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Heading as="h1" size="h2">
            {t.title}
          </Heading>
          <p className="text-ink-muted mt-1 text-lg first-letter:uppercase">{formatDate(range.from)}</p>
        </div>
        {aside}
      </div>
      {waiting > 0 ? (
        <Link
          href={navigation.agentAssignments.href}
          className="rounded-card border-warning bg-warning-soft text-ink focus-visible:outline-focus flex min-h-14 items-center gap-3 border-2 p-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <IconClock className="text-warning size-6 shrink-0" />
          <span className="flex-1">{t.pending(waiting)}</span>
          <span className="inline-flex items-center gap-1">
            {t.pendingLink}
            <IconChevronRight className="size-5" />
          </span>
        </Link>
      ) : null}
      {showCopy ? (
        <div className="grid justify-items-start gap-2">
          <FormMessage tone="info">
            {today.state.status === 'error'
              ? t.cachedOffline(formatTime(new Date(cached.savedAt).toISOString()))
              : t.cachedRefreshing(formatTime(new Date(cached.savedAt).toISOString()))}
          </FormMessage>
          {today.state.status === 'error' ? (
            <button
              type="button"
              onClick={today.reload}
              className="text-ink min-h-12 font-semibold underline underline-offset-4"
            >
              {agentTexts.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      {body}
    </div>
  );
}
