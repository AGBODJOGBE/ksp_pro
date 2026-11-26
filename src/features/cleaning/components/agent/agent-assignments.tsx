'use client';

import { useCallback, useState } from 'react';
import { FieldError, FormMessage, inputClasses } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { PagedListState } from '@/components/ui/paged-list-state';
import { Tabs } from '@/components/ui/tabs';
import { beninDate, beninSlot } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { usePagedList } from '@/lib/use-paged-list';
import {
  ASSIGNMENT_STATUSES,
  type AssignmentStatusFilter,
  listMyAssignments,
} from '@/features/cleaning/agent-api';
import { ASSIGNMENT_TAB, agentTexts } from '@/features/cleaning/agent-texts';
import type { Assignment } from '@/features/cleaning/schemas';
import { AssignmentCard } from './assignment-card';
import { describeError, useAgentProfile } from './use-load';

const t = agentTexts.assignments;
const PAGE_SIZE = 20;

const describe = (error: unknown) => {
  const { message, correlationId } = describeError(error);
  return correlationId ? `${message} (référence : ${correlationId})` : message;
};

interface Period {
  /** Premier jour (AAAA-MM-JJ), inclus. */
  from: string;
  /** Dernier jour (AAAA-MM-JJ), inclus. */
  to: string;
}

/** Période envoyée à la gateway : de minuit du premier jour à minuit après le dernier (heure du Bénin). */
function periodQuery(period: Period) {
  const after = beninDate(new Date(beninSlot(period.to, '12:00', '12:00').start), 1);
  return {
    from: beninSlot(period.from, '00:00', '00:00').start,
    to: beninSlot(after, '00:00', '00:00').start,
  };
}

interface ListProps {
  status?: AssignmentStatusFilter;
  period: Period;
  canRespond: boolean;
}

/** Liste d'un onglet ; relue depuis la première page quand une affectation n'attend plus de réponse. */
function ReloadableList(props: ListProps) {
  const [reloads, setReloads] = useState(0);
  return <AssignmentList key={reloads} {...props} onStale={() => setReloads((value) => value + 1)} />;
}

function AssignmentList({ status, period, canRespond, onStale }: ListProps & { onStale: () => void }) {
  const now = useNow();
  const [updated, setUpdated] = useState<Record<string, Assignment>>({});
  const load = useCallback(
    (cursor?: string) => listMyAssignments({ ...periodQuery(period), status, limit: PAGE_SIZE, cursor }),
    [period, status],
  );
  const list = usePagedList(load, describe);
  const items = list.items.map((item) => updated[item.assignmentId] ?? item);

  return (
    <PagedListState list={{ ...list, items }} labels={t} empty={<p className="text-ink">{t.empty}</p>}>
      <ul className="grid gap-3">
        {items.map((assignment) => (
          <li key={assignment.assignmentId}>
            <AssignmentCard
              assignment={assignment}
              canRespond={canRespond}
              now={now}
              showDate
              onUpdated={(next) => setUpdated((previous) => ({ ...previous, [next.assignmentId]: next }))}
              onStale={onStale}
            />
          </li>
        ))}
      </ul>
    </PagedListState>
  );
}

/**
 * « Mes affectations » : période (du… au…, 7 jours par défaut) et un onglet par statut. Un indépendant
 * répond aux affectations en attente avant l'heure indiquée ; un salarié lit seulement (confirmées
 * d'office). Liste paginée par curseur (`nextCursor`).
 */
export function AgentAssignments() {
  const profile = useAgentProfile();
  const [period, setPeriod] = useState<Period>(() => ({ from: beninDate(), to: beninDate(new Date(), 6) }));
  const [draft, setDraft] = useState<Period>(period);
  const invalid = !draft.from || !draft.to || draft.to < draft.from;
  const employmentKind = profile.state.status === 'ready' ? profile.state.data?.employmentKind : undefined;
  const canRespond = employmentKind === 'independent';

  function change(patch: Partial<Period>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (next.from && next.to && next.to >= next.from) setPeriod(next);
  }

  const statuses = ASSIGNMENT_STATUSES.filter(
    // Un salarié n'a jamais d'affectation à confirmer : l'onglet est masqué.
    (status) => status !== 'pending_confirmation' || employmentKind !== 'employee',
  );
  const tabs = [
    {
      key: 'all',
      label: t.all,
      render: () => <ReloadableList period={period} canRespond={canRespond} />,
    },
    ...statuses.map((status) => ({
      key: status,
      label: ASSIGNMENT_TAB[status],
      render: () => <ReloadableList status={status} period={period} canRespond={canRespond} />,
    })),
  ];

  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted mt-1">{t.lead}</p>
      </div>
      {employmentKind ? (
        <FormMessage tone="info">{employmentKind === 'employee' ? t.employee : t.independent}</FormMessage>
      ) : null}
      <fieldset className="grid gap-2" aria-describedby={invalid ? 'periode-erreur' : undefined}>
        <legend className="text-ink mb-2 font-semibold">{t.periodLegend}</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-small text-ink-muted">{t.from}</span>
            <input
              type="date"
              value={draft.from}
              onChange={(event) => change({ from: event.target.value })}
              className={inputClasses({ invalid })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-small text-ink-muted">{t.to}</span>
            <input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(event) => change({ to: event.target.value })}
              className={inputClasses({ invalid })}
            />
          </label>
        </div>
        {invalid ? <FieldError id="periode-erreur">{t.periodInvalid}</FieldError> : null}
      </fieldset>
      {/* Une clé par période : les onglets repartent de la première page. */}
      <div key={`${period.from}-${period.to}`} className="min-w-0">
        <Tabs label={t.tabsLabel} items={tabs} />
      </div>
    </div>
  );
}
