'use client';

import { type FormEvent, useRef, useState } from 'react';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField, SummaryRow, TextAreaField } from '@/components/ui/form-fields';
import { beninDate } from '@/lib/format';
import { formatMoney } from '@/features/recovery/money';
import { idempotentSubmission } from '@/lib/idempotency';
import {
  LEGAL_ACT_TYPES,
  type LegalActBody,
  type LegalActType,
  recordLegalAct,
} from '@/features/recovery/api';
import type { LegalAct } from '@/features/recovery/schemas';
import { ACT_TYPE_LABELS, recoveryTexts } from '@/features/recovery/texts';
import { formatDay } from './assignment-card';
import { type DocumentValue, DocumentField } from './document-field';
import { FormHeader, focusFirst, Notice, outcomeOf, parseXof } from './form-parts';

const t = recoveryTexts.act;
const NOTE_MAX = 1000;
const COST_MAX = 1_000_000_000;

/** Identifiants des champs, dans l'ordre du formulaire ; clés : noms des champs du contrat. */
const IDS = {
  type: 'acte-type',
  actDate: 'acte-date',
  cost: 'acte-cout',
  fileId: 'acte-piece',
  note: 'acte-note',
  nextStepDate: 'acte-echeance',
} as const;
type Field = keyof typeof IDS;
type Errors = Partial<Record<Field, string>>;

interface Draft {
  type: LegalActType | '';
  actDate: string;
  cost: string;
  file: DocumentValue | null;
  note: string;
  nextStepDate: string;
}

/** Champ du contrat de chaque saisie : son erreur s'efface dès qu'il est corrigé. */
const FIELD_OF: Record<keyof Draft, Field> = {
  type: 'type',
  actDate: 'actDate',
  cost: 'cost',
  file: 'fileId',
  note: 'note',
  nextStepDate: 'nextStepDate',
};

function validate(draft: Draft, today: string): Errors {
  const errors: Errors = {};
  if (!draft.type) errors.type = t.typeRequired;
  if (!draft.actDate) errors.actDate = t.actDateRequired;
  else if (draft.actDate > today) errors.actDate = t.actDateFuture;
  const cost = parseXof(draft.cost);
  if (cost === null) errors.cost = t.costRequired;
  else if (!Number.isSafeInteger(cost) || cost > COST_MAX) errors.cost = t.costInvalid;
  if (draft.note.length > NOTE_MAX) errors.note = t.noteTooLong(NOTE_MAX);
  if (draft.nextStepDate && draft.actDate && draft.nextStepDate < draft.actDate)
    errors.nextStepDate = t.nextStepBefore;
  return errors;
}

function bodyOf(draft: Draft): LegalActBody {
  const note = draft.note.trim();
  return {
    type: draft.type as LegalActType,
    actDate: draft.actDate,
    cost: { amount: parseXof(draft.cost) ?? 0, currency: 'XOF' },
    ...(draft.file ? { fileId: draft.file.id } : {}),
    ...(note ? { note } : {}),
    ...(draft.nextStepDate ? { nextStepDate: draft.nextStepDate } : {}),
  };
}

/**
 * « Enregistrer un acte » (`POST …/acts`, clé d'idempotence) : type (11 valeurs du contrat), date (au plus
 * aujourd'hui), coût en entiers de FCFA (pris sur la provision du créancier, KSP n'avance aucun frais),
 * pièce (`recovery_evidence`), note, prochaine échéance ; vérification puis confirmation. Le créancier et
 * le juriste KSP sont prévenus par le back.
 */
export function ActForm({
  assignmentId,
  caseNumber,
  onRecorded,
  onCancel,
  onSettle,
}: {
  assignmentId: string;
  caseNumber: string;
  onRecorded: (act: LegalAct) => void;
  onCancel: () => void;
  onSettle: (status: 'gone' | 'forbidden') => void;
}) {
  const today = beninDate();
  const [draft, setDraft] = useState<Draft>({
    type: '',
    actDate: today,
    cost: '',
    file: null,
    note: '',
    nextStepDate: '',
  });
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
    const next = validate(draft, beninDate());
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
      const act = await recordLegalAct(assignmentId, body, submission.current.keyFor(body));
      submission.current.done();
      onRecorded(act);
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

  if (step === 'review') {
    const cost = parseXof(draft.cost) ?? 0;
    return (
      <div className="grid gap-6">
        {header}
        {suspended ? (
          <Notice title={recoveryTexts.collection.suspendedTitle} tone="danger" role="alert">
            {recoveryTexts.collection.suspendedText}
          </Notice>
        ) : (
          <FormMessage>{message}</FormMessage>
        )}
        <section
          aria-labelledby="acte-verification"
          className="rounded-panel border-line bg-surface border p-5 shadow-xs sm:p-7"
        >
          <h2 id="acte-verification" className="font-display text-h3 text-ink font-semibold">
            {t.confirmTitle}
          </h2>
          <dl className="mt-4">
            <SummaryRow label={t.summaryType}>{ACT_TYPE_LABELS[draft.type] ?? draft.type}</SummaryRow>
            <SummaryRow label={t.summaryDate}>{formatDay(draft.actDate)}</SummaryRow>
            <SummaryRow label={t.summaryCost}>
              {cost > 0 ? formatMoney(cost) : recoveryTexts.file.actNoCost}
            </SummaryRow>
            <SummaryRow label={t.summaryFile}>{draft.file?.name ?? t.none}</SummaryRow>
            <SummaryRow label={t.summaryNext}>
              {draft.nextStepDate ? formatDay(draft.nextStepDate) : t.none}
            </SummaryRow>
          </dl>
          {draft.note.trim() ? (
            <p className="text-ink mt-3 whitespace-pre-line">{draft.note.trim()}</p>
          ) : null}
          <p className="text-ink mt-4 font-medium">{t.confirmText}</p>
        </section>
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
      <FormMessage>{message}</FormMessage>
      <div className="rounded-panel border-line bg-surface grid gap-5 border p-5 shadow-xs sm:p-7">
        <SelectField
          id={IDS.type}
          label={t.type}
          value={draft.type}
          error={errors.type}
          onChange={(event) => change({ type: event.target.value as LegalActType | '' })}
        >
          <option value="">{t.typePlaceholder}</option>
          {LEGAL_ACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {ACT_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
        <TextField
          id={IDS.actDate}
          type="date"
          label={t.actDate}
          value={draft.actDate}
          max={today}
          error={errors.actDate}
          onChange={(event) => change({ actDate: event.target.value })}
        />
        <TextField
          id={IDS.cost}
          label={t.cost}
          hint={t.costHint}
          inputMode="numeric"
          autoComplete="off"
          value={draft.cost}
          error={errors.cost}
          onChange={(event) => change({ cost: event.target.value })}
        />
        <DocumentField
          id={IDS.fileId}
          label={t.file}
          hint={recoveryTexts.evidence.hint}
          value={draft.file}
          onChange={(file) => change({ file })}
          texts={recoveryTexts.evidence}
          error={errors.fileId}
        />
        <TextAreaField
          id={IDS.note}
          label={t.note}
          hint={t.noteHint}
          value={draft.note}
          maxLength={NOTE_MAX}
          counter={`${draft.note.length} / ${NOTE_MAX}`}
          error={errors.note}
          onChange={(event) => change({ note: event.target.value })}
        />
        <TextField
          id={IDS.nextStepDate}
          type="date"
          label={t.nextStepDate}
          hint={t.nextStepHint}
          value={draft.nextStepDate}
          min={draft.actDate || undefined}
          error={errors.nextStepDate}
          onChange={(event) => change({ nextStepDate: event.target.value })}
        />
      </div>
      <BottomBar>
        <Button type="submit" variant="action" size="lg">
          {t.review}
        </Button>
      </BottomBar>
    </form>
  );
}
