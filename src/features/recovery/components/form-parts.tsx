'use client';

import type { ReactNode } from 'react';
import { Heading } from '@/components/ui/heading';
import { IconAlert, IconArrowLeft } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { IdempotentSubmission } from '@/lib/idempotency';
import { type RecoveryProblem, readProblem, withReference } from '@/features/recovery/errors';
import { recoveryTexts } from '@/features/recovery/texts';

/**
 * Entier de francs CFA saisi (« 50 000 » ou « 50000 ») ; `null` si vide, `NaN` sinon (décimales, signe,
 * point : refusés plutôt que devinés).
 */
export function parseXof(input: string): number | null {
  const compact = input.replace(/[\s\u00a0\u202f]/g, '');
  if (!compact) return null;
  return /^\d{1,13}$/.test(compact) ? Number(compact) : Number.NaN;
}

/** Place le focus sur le premier champ en erreur (le lecteur d'écran lit son libellé puis l'erreur). */
export function focusFirst(ids: ReadonlyArray<string>) {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) {
      element.focus();
      return;
    }
  }
}

/** En-tête d'un formulaire du dossier : « Annuler » (retour à la fiche), titre, numéro du dossier. */
export function FormHeader({
  title,
  caseNumber,
  lead,
  onCancel,
  cancelLabel,
}: {
  title: string;
  caseNumber: string;
  lead: string;
  onCancel: () => void;
  cancelLabel: string;
}) {
  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="text-ink-muted hover:text-ink focus-visible:outline-focus -ml-1 inline-flex min-h-12 items-center gap-2 self-start justify-self-start rounded-full px-1 font-semibold focus-visible:outline-2"
      >
        <IconArrowLeft className="size-5" />
        {cancelLabel}
      </button>
      <p className="text-small text-ink-muted font-semibold tracking-wide uppercase">{caseNumber}</p>
      <Heading as="h1" size="h2">
        {title}
      </Heading>
      <p className="text-ink-muted">{lead}</p>
    </div>
  );
}

/** Encadré d'avertissement bien visible (règle à respecter, dossier suspendu). */
export function Notice({
  title,
  children,
  tone = 'warning',
  role,
  className,
}: {
  title: string;
  children: ReactNode;
  tone?: 'warning' | 'danger';
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        'rounded-card flex items-start gap-3 border-2 p-4',
        tone === 'warning' ? 'border-warning bg-warning-soft' : 'border-danger bg-danger-soft',
        className,
      )}
    >
      <IconAlert
        className={cn('mt-0.5 size-6 shrink-0', tone === 'warning' ? 'text-warning' : 'text-danger')}
      />
      <div className="grid gap-1">
        <p className="text-ink font-bold">{title}</p>
        <div className="text-ink">{children}</div>
      </div>
    </div>
  );
}

export interface SubmitOutcome {
  /** Champ en cause (`details.field` du back). */
  field?: { name: string; message: string };
  /** Message général à afficher. */
  message?: string;
  /** Dossier suspendu par une contestation. */
  suspended?: boolean;
  /** La fiche change d'état (plus confiée, accès refusé). */
  settle?: 'gone' | 'forbidden';
}

/**
 * Lecture d'un refus d'envoi : la clé d'idempotence est abandonnée quand la gateway a tranché (clé
 * réutilisée) ; elle est gardée pour un nouvel essai du même contenu (réseau, panne).
 */
export function outcomeOf(error: unknown, submission: IdempotentSubmission): SubmitOutcome {
  const problem: RecoveryProblem = readProblem(error);
  switch (problem.kind) {
    case 'forbidden':
    case 'gone':
      return { settle: problem.kind };
    case 'field':
      return { field: { name: problem.field, message: problem.message } };
    case 'suspended':
      return { suspended: true };
    case 'amount':
      return { field: { name: 'amount', message: problem.message } };
    case 'keyReused':
      submission.done();
      return { message: problem.message };
    case 'transition':
      return { message: problem.message };
    default:
      return { message: withReference(problem.message || recoveryTexts.genericError, problem.correlationId) };
  }
}
