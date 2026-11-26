import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { IconChevronRight } from '@/components/ui/icons';
import { partnerFileHref } from '@/config/partner-navigation';
import { formatShortDate } from '@/lib/format';
import type { LegalAct, PartnerAssignment } from '@/features/recovery/schemas';
import { ACT_TYPE_LABELS, ASSIGNMENT_STATUS, labelOf, recoveryTexts } from '@/features/recovery/texts';

const t = recoveryTexts.list;

/** Acte le plus récent (date de l'acte, puis date d'enregistrement) : affichage seulement. */
export function latestAct(acts: ReadonlyArray<LegalAct>): LegalAct | null {
  return acts.reduce<LegalAct | null>((latest, act) => {
    if (!latest) return act;
    if (act.actDate !== latest.actDate) return act.actDate > latest.actDate ? act : latest;
    return act.recordedAt > latest.recordedAt ? act : latest;
  }, null);
}

/** Date du contrat (`AAAA-MM-JJ`) affichée en toutes lettres, sans décalage de fuseau. */
export function formatDay(day: string): string {
  return formatShortDate(`${day}T12:00:00+01:00`);
}

/**
 * Carte d'un dossier confié : numéro, état, date d'assignation, nombre d'actes et dernier acte. En cours :
 * la carte ouvre la fiche (jamais préchargée : chaque ouverture est inscrite au journal d'audit du back).
 * Retiré ou terminé : la fiche répond 404, la carte seule est montrée, avec l'explication.
 * Le contrat ne donne ni le débiteur principal ni le reste dû dans la liste (écart signalé au back).
 */
export function AssignmentCard({ assignment }: { assignment: PartnerAssignment }) {
  const status = ASSIGNMENT_STATUS[assignment.status] ?? {
    label: assignment.status,
    tone: 'neutral' as const,
  };
  const last = latestAct(assignment.acts);
  const titleId = `dossier-${assignment.id}`;
  const open = assignment.status === 'active';

  const details = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        <span className="text-small text-ink-muted">
          {t.assignedOn(formatShortDate(assignment.assignedAt))}
        </span>
      </div>
      <p className="text-ink">
        <span className="font-semibold">{t.acts(assignment.acts.length)}</span>
        {last ? (
          <span className="text-ink-muted">
            {' '}
            · {t.lastAct(labelOf(ACT_TYPE_LABELS, last.type), formatDay(last.actDate))}
          </span>
        ) : null}
      </p>
      {assignment.lastUpdateAt ? (
        <p className="text-small text-ink-subtle">{t.lastUpdate(formatShortDate(assignment.lastUpdateAt))}</p>
      ) : null}
    </>
  );

  if (open)
    return (
      <article
        aria-labelledby={titleId}
        className="rounded-card border-line bg-surface hover:border-line-strong focus-within:outline-focus relative grid gap-2 border p-4 shadow-xs focus-within:outline-2 focus-within:outline-offset-2 sm:p-5"
      >
        <h2 id={titleId} className="font-display text-ink text-lg font-semibold">
          {/* Jamais préchargée : la lecture de la fiche est tracée par le back. */}
          <Link
            href={partnerFileHref(assignment.id)}
            prefetch={false}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {assignment.caseNumber}
          </Link>
        </h2>
        {details}
        <span className="text-action-ink flex items-center gap-1 font-semibold" aria-hidden="true">
          {t.open}
          <IconChevronRight className="size-5" />
        </span>
      </article>
    );

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-card border-line bg-surface-muted grid gap-2 border p-4 sm:p-5"
    >
      <h2 id={titleId} className="font-display text-ink text-lg font-semibold">
        {assignment.caseNumber}
      </h2>
      {details}
      {assignment.status === 'withdrawn' && assignment.withdrawnAt ? (
        <p className="text-ink">
          {t.withdrawnOn(formatShortDate(assignment.withdrawnAt))}
          {assignment.withdrawalReason ? ` · ${t.withdrawalReason(assignment.withdrawalReason)}` : null}
        </p>
      ) : null}
      <p className="text-small text-ink-muted">
        {assignment.status === 'completed' ? t.completedNote : t.closedNote}
      </p>
    </article>
  );
}
