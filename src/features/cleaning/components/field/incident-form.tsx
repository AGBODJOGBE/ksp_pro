'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChoicePill, Fieldset, TextAreaField } from '@/components/ui/form-fields';
import type { FieldPhoto } from '@/features/cleaning/field-schemas';
import { fieldTexts } from '@/features/cleaning/field-texts';
import { INCIDENT_CATEGORY, sessionTexts } from '@/features/cleaning/session-texts';
import { MAX_PHOTOS, PhotoCapture, PhotoGrid } from './photos';

const t = sessionTexts;
const NOTE_MAX = 2000;

export interface IncidentInput {
  category: string;
  note: string;
  photos: File[];
}

/**
 * « Signaler un incident » (tout membre, séance en cours) : nature, description (2 000 caractères) et
 * jusqu'à 10 photos. La séance passe « interrompue » ; le superviseur décide de la suite.
 */
export function IncidentForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy?: boolean;
  onSubmit: (input: IncidentInput) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ category?: string; note?: string }>({});

  const shown = useMemo(
    () =>
      photos.map((_, index): FieldPhoto => ({
        fileId: `incident-${index}`,
        kind: 'incident',
        takenAt: '',
        url: null,
        urlExpiresAt: null,
      })),
    [photos],
  );
  const local = useMemo(
    () => Object.fromEntries(photos.map((photo, index) => [`incident-${index}`, photo as Blob])),
    [photos],
  );

  function submit() {
    const next = {
      category: category ? undefined : t.categoryMissing,
      note: note.trim() ? undefined : t.incidentNoteMissing,
    };
    setErrors(next);
    if (next.category) return document.getElementById('incident-nature')?.focus();
    if (next.note) return document.getElementById('incident-note')?.focus();
    onSubmit({ category, note: note.trim(), photos });
  }

  return (
    <section
      aria-labelledby="incident-titre"
      className="rounded-card border-warning bg-surface grid gap-4 border-2 p-4"
    >
      <h3 id="incident-titre" className="font-display text-ink text-lg font-semibold">
        {t.incidentTitle}
      </h3>
      <p className="text-ink-muted">{t.incidentHint}</p>
      <Fieldset id="incident-nature-groupe" legend={t.category} error={errors.category}>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(INCIDENT_CATEGORY).map(([code, label], index) => (
            <ChoicePill
              key={code}
              id={index === 0 ? 'incident-nature' : undefined}
              name="incident-nature"
              value={code}
              label={label}
              checked={category === code}
              onChange={() => {
                setCategory(code);
                setErrors((current) => ({ ...current, category: undefined }));
              }}
              disabled={busy}
            />
          ))}
        </div>
      </Fieldset>
      <TextAreaField
        id="incident-note"
        label={t.incidentNote}
        value={note}
        maxLength={NOTE_MAX}
        counter={t.incidentNoteCounter(note.length)}
        error={errors.note}
        onChange={(event) => {
          setNote(event.target.value);
          setErrors((current) => ({ ...current, note: undefined }));
        }}
        disabled={busy}
      />
      <div className="grid gap-3">
        <p className="text-ink font-semibold">{t.incidentPhotos}</p>
        {photos.length ? (
          <PhotoGrid
            photos={shown}
            marks={{}}
            local={local}
            label={t.incidentPhotos}
            onRemove={(photo) =>
              setPhotos((current) => current.filter((_, index) => `incident-${index}` !== photo.fileId))
            }
          />
        ) : null}
        {photos.length < MAX_PHOTOS ? (
          <PhotoCapture
            id="photo-incident"
            label={fieldTexts.photos.take}
            onPhoto={(file) => setPhotos((current) => [...current, file])}
            disabled={busy}
          />
        ) : null}
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button
          variant="primary"
          onClick={submit}
          disabled={busy}
          aria-busy={busy || undefined}
          className="w-full sm:w-auto"
        >
          {busy ? t.incidentSending : t.incidentSubmit}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="w-full sm:w-auto">
          {t.cancel}
        </Button>
      </div>
    </section>
  );
}
