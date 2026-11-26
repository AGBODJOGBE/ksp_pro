'use client';

import { useCallback, useState } from 'react';
import { Heading } from '@/components/ui/heading';
import { PagedListState } from '@/components/ui/paged-list-state';
import { Tabs } from '@/components/ui/tabs';
import { usePagedList } from '@/lib/use-paged-list';
import { ASSIGNMENT_STATUSES, type AssignmentStatus, listMyAssignments } from '@/features/recovery/api';
import { readProblem, withReference } from '@/features/recovery/errors';
import { recoveryTexts } from '@/features/recovery/texts';
import { AccessDenied } from './access-denied';
import { AssignmentCard } from './assignment-card';

const t = recoveryTexts.list;

const describe = (error: unknown) => {
  const problem = readProblem(error);
  return problem.kind === 'other'
    ? withReference(problem.message, problem.correlationId)
    : 'message' in problem
      ? problem.message
      : recoveryTexts.genericError;
};

/** Liste d'un onglet, page par page (curseur, « Voir plus », sans total) ; 403 : accès pas encore actif. */
function AssignmentTab({ status }: { status: AssignmentStatus }) {
  const [forbidden, setForbidden] = useState(false);
  const load = useCallback(
    async (cursor?: string) => {
      try {
        return await listMyAssignments(status, cursor);
      } catch (error) {
        if (readProblem(error).kind === 'forbidden') setForbidden(true);
        throw error;
      }
    },
    [status],
  );
  const list = usePagedList(load, describe);

  if (forbidden)
    return (
      <AccessDenied
        headingLevel="h2"
        onRetry={() => {
          setForbidden(false);
          list.retry();
        }}
      />
    );
  return (
    <PagedListState list={list} labels={t} empty={<p className="text-ink">{t.empty[status]}</p>}>
      <ul className="grid gap-3">
        {list.items.map((assignment) => (
          <li key={assignment.id}>
            <AssignmentCard assignment={assignment} />
          </li>
        ))}
      </ul>
    </PagedListState>
  );
}

/**
 * « Mes dossiers » : les dossiers confiés au partenaire, un onglet par statut (en cours, retirés, terminés).
 * Seuls les dossiers en cours s'ouvrent ; leur fiche n'est jamais préchargée (lecture tracée par le back).
 */
export function PartnerAssignments() {
  const tabs = ASSIGNMENT_STATUSES.map((status) => ({
    key: status,
    label: t.tabs[status],
    render: () => <AssignmentTab status={status} />,
  }));
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted mt-1">{t.lead}</p>
      </div>
      <div className="min-w-0">
        <Tabs label={t.tabsLabel} items={tabs} />
      </div>
    </div>
  );
}
