'use client';

import { type FormEvent, useRef, useState } from 'react';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SummaryRow, TextAreaField } from '@/components/ui/form-fields';
import { beninDate } from '@/lib/format';
import { formatMoney } from '@/features/recovery/money';
import { idempotentSubmission } from '@/lib/idempotency';
import { type CollectionBody, declareCollection } from '@/features/recovery/api';
import type { OfflinePayment } from '@/features/recovery/schemas';
import { recoveryTexts } from '@/features/recovery/texts';
import { formatDay } from './assignment-card';
import { type DocumentValue, DocumentField } from './document-field';
import { FormHeader, focusFirst, Notice, outcomeOf, parseXof } from './form-parts';

const t = recoveryTexts.collection;
const NOTE_MAX = 500;

/** Identifiants des champs, dans l'ordre du formulaire ; clés : noms des champs du contrat. */
const IDS = {
  amount: 'encaissement-montant',
  receivedOn: 'encaissement-date',
  proofFileId: 'encaissement-preuve',
  note: 'encaissement-note',
} as const;
type Field = keyof typeof IDS;
type Errors = Partial<Record<Field, string>>;

interface Draft {
  amount: string;
  receivedOn: string;
  proof: DocumentValue | null;
  note: string;
}

/** Champ du contrat de chaque saisie : son erreur s'efface dès qu'il est corrigé. */
const FIELD_OF: Record<keyof Draft, Field> = {
  amount: 'amount',
  receivedOn: 'receivedOn',
  proof: 'proofFileId',
  note: 'note',
};

function validate(draft: Draft, today: string, due: number): Errors {
  const errors: Errors = {};
  const amount = parseXof(draft.amount);
  if (amount === null || amount === 0) errors.amount = t.amountRequired;
  else if (!Number.isSafeInteger(amount)) errors.amount = t.amountInvalid;
  else if (amount > due) errors.amount = t.amountAboveDue(formatMoney(due));
  if (!draft.receivedOn) errors.receivedOn = t.receivedOnRequired;
  else if (draft.receivedOn > today) errors.receivedOn = t.receivedOnFuture;
  if (draft.note.length > NOTE_MAX) errors.note = recoveryTexts.act.noteTooLong(NOTE_MAX);
  return errors;
}

function bodyOf(draft: Draft): CollectionBody {
  const note = draft.note.trim();
  return {
    amount: { amount: parseXof(draft.amount) ?? 0, currency: 'XOF' },
    receivedOn: draft.receivedOn,
    ...(draft.proof ? { proofFileId: draft.proof.id } : {}),
    ...(note ? { note } : {}),
  };
}

/**
 * « Déclarer un encaissement » (`POST …/collections`, clé d'idempotence) : montant (au plus le reste dû),
 * date de réception (au plus aujourd'hui), preuve (`recovery_evidence`), note ; vérification puis
 * confirmation. La somme est à virer à KSP sous 5 jours ouvrés ; elle n'est imputée qu'après validation
 * par la finance. 422 `RECOVERY_CASE_SUSPENDED` (contestation en cours) expliqué.
 */
export function CollectionForm({
  assignmentId,
  caseNumber,
  due,
  onDeclared,
  onCancel,
  onSettle,
}: {
  assignmentId: string;
  caseNumber: string;
  /** Reste dû lu dans la fiche, en entiers de FCFA (la gateway reste seule juge). */
  due: number;
  onDeclared: (payment: OfflinePayment) => void;
  onCancel: () => void;
  onSettle: (status: 'gone' | 'forbidden') => void;
}) {
  const today = beninDate();
  const [draft, setDraft] = useState<Draft>({ amount: '', receivedOn: today, proof: null, note: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const submission = useRef(idempotentSubmission());

  function change(patch: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch) as Array<keyof Draft>) delete next[FIELD_OF[key]];
      return next;
    });
  }

  function showErrors(next: Errors) {
    setErrors(next);
    setStep('edit');
    requestAnimationFrame(() =>
      focusFirst((Object.keys(IDS) as Field[]).filter((field) => next[field]).map((field) => IDS[field])),
    );
  }

  function review(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const next = validate(draft, beninDate(), due);
    if (Object.keys(next).length) return showErrors(next);
    setErrors({});
    setStep('review');
    window.scrollTo({ top: 0 });
  }

  async function confirm() {
    if (sending) return;
    const body = bodyOf(draft);
    setSending(true);
    setMessage(null);
    setSuspended(false);
    try {
      const payment = await declareCollection(assignmentId, body, submission.current.keyFor(body));
      submission.current.done();
      onDeclared(payment);
    } catch (error) {
      const outcome = outcomeOf(error, submission.current);
      if (outcome.settle) return onSettle(outcome.settle);
      if (outcome.field && outcome.field.name in IDS)
        return showErrors({ [outcome.field.name as Field]: outcome.field.message });
      if (outcome.suspended) setSuspended(true);
      setMessage(outcome.field?.message ?? outcome.message ?? null);
      // Le refus s'affiche en haut de l'étape : jamais caché sous la barre d'action.
      window.scrollTo({ top: 0 });
    } finally {
      setSending(false);
    }
  }

  const header = (
    <FormHeader
      title={t.title}
      caseNumber={caseNumber}
      lead={t.lead}
      onCancel={onCancel}
      cancelLabel={t.cancel}
    />
  );
  const suspendedNotice = suspended ? (
    <Notice title={t.suspendedTitle} tone="danger" role="alert">
      {t.suspendedText}
    </Notice>
  ) : null;

  if (step === 'review') {
    return (
      <div className="grid gap-6">
        {header}
        {suspendedNotice}
        {suspended ? null : <FormMessage>{message}</FormMessage>}
        <section
          aria-labelledby="encaissement-verification"
          className="rounded-panel border-line bg-surface border p-5 shadow-xs sm:p-7"
        >
          <h2 id="encaissement-verification" className="font-display text-h3 text-ink font-semibold">
            {t.confirmTitle}
          </h2>
          <dl className="mt-4">
            <SummaryRow label={t.summaryAmount} strong>
              {formatMoney(parseXof(draft.amount) ?? 0)}
            </SummaryRow>
            <SummaryRow label={t.summaryDate}>{formatDay(draft.receivedOn)}</SummaryRow>
            <SummaryRow label={t.summaryProof}>{draft.proof?.name ?? t.none}</SummaryRow>
          </dl>
          {draft.note.trim() ? (
            <p className="text-ink mt-3 whitespace-pre-line">{draft.note.trim()}</p>
          ) : null}
          <p className="text-ink mt-4">{t.confirmText}</p>
        </section>
        <Notice title={t.reminderTitle}>{t.reminderText}</Notice>
        <BottomBar className="sm:flex sm:flex-wrap">
          <Button
            variant="action"
            size="lg"
            onClick={confirm}
            disabled={sending || suspended}
            aria-busy={sending || undefined}
          >
            {sending ? t.sending : t.confirm}
          </Button>
          <Button variant="ghost" onClick={() => setStep('edit')} disabled={sending}>
            {t.edit}
          </Button>
        </BottomBar>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={review} className="grid gap-6">
      {header}
      {suspendedNotice}
      <FormMessage>{message}</FormMessage>
      <div className="rounded-panel border-line bg-surface grid gap-5 border p-5 shadow-xs sm:p-7">
        <TextField
          id={IDS.amount}
          label={t.amount}
          hint={t.due(formatMoney(due))}
          inputMode="numeric"
          autoComplete="off"
          value={draft.amount}
          error={errors.amount}
          onChange={(event) => change({ amount: event.target.value })}
        />
        <TextField
          id={IDS.receivedOn}
          type="date"
          label={t.receivedOn}
          value={draft.receivedOn}
          max={today}
          error={errors.receivedOn}
          onChange={(event) => change({ receivedOn: event.target.value })}
        />
        <DocumentField
          id={IDS.proofFileId}
          label={t.proof}
          hint={recoveryTexts.evidence.hint}
          value={draft.proof}
          onChange={(proof) => change({ proof })}
          texts={recoveryTexts.evidence}
          error={errors.proofFileId}
        />
        <TextAreaField
          id={IDS.note}
          label={t.note}
          value={draft.note}
          maxLength={NOTE_MAX}
          counter={`${draft.note.length} / ${NOTE_MAX}`}
          error={errors.note}
          onChange={(event) => change({ note: event.target.value })}
        />
      </div>
      <Notice title={t.reminderTitle}>{t.reminderText}</Notice>
      <BottomBar>
        <Button type="submit" variant="action" size="lg">
          {t.review}
        </Button>
      </BottomBar>
    </form>
  );
}
