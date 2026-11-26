'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { ChoicePill, Fieldset } from '@/components/ui/form-fields';
import { BENIN_TIME_ZONE, beninDate, beninSlot } from '@/lib/format';
import { fieldTexts } from '@/features/cleaning/field-texts';
import { MISSED_CAUSE, sessionTexts } from '@/features/cleaning/session-texts';
import { PhotoCapture, PhotoGrid } from './photos';

const t = sessionTexts;

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: BENIN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Heure du Bénin d'un instant, au format des champs d'heure (`09:05`). */
export function timeInput(iso: string): string {
  return clock.format(new Date(iso));
}

/** Instant d'une heure saisie (`09:05`), le jour de la séance au Bénin. */
export function instantOf(day: string, time: string): string {
  return beninSlot(beninDate(new Date(day)), time, time).start;
}

export interface MissedInput {
  cause: string;
  photo: File;
  waitStartedAt: string;
  calledAt: string;
}

/**
 * « Client absent ou accès impossible » (chef d'équipe) : motif, photo du lieu, début de l'attente et
 * heure de l'appel au client (tracé). L'attente réglementaire est contrôlée par la gateway
 * (`CLEANING_WAIT_TIME_NOT_ELAPSED`, expliqué avec sa durée).
 */
export function SessionMissedForm({
  scheduledStart,
  arrivedAt,
  busy,
  onSubmit,
  onCancel,
}: {
  scheduledStart: string;
  arrivedAt: string | null;
  busy?: boolean;
  onSubmit: (input: MissedInput) => void;
  onCancel: () => void;
}) {
  const [cause, setCause] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [waitStarted, setWaitStarted] = useState(() => timeInput(arrivedAt ?? scheduledStart));
  const [called, setCalled] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  function submit() {
    const now = Date.now();
    const waitAt = waitStarted ? instantOf(scheduledStart, waitStarted) : null;
    const calledAt = called ? instantOf(scheduledStart, called) : null;
    const next: Record<string, string | undefined> = {
      cause: cause ? undefined : t.causeMissing,
      photo: photo ? undefined : t.missedPhotoMissing,
      wait: !waitAt ? t.timeMissing : Date.parse(waitAt) > now ? t.timeFuture : undefined,
      called: !calledAt ? t.timeMissing : Date.parse(calledAt) > now ? t.timeFuture : undefined,
    };
    setErrors(next);
    const first = (['cause', 'wait', 'called'] as const).find((key) => next[key]);
    if (first) {
      document
        .getElementById({ cause: 'absence-motif', wait: 'absence-attente', called: 'absence-appel' }[first])
        ?.focus();
      return;
    }
    if (!photo || !waitAt || !calledAt) return;
    onSubmit({ cause, photo, waitStartedAt: waitAt, calledAt });
  }

  return (
    <section
      aria-labelledby="absence-titre"
      className="rounded-card border-line-strong bg-surface grid gap-4 border-2 p-4"
    >
      <h3 id="absence-titre" className="font-display text-ink text-lg font-semibold">
        {t.missedTitle}
      </h3>
      <p className="text-ink-muted">{t.missedHint}</p>
      <Fieldset id="absence-motif-groupe" legend={t.cause} error={errors.cause}>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(MISSED_CAUSE).map(([code, label], index) => (
            <ChoicePill
              key={code}
              id={index === 0 ? 'absence-motif' : undefined}
              name="absence-motif"
              value={code}
              label={label}
              checked={cause === code}
              onChange={() => setCause(code)}
              disabled={busy}
            />
          ))}
        </div>
      </Fieldset>
      <div className="grid gap-3">
        <p className="text-ink font-semibold">{t.missedPhoto}</p>
        {photo ? (
          <PhotoGrid
            photos={[{ fileId: 'absence', kind: 'absence', takenAt: '', url: null, urlExpiresAt: null }]}
            marks={{}}
            local={{ absence: photo }}
            label={t.missedPhoto}
            onRemove={() => setPhoto(null)}
          />
        ) : null}
        <PhotoCapture
          id="photo-absence-seance"
          label={fieldTexts.photos.take}
          onPhoto={(file) => {
            setPhoto(file);
            setErrors((current) => ({ ...current, photo: undefined }));
          }}
          disabled={busy}
        />
        {errors.photo ? <FormMessage>{errors.photo}</FormMessage> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="absence-attente"
          type="time"
          label={t.waitStarted}
          value={waitStarted}
          onChange={(event) => setWaitStarted(event.target.value)}
          error={errors.wait}
          disabled={busy}
        />
        <TextField
          id="absence-appel"
          type="time"
          label={t.calledAt}
          value={called}
          onChange={(event) => setCalled(event.target.value)}
          error={errors.called}
          disabled={busy}
        />
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button
          variant="primary"
          onClick={submit}
          disabled={busy}
          aria-busy={busy || undefined}
          className="w-full sm:w-auto"
        >
          {busy ? t.missedSending : t.missedSubmit}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="w-full sm:w-auto">
          {t.cancel}
        </Button>
      </div>
    </section>
  );
}
