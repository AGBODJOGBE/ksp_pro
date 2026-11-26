'use client';

import { type FormEvent, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError, FormMessage, inputClasses } from '@/components/ui/field';
import { ChoicePill, Fieldset, Panel, TextAreaField } from '@/components/ui/form-fields';
import { ApiError } from '@/lib/api';
import {
  beninDate,
  beninSlot,
  formatDateTime,
  formatExclusiveEndDate,
  formatShortDate,
  formatTime,
} from '@/lib/format';
import { idempotentSubmission } from '@/lib/idempotency';
import {
  declareUnavailability,
  removeUnavailability,
  type UnavailabilityKind,
} from '@/features/cleaning/agent-api';
import { agentTexts, UNAVAILABILITY_KIND } from '@/features/cleaning/agent-texts';
import type { Availability, Unavailability } from '@/features/cleaning/schemas';
import { affectedCount } from './use-load';

const t = agentTexts.unavailability;
const KINDS: UnavailabilityKind[] = ['leave', 'sickness', 'other'];
const NOTE_MAX = 300;

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : agentTexts.genericError);

/** « Du 3 décembre 2026 au 5 décembre 2026 » (journées entières) ou avec les heures. */
function periodLabel(item: Pick<Unavailability, 'start' | 'end'>): string {
  const allDay = formatTime(item.start) === '00:00' && formatTime(item.end) === '00:00';
  if (allDay) {
    const last = formatExclusiveEndDate(item.end);
    const first = formatShortDate(item.start);
    return first === last ? `Le ${first}` : `Du ${first} au ${last}`;
  }
  return `Du ${formatDateTime(item.start)} au ${formatDateTime(item.end)}`;
}

function Item({ item, onChange }: { item: Unavailability; onChange: (next: Availability) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      onChange(await removeUnavailability(item.id));
    } catch (caught) {
      setError(errorText(caught));
      setRemoving(false);
    }
  }

  const titleId = `indisponibilite-${item.id}`;
  return (
    <li className="rounded-card border-line bg-surface grid gap-2 border p-4" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="text-ink font-semibold">
          {UNAVAILABILITY_KIND[item.kind] ?? item.kind}
        </h3>
        {item.forced ? <Badge tone="brand">{t.forced}</Badge> : null}
      </div>
      <p className="text-ink">{periodLabel(item)}</p>
      {item.note ? <p className="text-ink-muted">{item.note}</p> : null}
      {item.createdByName ? <p className="text-small text-ink-subtle">{t.by(item.createdByName)}</p> : null}
      {confirming ? (
        <div className="grid gap-2">
          <p className="text-ink font-medium">{t.confirmRemove}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              className="border-danger bg-surface border"
              onClick={remove}
              disabled={removing}
              aria-busy={removing || undefined}
            >
              {removing ? t.removing : t.confirmRemoveYes}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={removing}>
              {t.confirmRemoveNo}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="danger"
          className="justify-self-start"
          aria-describedby={titleId}
          onClick={() => setConfirming(true)}
        >
          {t.remove}
        </Button>
      )}
      <FormMessage>{error}</FormMessage>
    </li>
  );
}

interface Draft {
  kind: UnavailabilityKind | '';
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  note: string;
}

const emptyDraft = (): Draft => ({
  kind: '',
  allDay: true,
  startDate: beninDate(),
  endDate: beninDate(),
  startTime: '08:00',
  endTime: '18:00',
  note: '',
});

/** Période envoyée (ISO 8601) ; journées entières : de minuit du premier jour à minuit après le dernier. */
function period(draft: Draft): { start: string; end: string } | null {
  if (!draft.startDate || !draft.endDate) return null;
  const start = beninSlot(draft.startDate, draft.allDay ? '00:00' : draft.startTime, '00:00').start;
  const endDay = draft.allDay
    ? beninDate(new Date(beninSlot(draft.endDate, '12:00', '12:00').start), 1)
    : draft.endDate;
  const end = beninSlot(endDay, draft.allDay ? '00:00' : draft.endTime, '00:00').start;
  return Date.parse(end) > Date.parse(start) ? { start, end } : null;
}

function DeclareForm({ onDone, onCancel }: { onDone: (next: Availability) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<{ kind?: string; period?: string }>({});
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submission = useRef(idempotentSubmission());
  const update = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const slot = period(draft);
    const found = {
      kind: draft.kind ? undefined : t.kindMissing,
      period: slot ? undefined : t.invalid,
    };
    setErrors(found);
    if (!slot || !draft.kind) return;
    const body = {
      ...slot,
      kind: draft.kind,
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    };
    setSending(true);
    setMessage(null);
    try {
      const next = await declareUnavailability(body, submission.current.keyFor(body));
      submission.current.done();
      onDone(next);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CLEANING_IDEMPOTENCY_KEY_REUSED')
        submission.current.done();
      setMessage(
        error instanceof ApiError && error.code === 'CLEANING_UNAVAILABILITY_CONFLICT'
          ? t.conflict(affectedCount(error))
          : errorText(error),
      );
    } finally {
      setSending(false);
    }
  }

  const time = (key: 'startTime' | 'endTime', label: string) => (
    <label className="grid min-w-0 gap-1">
      <span className="text-small text-ink-muted">{label}</span>
      <input
        type="time"
        value={draft[key]}
        disabled={sending}
        onChange={(event) => update({ [key]: event.target.value })}
        className={inputClasses({ invalid: !!errors.period, className: 'tabular-nums' })}
      />
    </label>
  );
  const date = (key: 'startDate' | 'endDate', label: string) => (
    <label className="grid min-w-0 gap-1">
      <span className="text-small text-ink-muted">{label}</span>
      <input
        type="date"
        value={draft[key]}
        min={key === 'endDate' ? draft.startDate : beninDate()}
        disabled={sending}
        aria-invalid={errors.period ? true : undefined}
        aria-describedby={errors.period ? 'indisponibilite-periode-erreur' : undefined}
        onChange={(event) => update({ [key]: event.target.value })}
        className={inputClasses({ invalid: !!errors.period })}
      />
    </label>
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-card border-line bg-surface-muted grid gap-5 border p-4 sm:p-5"
    >
      <Fieldset id="indisponibilite-motif" legend={t.kindLegend} error={errors.kind ?? null}>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((kind) => (
            <ChoicePill
              key={kind}
              name="indisponibilite-motif"
              value={kind}
              label={UNAVAILABILITY_KIND[kind]}
              checked={draft.kind === kind}
              disabled={sending}
              onChange={() => update({ kind })}
            />
          ))}
        </div>
      </Fieldset>
      <label className="flex min-h-12 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          className="accent-action size-6"
          checked={draft.allDay}
          disabled={sending}
          onChange={(event) => update({ allDay: event.target.checked })}
        />
        {t.allDay}
      </label>
      <div className="grid gap-3">
        {/* Une colonne sur téléphone (dates lisibles en entier), deux dès 640 px. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {date('startDate', t.startDate)}
          {draft.allDay ? null : time('startTime', t.startTime)}
          {date('endDate', t.endDate)}
          {draft.allDay ? null : time('endTime', t.endTime)}
        </div>
        {errors.period ? <FieldError id="indisponibilite-periode-erreur">{errors.period}</FieldError> : null}
      </div>
      <TextAreaField
        id="indisponibilite-note"
        label={t.note}
        rows={3}
        maxLength={NOTE_MAX}
        value={draft.note}
        disabled={sending}
        counter={t.noteCounter(draft.note.length)}
        onChange={(event) => update({ note: event.target.value })}
      />
      <FormMessage>{message}</FormMessage>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="action" disabled={sending} aria-busy={sending || undefined}>
          {sending ? t.submitting : t.submit}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={sending}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Indisponibilités à venir et en cours : liste (motif, période, forcée par le superviseur), retrait avec
 * confirmation, déclaration avec une clé d'idempotence. Une période qui chevauche des affectations est
 * refusée (409 `CLEANING_UNAVAILABILITY_CONFLICT`) : seul le superviseur peut la forcer.
 */
export function AgentUnavailabilities({
  items,
  onChange,
}: {
  items: ReadonlyArray<Unavailability>;
  onChange: (next: Availability) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Panel id="indisponibilites" title={t.title}>
      <p className="text-small text-ink-muted -mt-2 mb-4">{t.hint}</p>
      <FormMessage tone="success" className="mb-4">
        {notice}
      </FormMessage>
      {items.length ? (
        <ul className="mb-5 grid gap-3">
          {items.map((item) => (
            <Item
              key={item.id}
              item={item}
              onChange={(next) => {
                setNotice(t.removed);
                onChange(next);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted mb-5">{t.empty}</p>
      )}
      {adding ? (
        <DeclareForm
          onCancel={() => setAdding(false)}
          onDone={(next) => {
            setAdding(false);
            setNotice(t.declared);
            onChange(next);
          }}
        />
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setNotice(null);
            setAdding(true);
          }}
        >
          {t.add}
        </Button>
      )}
    </Panel>
  );
}
