'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { IconChevronRight, IconClock, IconPin } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatDuration, formatTime } from '@/lib/format';
import { idempotentSubmission } from '@/lib/idempotency';
import { type AssignmentAnswer, respondToAssignment } from '@/features/cleaning/agent-api';
import { ASSIGNMENT_STATUS, agentTexts, TARGET_KIND, TARGET_STATUS } from '@/features/cleaning/agent-texts';
import type { Assignment } from '@/features/cleaning/schemas';

const t = agentTexts.card;

/** Statuts qui occupent l'agenda de l'agent : la fiche de l'intervention s'ouvre. */
const IN_FORCE = ['proposed', 'pending_confirmation', 'confirmed'];

/** Adresse de la fiche (identifiant dans la recherche : une seule coque gardée par le service worker). */
export function targetHref(assignment: Assignment): string {
  const base = assignment.target.kind === 'visit' ? navigation.agentVisit.href : navigation.agentSession.href;
  return `${base}?id=${encodeURIComponent(assignment.target.id)}`;
}

export function isInForce(assignment: Assignment): boolean {
  return IN_FORCE.includes(assignment.status);
}

function remaining(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes < 1 ? t.lessThanMinute : formatDuration(minutes);
}

/**
 * Une affectation : horaire, nature (visite ou séance), lieu, statut ; « Chef d'équipe » d'une séance.
 * Un indépendant y répond avant `respondBefore` (compte à rebours), avec une clé d'idempotence ; le refus
 * demande une confirmation. Un salarié n'a rien à accepter (affectation confirmée d'office).
 */
export function AssignmentCard({
  assignment,
  canRespond,
  now,
  onUpdated,
  onStale,
  highlight = false,
  showDate = false,
  headingLevel: Title = 'h3',
}: {
  assignment: Assignment;
  /** Indépendant partenaire : peut accepter ou refuser. */
  canRespond: boolean;
  /** Heure courante (compte à rebours) ; `null` avant l'hydratation. */
  now: number | null;
  onUpdated: (assignment: Assignment) => void;
  /** L'affectation n'attend plus de réponse : la liste est relue. */
  onStale?: () => void;
  highlight?: boolean;
  showDate?: boolean;
  headingLevel?: 'h2' | 'h3';
}) {
  const [pending, setPending] = useState<AssignmentAnswer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const submission = useRef(idempotentSubmission());

  const status = ASSIGNMENT_STATUS[assignment.status] ?? { label: assignment.status, tone: 'neutral' };
  const kind = TARGET_KIND[assignment.target.kind] ?? assignment.target.kind;
  const targetStatus = TARGET_STATUS[assignment.targetStatus];
  const deadline =
    assignment.status === 'pending_confirmation' && assignment.respondBefore
      ? Date.parse(assignment.respondBefore)
      : null;
  const left = deadline !== null && now !== null ? deadline - now : null;
  const expired = left !== null && left <= 0;
  const titleId = `affectation-${assignment.assignmentId}`;

  async function respond(answer: AssignmentAnswer) {
    if (pending) return;
    setPending(answer);
    setMessage(null);
    const key = submission.current.keyFor({ id: assignment.assignmentId, answer });
    try {
      const updated = await respondToAssignment(assignment.assignmentId, answer, key);
      submission.current.done();
      setConfirming(false);
      setMessage({ tone: 'success', text: answer === 'accept' ? t.accepted : t.declined });
      onUpdated(updated);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CLEANING_IDEMPOTENCY_KEY_REUSED')
        submission.current.done();
      if (error instanceof ApiError && error.code === 'CLEANING_INVALID_TRANSITION') {
        setConfirming(false);
        setMessage({ tone: 'error', text: t.stale });
        onStale?.();
      } else {
        setMessage({
          tone: 'error',
          text: error instanceof ApiError ? error.message : agentTexts.genericError,
        });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'rounded-card bg-surface grid gap-3 border p-4 shadow-xs sm:p-5',
        highlight ? 'border-accent border-2' : 'border-line',
        !isInForce(assignment) && 'bg-surface-muted',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-display text-ink text-2xl leading-tight font-semibold tabular-nums">
          {formatTime(assignment.start)} – {formatTime(assignment.end)}
        </p>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      {showDate ? (
        <p className="text-ink -mt-2 font-medium first-letter:uppercase">{formatDate(assignment.start)}</p>
      ) : null}
      <div className="grid gap-1">
        <Title id={titleId} className="text-ink text-lg font-semibold">
          {kind} · {assignment.placeTypeName}
        </Title>
        <p className="text-ink-muted flex items-center gap-1.5">
          <IconPin className="size-4 shrink-0" />
          {assignment.communeName}
        </p>
      </div>
      {assignment.isLead || targetStatus ? (
        <div className="flex flex-wrap items-center gap-2">
          {assignment.isLead ? <Badge tone="accent">{t.lead}</Badge> : null}
          {targetStatus ? (
            <span className="text-small text-ink-muted first-letter:uppercase">
              {t.target(kind, targetStatus)}
            </span>
          ) : null}
        </div>
      ) : null}

      {deadline !== null && assignment.respondBefore ? (
        <div className="rounded-control bg-warning-soft grid gap-3 p-3">
          <p className="text-ink flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            <IconClock className="text-warning size-5 shrink-0" />
            {t.respondBefore(formatTime(assignment.respondBefore))}
            {left !== null && !expired ? (
              <span className="text-ink-muted font-medium">· {t.remaining(remaining(left))}</span>
            ) : null}
          </p>
          {expired ? (
            <p className="text-ink-muted">{t.expiredLocally}</p>
          ) : !canRespond ? (
            <p className="text-ink-muted">{t.employeePending}</p>
          ) : confirming ? (
            <div className="grid gap-2">
              <p className="text-ink font-medium">{t.confirmDecline}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  className="border-danger bg-surface flex-1 border sm:flex-none"
                  onClick={() => respond('decline')}
                  disabled={pending !== null}
                  aria-busy={pending === 'decline' || undefined}
                >
                  {pending === 'decline' ? t.declining : t.confirmDeclineYes}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 sm:flex-none"
                  onClick={() => setConfirming(false)}
                  disabled={pending !== null}
                >
                  {t.confirmDeclineNo}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="action"
                className="flex-1 sm:flex-none"
                onClick={() => respond('accept')}
                disabled={pending !== null}
                aria-busy={pending === 'accept' || undefined}
              >
                {pending === 'accept' ? t.accepting : t.accept}
              </Button>
              <Button
                variant="secondary"
                className="flex-1 sm:flex-none"
                onClick={() => setConfirming(true)}
                disabled={pending !== null}
              >
                {t.decline}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {isInForce(assignment) ? (
        <Link
          href={targetHref(assignment)}
          aria-describedby={titleId}
          className={buttonClasses({
            variant: highlight ? 'primary' : 'secondary',
            className: 'w-full sm:w-auto sm:justify-self-start',
          })}
        >
          {t.open}
          <IconChevronRight />
        </Link>
      ) : null}
      <FormMessage tone={message?.tone ?? 'error'}>{message?.text}</FormMessage>
    </article>
  );
}
