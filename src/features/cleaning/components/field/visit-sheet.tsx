'use client';

import { useSearchParams } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconCheck, IconLocate } from '@/components/ui/icons';
import { SummaryRow } from '@/components/ui/form-fields';
import { formatDate, formatDuration, formatTime } from '@/lib/format';
import { currentPosition } from '@/lib/geo';
import { useNow } from '@/lib/use-now';
import type { AgentVisit } from '@/features/cleaning/field-schemas';
import { fieldTexts } from '@/features/cleaning/field-texts';
import { VISIT_STATUS, visitTexts } from '@/features/cleaning/visit-texts';
import { discardEntry } from '@/features/cleaning/field/outbox';
import { displayValue, formParameters } from '@/features/cleaning/field/observations';
import { type Overlay, overlayVisit } from '@/features/cleaning/field/overlay';
import {
  useFieldAccount,
  useFieldSheet,
  useGesture,
  useSheetOutbox,
} from '@/features/cleaning/field/use-field-sheet';
import {
  ArrivalSummary,
  BackToToday,
  ConfirmInline,
  GestureMessage,
  MarkBadge,
  OutboxNotice,
  PlaceCard,
  SheetFailure,
  Step,
  type StepState,
} from './field-ui';
import { ObservationForm } from './observation-form';
import { MAX_PHOTOS, PhotoCapture, PhotoGrid } from './photos';
import { SheetSkeleton } from './sheet-skeleton';

const t = fieldTexts;
const vt = visitTexts;
const FORM_ID = 'constat';
const TERMINAL = new Set(['completed', 'missed', 'cancelled']);

/**
 * Fiche d'une visite des lieux (`/agent/visite?id=`) : parcours guidé en 4 étapes (arrivée, constat,
 * photos, fin), une action principale à la fois dans la barre du bas. Chaque geste part dans la file
 * d'attente : sans réseau, il s'affiche tout de suite comme fait, « en attente d'envoi ».
 */
export function VisitSheet() {
  const id = useSearchParams().get('id');
  const userId = useFieldAccount();
  const { state, reload, accept } = useFieldSheet<AgentVisit>('visit', id, userId);
  const outbox = useSheetOutbox('visit', id, userId);

  if (!id)
    return (
      <div className="grid gap-4">
        <BackToToday />
        <p className="text-ink-muted">{t.missing}</p>
      </div>
    );
  if (state.status === 'loading') return <SheetSkeleton label={t.loading} />;
  if (state.status === 'error')
    return (
      <div className="grid gap-4">
        <BackToToday />
        <Heading as="h1" size="h2">
          {vt.visit.title}
        </Heading>
        <SheetFailure message={state.message} correlationId={state.correlationId} onRetry={reload} />
      </div>
    );
  return (
    <VisitBody
      overlay={overlayVisit(state.view, outbox.entries, outbox.inFlight)}
      savedAt={state.savedAt}
      entries={outbox.entries}
      inFlight={outbox.inFlight}
      userId={userId}
      onView={accept}
    />
  );
}

function VisitBody({
  overlay,
  savedAt,
  entries,
  inFlight,
  userId,
  onView,
}: {
  overlay: Overlay<AgentVisit>;
  savedAt: number | null;
  entries: ReturnType<typeof useSheetOutbox>['entries'];
  inFlight: number | null;
  userId: string | null;
  onView: (view: AgentVisit) => void;
}) {
  const { view: visit, marks, local, sources } = overlay;
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [absentPhoto, setAbsentPhoto] = useState<File | null>(null);
  const [absentError, setAbsentError] = useState<string | null>(null);
  const [positionNote, setPositionNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const context = `${visit.place.placeTypeName} · ${visit.place.communeName} · ${formatTime(visit.scheduledAt)}`;
  const gesture = useGesture<AgentVisit>({
    kind: 'visit',
    id: visit.id,
    userId,
    scheduled: visit.scheduledAt,
    context,
    onView,
  });
  const status = VISIT_STATUS[visit.status] ?? { label: visit.status, tone: 'neutral' as const };
  const terminal = TERMINAL.has(visit.status);
  const arrived = visit.arrival !== null;
  const observed = visit.observedValues !== null;
  const started = now !== null && now >= Date.parse(visit.scheduledAt);
  const busy = gesture.busy !== null || locating;
  const occurredAt = () => new Date().toISOString();

  const parameters = useMemo(() => formParameters(visit.parameters), [visit.parameters]);
  const photoCount = visit.photos.length;

  async function arrive() {
    const at = occurredAt();
    setLocating(true);
    setPositionNote(null);
    const located = await currentPosition();
    setLocating(false);
    if (!located.ok)
      setPositionNote(located.failure === 'denied' ? t.arrival.denied : t.arrival.withoutPosition);
    const body = located.ok ? { ...located.position, occurredAt: at } : { occurredAt: at };
    await gesture.run('arrive', 'visit.arrive', body);
  }

  async function saveObservations(input: { values: Record<string, unknown>; note: string }) {
    const done = await gesture.run('observations', 'visit.observations', {
      values: input.values,
      ...(input.note ? { note: input.note } : {}),
      occurredAt: occurredAt(),
    });
    if (done) setEditing(false);
  }

  async function addPhoto(file: File) {
    await gesture.run(
      'photo',
      'visit.photo',
      { occurredAt: occurredAt() },
      {
        files: [{ field: 'fileId', blob: file, name: file.name || 'photo.jpg' }],
      },
    );
  }

  async function removePhoto(photoId: string) {
    const source = sources[photoId];
    if (source !== undefined) {
      if (source !== inFlight) await discardEntry(source);
      return;
    }
    await gesture.run('remove', 'visit.photo.remove', {}, { ref: photoId });
  }

  async function complete() {
    const done = await gesture.run('complete', 'visit.complete', { occurredAt: occurredAt() });
    if (done) setConfirming(false);
  }

  async function reportAbsent() {
    if (!absentPhoto) return setAbsentError(vt.visit.missedPhotoMissing);
    setAbsentError(null);
    const done = await gesture.run(
      'missed',
      'visit.missed',
      { occurredAt: occurredAt() },
      { files: [{ field: 'photoFileId', blob: absentPhoto, name: absentPhoto.name || 'lieu.jpg' }] },
    );
    if (done) {
      setAbsentOpen(false);
      setAbsentPhoto(null);
    }
  }

  const arrivalState: StepState = arrived ? 'done' : terminal ? 'later' : 'current';
  const constatState: StepState = observed && !editing ? 'done' : arrived && !terminal ? 'current' : 'later';
  // Photos facultatives : mises en avant seulement une fois le constat fait.
  const photoState: StepState =
    photoCount > 0 ? 'done' : !arrived || terminal ? 'later' : observed && !editing ? 'current' : 'open';
  const finishState: StepState = TERMINAL.has(visit.status)
    ? 'done'
    : observed && !editing
      ? 'current'
      : 'later';
  const showForm = arrived && !terminal && (!observed || editing);

  let main: ReactNode = null;
  if (!terminal) {
    if (!arrived)
      main = (
        <Button
          variant="action"
          size="lg"
          className="w-full sm:w-auto"
          onClick={arrive}
          disabled={busy}
          aria-busy={locating || gesture.busy === 'arrive' || undefined}
        >
          <IconLocate className="size-6" />
          {locating ? t.arrival.locating : gesture.busy === 'arrive' ? t.arrival.sending : t.arrival.action}
        </Button>
      );
    else if (showForm)
      main = (
        <Button
          type="submit"
          form={FORM_ID}
          variant="action"
          size="lg"
          className="w-full sm:w-auto"
          disabled={busy || !started}
          aria-busy={gesture.busy === 'observations' || undefined}
        >
          {gesture.busy === 'observations' ? vt.observations.saving : vt.observations.save}
        </Button>
      );
    else if (confirming)
      main = (
        <ConfirmInline
          question={vt.visit.confirmComplete(photoCount)}
          yes={vt.visit.confirmCompleteYes}
          no={vt.visit.confirmNo}
          onYes={complete}
          onNo={() => setConfirming(false)}
          busy={busy}
        />
      );
    else
      main = (
        <Button
          variant="action"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => setConfirming(true)}
          disabled={busy || !started}
        >
          <IconCheck className="size-6" />
          {vt.visit.complete}
        </Button>
      );
  }

  return (
    <article aria-labelledby="fiche-titre" className="grid gap-5">
      <BackToToday />
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {visit.isLead ? <Badge tone="accent">{t.lead}</Badge> : null}
        </div>
        <Heading as="h1" size="h2" id="fiche-titre">
          {vt.visit.title}
        </Heading>
        <p className="text-ink-muted text-lg first-letter:uppercase">
          {formatDate(visit.scheduledAt)}, {formatTime(visit.scheduledAt)} ·{' '}
          {vt.visit.duration(formatDuration(visit.durationMinutes))}
        </p>
        <p className="text-small text-ink-muted">{vt.visit.request(visit.requestNumber)}</p>
        {savedAt ? (
          <FormMessage tone="info">{t.cachedAt(formatTime(new Date(savedAt).toISOString()))}</FormMessage>
        ) : null}
      </header>

      <OutboxNotice entries={entries} />
      <PlaceCard
        place={visit.place}
        hidden={t.place.hiddenVisit(visit.place.placeTypeName, visit.place.communeName)}
      />

      {visit.status === 'cancelled' ? <FormMessage tone="info">{vt.visit.cancelled}</FormMessage> : null}

      <ol aria-label={t.steps} className="grid gap-3">
        <Step
          id="etape-arrivee"
          index={1}
          title={t.arrival.title}
          state={arrivalState}
          badge={<MarkBadge mark={marks.arrival} />}
          status={visit.arrival ? <ArrivalSummary arrival={visit.arrival} /> : t.arrival.hint}
        >
          {positionNote ? <FormMessage tone="info">{positionNote}</FormMessage> : null}
          <GestureMessage result={gesture.messageFor('arrive')} />
        </Step>

        <Step
          id="etape-constat"
          index={2}
          title={vt.observations.title}
          state={constatState}
          badge={<MarkBadge mark={marks.observations} />}
          status={
            !arrived && !terminal
              ? vt.observations.locked
              : arrived && !started && !terminal
                ? vt.observations.tooEarlyHint(formatTime(visit.scheduledAt))
                : observed && !editing
                  ? vt.observations.saved
                  : null
          }
        >
          {showForm ? (
            <ObservationForm id={FORM_ID} visit={visit} disabled={busy} onSubmit={saveObservations} />
          ) : observed ? (
            <>
              <dl>
                {parameters.map((parameter) => (
                  <SummaryRow key={parameter.code} label={parameter.label}>
                    {displayValue(parameter, visit.observedValues?.[parameter.code])}
                  </SummaryRow>
                ))}
                {visit.note ? <SummaryRow label={vt.observations.note}>{visit.note}</SummaryRow> : null}
              </dl>
              {!terminal ? (
                <Button
                  variant="secondary"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                  className="justify-self-start"
                >
                  {vt.observations.edit}
                </Button>
              ) : null}
            </>
          ) : null}
          {editing ? (
            <Button variant="ghost" onClick={() => setEditing(false)} className="justify-self-start">
              {vt.observations.cancelEdit}
            </Button>
          ) : null}
          <GestureMessage result={gesture.messageFor('observations')} />
        </Step>

        <Step
          id="etape-photos"
          index={3}
          title={t.photos.visitTitle}
          state={photoState}
          badge={<span className="text-small text-ink-muted tabular-nums">{t.photos.count(photoCount)}</span>}
          status={arrived || terminal ? t.photos.hint : t.photos.locked}
        >
          {arrived || photoCount ? (
            <PhotoGrid
              photos={visit.photos}
              marks={marks}
              local={local}
              label={t.photos.visitTitle}
              onRemove={terminal ? undefined : (photo) => void removePhoto(photo.fileId)}
              canRemove={(photo) => sources[photo.fileId] !== inFlight || inFlight === null}
            />
          ) : null}
          {arrived && !terminal ? (
            photoCount >= MAX_PHOTOS ? (
              <p className="text-ink-muted">{t.photos.full}</p>
            ) : (
              <PhotoCapture id="photo-visite" label={t.photos.take} onPhoto={addPhoto} disabled={busy} />
            )
          ) : null}
          <GestureMessage result={gesture.messageFor('photo') ?? gesture.messageFor('remove')} />
        </Step>

        <Step
          id="etape-fin"
          index={4}
          title={vt.visit.finishTitle}
          state={finishState}
          badge={<MarkBadge mark={marks.complete ?? marks.missed} />}
          status={
            visit.status === 'completed' && visit.completedAt
              ? vt.visit.completed(formatTime(visit.completedAt))
              : visit.status === 'missed'
                ? vt.visit.missed
                : terminal
                  ? null
                  : observed
                    ? null
                    : vt.visit.completeLocked
          }
        >
          <GestureMessage result={gesture.messageFor('complete')} />
          {!terminal ? (
            absentOpen ? (
              <section
                aria-labelledby="absent-titre"
                className="rounded-card border-line-strong grid gap-4 border p-4"
              >
                <h3 id="absent-titre" className="font-display text-ink text-lg font-semibold">
                  {vt.visit.missedTitle}
                </h3>
                <p className="text-ink-muted">{vt.visit.missedHint}</p>
                <PhotoGrid
                  photos={
                    absentPhoto
                      ? [{ fileId: 'absence', kind: 'absence', takenAt: '', url: null, urlExpiresAt: null }]
                      : []
                  }
                  marks={{}}
                  local={absentPhoto ? { absence: absentPhoto } : {}}
                  label={vt.visit.missedPhoto}
                  onRemove={() => setAbsentPhoto(null)}
                />
                <PhotoCapture
                  id="photo-absence"
                  label={vt.visit.missedPhoto}
                  onPhoto={(file) => {
                    setAbsentPhoto(file);
                    setAbsentError(null);
                  }}
                  disabled={busy}
                />
                {absentError ? <FormMessage>{absentError}</FormMessage> : null}
                <GestureMessage result={gesture.messageFor('missed')} />
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <Button
                    variant="primary"
                    onClick={reportAbsent}
                    disabled={busy}
                    aria-busy={gesture.busy === 'missed' || undefined}
                    className="w-full sm:w-auto"
                  >
                    {gesture.busy === 'missed' ? vt.visit.missedSending : vt.visit.missedSubmit}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setAbsentOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    {vt.visit.close}
                  </Button>
                </div>
              </section>
            ) : (
              <div className="grid gap-1">
                <Button
                  variant="secondary"
                  onClick={() => setAbsentOpen(true)}
                  disabled={busy || !started}
                  className="sm:justify-self-start"
                >
                  {vt.visit.missedOpen}
                </Button>
                {!started ? (
                  <p className="text-small text-ink-muted">
                    {vt.visit.missedNotBefore(formatTime(visit.scheduledAt))}
                  </p>
                ) : null}
              </div>
            )
          ) : null}
        </Step>
      </ol>

      {main ? <BottomBar>{main}</BottomBar> : null}
    </article>
  );
}
