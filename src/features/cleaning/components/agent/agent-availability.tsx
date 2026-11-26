'use client';

import { type FormEvent, useState } from 'react';
import { BackendPending } from '@/components/ui/backend-pending';
import { Button } from '@/components/ui/button';
import { FieldError, FormMessage, inputClasses } from '@/components/ui/field';
import { Panel } from '@/components/ui/form-fields';
import { Heading } from '@/components/ui/heading';
import { IconClose } from '@/components/ui/icons';
import { SkeletonCards } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { beninDate, beninSlot, formatDate, formatTime } from '@/lib/format';
import { getMyAvailability, setMyAvailability } from '@/features/cleaning/agent-api';
import { agentTexts } from '@/features/cleaning/agent-texts';
import type { Availability } from '@/features/cleaning/schemas';
import { rulesFromWeek, weekFromRules, weekProblems, type WeeklyPlan } from '@/features/cleaning/weekly';
import { WeeklyEditor } from '@/features/cleaning/components/weekly-editor';
import { LoadFailure } from './states';
import { AgentUnavailabilities } from './agent-unavailabilities';
import { affectedCount, useLoad } from './use-load';

const t = agentTexts.availability;
const MAX_EXTRAS = 50;

interface Slot {
  start: string;
  end: string;
}

const slotLabel = (slot: Slot) =>
  `${formatDate(slot.start)}, ${formatTime(slot.start)} – ${formatTime(slot.end)}`;

/** Semaine type et disponibilités exceptionnelles : un seul enregistrement (`PUT` remplace les deux). */
function WeeklyForm({
  availability,
  saved,
  onSaved,
}: {
  availability: Availability;
  /** Le formulaire repart de l'enregistrement qui vient de réussir : il le dit. */
  saved: boolean;
  onSaved: (next: Availability) => void;
}) {
  const [plan, setPlan] = useState<WeeklyPlan>(() => weekFromRules(availability.weekly));
  const [extras, setExtras] = useState<Slot[]>(() =>
    availability.extraAvailabilities.map(({ start, end }) => ({ start, end })),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(() =>
    saved ? { tone: 'success', text: t.saved } : null,
  );
  const [extra, setExtra] = useState({ date: beninDate(), from: '08:00', to: '12:00' });
  const [extraError, setExtraError] = useState<string | null>(null);

  function edit(next: () => void) {
    next();
    setDirty(true);
    setMessage(null);
  }

  function addExtra() {
    if (!extra.date || !extra.from || !extra.to || extra.to <= extra.from) {
      setExtraError(t.extraInvalid);
      return;
    }
    if (extras.length >= MAX_EXTRAS) {
      setExtraError(t.extrasMax);
      return;
    }
    setExtraError(null);
    const slot = beninSlot(extra.date, extra.from, extra.to);
    edit(() => setExtras((previous) => [...previous, slot].sort((a, b) => a.start.localeCompare(b.start))));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (Object.keys(weekProblems(plan)).length) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const next = await setMyAvailability({ weekly: rulesFromWeek(plan), extraAvailabilities: extras });
      setDirty(false);
      onSaved(next);
    } catch (error) {
      const text =
        error instanceof ApiError && error.code === 'CLEANING_AVAILABILITY_IN_USE'
          ? t.inUse(affectedCount(error))
          : error instanceof ApiError
            ? error.message
            : agentTexts.genericError;
      setMessage({ tone: 'error', text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-6">
      <Panel id="disponibilites-semaine" title={t.weeklyTitle}>
        <p className="text-small text-ink-muted -mt-2 mb-4">{t.weeklyHint}</p>
        <WeeklyEditor
          id="disponibilites"
          value={plan}
          onChange={(next) => edit(() => setPlan(next))}
          showErrors={showErrors}
          disabled={saving}
        />
      </Panel>
      <Panel id="disponibilites-exceptionnelles" title={t.extrasTitle}>
        <p className="text-small text-ink-muted -mt-2 mb-4">{t.extrasHint}</p>
        {extras.length ? (
          <ul className="mb-5 grid gap-2">
            {extras.map((slot, index) => (
              <li
                key={`${slot.start}-${index}`}
                className="rounded-control border-line bg-surface-muted flex items-center justify-between gap-3 border py-1 pl-4"
              >
                <span className="text-ink font-medium first-letter:uppercase">{slotLabel(slot)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.extraRemove(slotLabel(slot))}
                  disabled={saving}
                  onClick={() => edit(() => setExtras((previous) => previous.filter((_, i) => i !== index)))}
                >
                  <IconClose className="size-5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted mb-5">{t.extrasEmpty}</p>
        )}
        <div className="grid gap-3" role="group" aria-labelledby="disponibilites-exceptionnelles-ajout">
          <p id="disponibilites-exceptionnelles-ajout" className="sr-only">
            {t.extraAdd}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
            <label className="col-span-2 grid min-w-0 gap-1 sm:col-span-1">
              <span className="text-small text-ink-muted">{t.extraDate}</span>
              <input
                type="date"
                value={extra.date}
                min={beninDate()}
                onChange={(event) => setExtra({ ...extra, date: event.target.value })}
                className={inputClasses({ invalid: !!extraError })}
              />
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-small text-ink-muted">{t.extraFrom}</span>
              <input
                type="time"
                value={extra.from}
                onChange={(event) => setExtra({ ...extra, from: event.target.value })}
                className={inputClasses({ invalid: !!extraError, className: 'tabular-nums' })}
              />
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-small text-ink-muted">{t.extraTo}</span>
              <input
                type="time"
                value={extra.to}
                onChange={(event) => setExtra({ ...extra, to: event.target.value })}
                className={inputClasses({ invalid: !!extraError, className: 'tabular-nums' })}
              />
            </label>
          </div>
          {extraError ? (
            <FieldError id="disponibilites-exceptionnelles-erreur">{extraError}</FieldError>
          ) : null}
          <Button variant="secondary" className="justify-self-start" onClick={addExtra} disabled={saving}>
            {t.extraAdd}
          </Button>
        </div>
      </Panel>
      <div className="grid gap-3">
        <FormMessage tone={message?.tone ?? 'error'}>{message?.text}</FormMessage>
        {dirty && !message ? <p className="text-small text-ink-muted">{t.unsaved}</p> : null}
        <Button
          type="submit"
          variant="action"
          size="lg"
          className="w-full sm:w-auto sm:justify-self-start"
          disabled={saving}
          aria-busy={saving || undefined}
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}

/**
 * « Mes disponibilités » : semaine type (6 plages par jour au plus), disponibilités exceptionnelles,
 * indisponibilités (congé, maladie) et charge maximale fixée par KSP. Retirer une plage déjà occupée
 * par une affectation passe par le superviseur (409 `CLEANING_AVAILABILITY_IN_USE`, expliqué).
 */
export function AgentAvailability() {
  const { state, reload, set } = useLoad<Availability>(getMyAvailability);
  const [version, setVersion] = useState(0);

  let body;
  if (state.status === 'loading') body = <SkeletonCards label={t.loading} rows={3} media={false} />;
  else if (state.status === 'error')
    body = <LoadFailure message={state.message} correlationId={state.correlationId} onRetry={reload} />;
  else if (state.status === 'pending')
    body = (
      <BackendPending
        id="disponibilites-attente"
        title={t.title}
        needs={[{ method: 'GET', path: '/api/v1/cleaning/agent/me/availability', purpose: t.title }]}
      >
        {t.lead}
      </BackendPending>
    );
  else
    body = (
      <div className="grid gap-8">
        <WeeklyForm
          key={version}
          availability={state.data}
          saved={version > 0}
          onSaved={(next) => {
            set(next);
            setVersion((value) => value + 1);
          }}
        />
        <AgentUnavailabilities items={state.data.unavailabilities} onChange={set} />
        <section aria-labelledby="disponibilites-charge" className="grid gap-1">
          <h2 id="disponibilites-charge" className="text-ink font-semibold">
            {t.loadTitle}
          </h2>
          <p className="text-ink-muted">{t.load(state.data.maxHoursPerDay, state.data.maxHoursPerWeek)}</p>
        </section>
      </div>
    );

  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted mt-1">{t.lead}</p>
      </div>
      {body}
    </div>
  );
}
