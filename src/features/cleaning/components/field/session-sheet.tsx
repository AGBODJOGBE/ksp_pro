'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Skeleton } from '@/components/ui/skeleton';
import { IconCheck, IconFlag, IconLocate } from '@/components/ui/icons';
import { formatDate, formatTime } from '@/lib/format';
import { currentPosition } from '@/lib/geo';
import { useNow } from '@/lib/use-now';
import type { AgentSession, ChecklistItem, FieldPhoto } from '@/features/cleaning/field-schemas';
import { fieldTexts } from '@/features/cleaning/field-texts';
import {
  INCIDENT_CATEGORY,
  INCIDENT_DECISION,
  SESSION_STATUS,
  sessionTexts,
} from '@/features/cleaning/session-texts';
import { discardEntry } from '@/features/cleaning/field/outbox';
import { markKey, type Overlay, overlaySession } from '@/features/cleaning/field/overlay';
import {
  useFieldAccount,
  useFieldSheet,
  useGesture,
  useSheetOutbox,
} from '@/features/cleaning/field/use-field-sheet';
import { Checklist } from './checklist';
import {
  ArrivalSummary,
  BackToToday,
  GestureMessage,
  MarkBadge,
  OutboxNotice,
  PlaceCard,
  SheetFailure,
  Step,
  type StepState,
} from './field-ui';
import type { IncidentInput } from './incident-form';
import { MAX_PHOTOS, PhotoCapture, PhotoGrid } from './photos';
import type { MissedInput } from './session-missed-form';
import { SheetSkeleton } from './sheet-skeleton';

const t = fieldTexts;

/*
 * Panneaux ouverts à la demande : hors du chargement de la fiche (préchargés avec réseau). Chacun attend
 * dans son propre cadre (`loading`) : sans lui, la fiche entière repasserait par son chargement.
 */
const panels = () => import('./session-panels');
const PanelLoading = () => <Skeleton className="rounded-card h-44 w-full" />;
const IncidentForm = dynamic(() => panels().then((module_) => module_.IncidentForm), {
  loading: PanelLoading,
});
const SessionMissedForm = dynamic(() => panels().then((module_) => module_.SessionMissedForm), {
  loading: PanelLoading,
});
const SignaturePad = dynamic(() => panels().then((module_) => module_.SignaturePad), {
  loading: PanelLoading,
});
const s = sessionTexts;
const TERMINAL = new Set(['completed', 'missed', 'cancelled']);

/**
 * Fiche d'une séance (`/agent/seance?id=`) : équipe, lieu, puis le parcours en 6 étapes (arrivée, photos
 * « avant », démarrage, liste de contrôle, photos « après », clôture avec la signature facultative du
 * client). Les gestes du chef d'équipe sont masqués, et expliqués, pour les autres membres. « Signaler un
 * incident » et « Client absent ou accès impossible » restent à portée en cas de problème.
 */
export function SessionSheet() {
  const id = useSearchParams().get('id');
  const userId = useFieldAccount();
  const { state, reload, accept } = useFieldSheet<AgentSession>('session', id, userId);
  const outbox = useSheetOutbox('session', id, userId);

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
          {s.title}
        </Heading>
        <SheetFailure message={state.message} correlationId={state.correlationId} onRetry={reload} />
      </div>
    );
  return (
    <SessionBody
      overlay={overlaySession(state.view, outbox.entries, outbox.inFlight)}
      savedAt={state.savedAt}
      entries={outbox.entries}
      inFlight={outbox.inFlight}
      userId={userId}
      onView={accept}
    />
  );
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function SessionBody({
  overlay,
  savedAt,
  entries,
  inFlight,
  userId,
  onView,
}: {
  overlay: Overlay<AgentSession>;
  savedAt: number | null;
  entries: ReturnType<typeof useSheetOutbox>['entries'];
  inFlight: number | null;
  userId: string | null;
  onView: (view: AgentSession) => void;
}) {
  const { view: session, marks, local, sources } = overlay;
  const now = useNow();
  const [panel, setPanel] = useState<'incident' | 'missed' | 'close' | null>(null);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [positionNote, setPositionNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const context = `${session.place.placeTypeName} · ${session.place.communeName} · ${formatTime(session.scheduledStart)}`;
  const gesture = useGesture<AgentSession>({
    kind: 'session',
    id: session.id,
    userId,
    scheduled: session.scheduledStart,
    context,
    onView,
  });
  const status = SESSION_STATUS[session.status] ?? { label: session.status, tone: 'neutral' as const };
  const lead = session.isLead;
  const leader = session.team.find((member) => member.isLead);
  const terminal = TERMINAL.has(session.status);
  const assigned = session.status === 'assigned';
  const running = session.status === 'in_progress';
  const arrived = session.arrival !== null;
  const before = session.photos.filter((photo) => photo.kind === 'before');
  const after = session.photos.filter((photo) => photo.kind === 'after');
  const allChecked = session.checklist.every((item) => item.checked);
  const started = now !== null && now >= Date.parse(session.scheduledStart);
  const busy = gesture.busy !== null || locating;
  const occurredAt = () => new Date().toISOString();

  async function arrive() {
    const at = occurredAt();
    setLocating(true);
    setPositionNote(null);
    const located = await currentPosition();
    setLocating(false);
    if (!located.ok)
      setPositionNote(located.failure === 'denied' ? t.arrival.denied : t.arrival.withoutPosition);
    await gesture.run(
      'arrive',
      'session.arrive',
      located.ok ? { ...located.position, occurredAt: at } : { occurredAt: at },
    );
  }

  const addPhoto = (kind: 'before' | 'after') => (file: File) =>
    void gesture.run(
      `photo-${kind}`,
      'session.photo',
      { kind, occurredAt: occurredAt() },
      {
        files: [{ field: 'fileId', blob: file, name: file.name || 'photo.jpg' }],
      },
    );

  async function removePhoto(photo: FieldPhoto) {
    const source = sources[photo.fileId];
    if (source !== undefined) {
      if (source !== inFlight) await discardEntry(source);
      return;
    }
    await gesture.run('remove', 'session.photo.remove', {}, { ref: photo.fileId });
  }

  const start = () => gesture.run('start', 'session.start', { occurredAt: occurredAt() });

  function toggle(item: ChecklistItem, checked: boolean) {
    const tick = {
      code: item.code,
      checked,
      ...(item.cleaningTypeCode ? { cleaningTypeCode: item.cleaningTypeCode } : {}),
    };
    void gesture.run(
      'checklist',
      'session.checklist',
      { items: [tick], occurredAt: occurredAt() },
      {
        label: item.label,
        quiet: true,
      },
    );
  }

  async function reportIncident(input: IncidentInput) {
    const done = await gesture.run(
      'incident',
      'session.incident',
      { category: input.category, note: input.note, occurredAt: occurredAt() },
      {
        files: input.photos.map((photo) => ({
          field: 'photoFileIds',
          blob: photo,
          name: photo.name || 'incident.jpg',
        })),
      },
    );
    if (done) setPanel(null);
  }

  async function reportMissed(input: MissedInput) {
    const done = await gesture.run(
      'missed',
      'session.missed',
      {
        cause: input.cause,
        waitStartedAt: input.waitStartedAt,
        calledAt: input.calledAt,
        occurredAt: occurredAt(),
      },
      { files: [{ field: 'photoFileId', blob: input.photo, name: input.photo.name || 'lieu.jpg' }] },
    );
    if (done) setPanel(null);
  }

  async function close() {
    const done = await gesture.run(
      'complete',
      'session.complete',
      { occurredAt: occurredAt() },
      signature ? { files: [{ field: 'signatureFileId', blob: signature, name: 'signature.png' }] } : {},
    );
    if (done) setPanel(null);
  }

  const canRemove = (photo: FieldPhoto) =>
    sources[photo.fileId] === undefined || sources[photo.fileId] !== inFlight;
  const stepState = (done: boolean, current: boolean): StepState =>
    done ? 'done' : current ? 'current' : 'later';

  const arrivalState = stepState(arrived, assigned && !arrived);
  const beforeState = stepState(before.length > 0 && !assigned, assigned && (arrived || !lead));
  const startState = stepState(session.startedAt !== null, assigned && before.length > 0);
  const checklistState = stepState(allChecked && (running || terminal), running && !allChecked);
  // Photos « après » : possibles pendant la liste, mises en avant une fois la liste complète.
  const afterState: StepState =
    after.length > 0 ? 'done' : !running ? 'later' : allChecked ? 'current' : 'open';
  const closeState = stepState(session.status === 'completed', running && allChecked && after.length > 0);

  const captureMain = (kind: 'before' | 'after') => (
    <PhotoCapture
      id={`photo-${kind}-principale`}
      label={kind === 'before' ? t.photos.takeBefore : t.photos.takeAfter}
      onPhoto={addPhoto(kind)}
      disabled={busy}
      variant="action"
    />
  );

  let main: ReactNode = null;
  if (assigned) {
    if (lead && !arrived)
      main = (
        <Button variant="action" size="lg" className="w-full sm:w-auto" onClick={arrive} disabled={busy}>
          <IconLocate className="size-6" />
          {locating ? t.arrival.locating : gesture.busy === 'arrive' ? t.arrival.sending : t.arrival.action}
        </Button>
      );
    else if (!before.length) main = captureMain('before');
    else if (lead)
      main = (
        <Button
          variant="action"
          size="lg"
          className="w-full sm:w-auto"
          onClick={start}
          disabled={busy}
          aria-busy={gesture.busy === 'start' || undefined}
        >
          {gesture.busy === 'start' ? s.starting : s.start}
        </Button>
      );
  } else if (running && allChecked) {
    if (!after.length) main = captureMain('after');
    else if (lead)
      main =
        panel === 'close' ? (
          <Button
            variant="action"
            size="lg"
            className="w-full sm:w-auto"
            onClick={close}
            disabled={busy}
            aria-busy={gesture.busy === 'complete' || undefined}
          >
            <IconCheck className="size-6" />
            {gesture.busy === 'complete' ? s.closing : s.closeSubmit}
          </Button>
        ) : (
          <Button
            variant="action"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setPanel('close')}
            disabled={busy}
          >
            {s.closeOpen}
          </Button>
        );
  }

  let outcome: string | null = null;
  if (session.status === 'interrupted') outcome = s.interrupted;
  else if (session.status === 'missed') outcome = s.missed;
  else if (session.status === 'cancelled') outcome = s.cancelled;
  else if (session.status === 'suspended') outcome = s.suspended;

  return (
    <article aria-labelledby="fiche-titre" className="grid gap-5">
      <BackToToday />
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {lead ? <Badge tone="accent">{t.lead}</Badge> : null}
        </div>
        <Heading as="h1" size="h2" id="fiche-titre">
          {s.title}
        </Heading>
        <p className="text-ink-muted text-lg first-letter:uppercase">
          {formatDate(session.scheduledStart)}, {formatTime(session.scheduledStart)} –{' '}
          {formatTime(session.scheduledEnd)}
        </p>
        <p className="text-small text-ink-muted">{s.program(session.programNumber, session.rank)}</p>
        {savedAt ? (
          <FormMessage tone="info">{t.cachedAt(formatTime(new Date(savedAt).toISOString()))}</FormMessage>
        ) : null}
      </header>

      <OutboxNotice entries={entries} />
      {outcome ? <FormMessage tone="info">{outcome}</FormMessage> : null}
      <p className="rounded-control bg-surface-muted text-ink p-3">
        {lead ? s.youLead : leader ? s.notLead(`${leader.firstName} ${leader.lastName}`) : s.notLeadNoName}
      </p>

      <section
        aria-labelledby="equipe-titre"
        className="rounded-card border-line bg-surface grid gap-3 border p-4 sm:p-5"
      >
        <h2 id="equipe-titre" className="font-display text-ink text-lg font-semibold">
          {s.team}
        </h2>
        <ul className="grid gap-2">
          {session.team.map((member) => (
            <li key={member.agentId} className="flex items-center gap-3">
              {member.photoUrl ? (
                // Lien temporaire du service file : aucune optimisation d'image à attendre.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.photoUrl} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-brand-soft text-brand-ink grid size-10 place-items-center rounded-full text-sm font-bold"
                >
                  {initials(member.firstName, member.lastName)}
                </span>
              )}
              <span className="text-ink min-w-0 flex-1 font-medium">
                {member.firstName} {member.lastName}
              </span>
              {member.isLead ? <Badge tone="accent">{t.lead}</Badge> : null}
              {member.confirmation !== 'confirmed' ? (
                <Badge tone="neutral">{s.confirmation[member.confirmation] ?? member.confirmation}</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <PlaceCard
        place={session.place}
        hidden={t.place.hiddenSession(session.place.placeTypeName, session.place.communeName)}
      />

      <ol aria-label={t.steps} className="grid gap-3">
        <Step
          id="etape-arrivee"
          index={1}
          title={t.arrival.title}
          state={arrivalState}
          badge={<MarkBadge mark={marks.arrival} />}
          status={
            session.arrival ? (
              <ArrivalSummary arrival={session.arrival} />
            ) : lead ? (
              t.arrival.hint
            ) : (
              t.arrival.leadOnly
            )
          }
        >
          {positionNote ? <FormMessage tone="info">{positionNote}</FormMessage> : null}
          <GestureMessage result={gesture.messageFor('arrive')} />
        </Step>

        <Step
          id="etape-avant"
          index={2}
          title={s.beforeTitle}
          state={beforeState}
          badge={
            <span className="text-small text-ink-muted tabular-nums">{t.photos.count(before.length)}</span>
          }
          status={t.photos.beforeHint}
        >
          <PhotoGrid
            photos={before}
            marks={marks}
            local={local}
            label={s.beforeTitle}
            onRemove={assigned ? (photo) => void removePhoto(photo) : undefined}
            canRemove={canRemove}
          />
          {assigned && before.length > 0 && before.length < MAX_PHOTOS ? (
            <PhotoCapture
              id="photo-avant"
              label={t.photos.takeBefore}
              onPhoto={addPhoto('before')}
              disabled={busy}
            />
          ) : null}
          <GestureMessage result={gesture.messageFor('photo-before') ?? gesture.messageFor('remove')} />
        </Step>

        <Step
          id="etape-demarrage"
          index={3}
          title={s.startTitle}
          state={startState}
          badge={<MarkBadge mark={marks.start} />}
          status={
            session.startedAt
              ? s.started(formatTime(session.startedAt))
              : !lead
                ? s.startLeadOnly
                : before.length
                  ? null
                  : s.startLocked
          }
        >
          <GestureMessage result={gesture.messageFor('start')} />
        </Step>

        <Step
          id="etape-liste"
          index={4}
          title={s.checklistTitle}
          state={checklistState}
          status={running || terminal ? s.checklistHint : s.checklistLocked}
        >
          {running || session.startedAt ? (
            <Checklist items={session.checklist} marks={marks} disabled={!running} onToggle={toggle} />
          ) : null}
          <GestureMessage result={gesture.messageFor('checklist')} />
        </Step>

        <Step
          id="etape-apres"
          index={5}
          title={s.afterTitle}
          state={afterState}
          badge={
            <span className="text-small text-ink-muted tabular-nums">{t.photos.count(after.length)}</span>
          }
          status={t.photos.afterHint}
        >
          {running || after.length ? (
            <PhotoGrid
              photos={after}
              marks={marks}
              local={local}
              label={s.afterTitle}
              onRemove={running ? (photo) => void removePhoto(photo) : undefined}
              canRemove={canRemove}
            />
          ) : null}
          {running && (after.length > 0 || !allChecked) && after.length < MAX_PHOTOS ? (
            <PhotoCapture
              id="photo-apres"
              label={t.photos.takeAfter}
              onPhoto={addPhoto('after')}
              disabled={busy}
            />
          ) : null}
          <GestureMessage result={gesture.messageFor('photo-after')} />
        </Step>

        <Step
          id="etape-cloture"
          index={6}
          title={s.closeTitle}
          state={closeState}
          badge={<MarkBadge mark={marks.complete} />}
          status={
            session.status === 'completed' && session.completedAt
              ? s.closed(formatTime(session.completedAt))
              : !lead
                ? s.closeLeadOnly
                : running && allChecked && after.length
                  ? null
                  : s.closeLocked
          }
        >
          {lead && running && panel === 'close' ? (
            <>
              <SignaturePad id="signature" onChange={setSignature} disabled={busy} />
              <Button
                variant="ghost"
                onClick={() => setPanel(null)}
                className="justify-self-start"
                disabled={busy}
              >
                {s.cancel}
              </Button>
            </>
          ) : null}
          <GestureMessage result={gesture.messageFor('complete')} />
        </Step>
      </ol>

      {session.incidents.length ? (
        <section aria-labelledby="incidents-titre" className="grid gap-3">
          <h2 id="incidents-titre" className="font-display text-ink text-lg font-semibold">
            {s.incidents}
          </h2>
          <ul className="grid gap-2">
            {session.incidents.map((incident) => {
              const decision = INCIDENT_DECISION[incident.decision] ?? {
                label: incident.decision,
                tone: 'neutral' as const,
              };
              return (
                <li key={incident.id} className="rounded-card border-line bg-surface grid gap-2 border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink font-semibold">
                      {INCIDENT_CATEGORY[incident.category] ?? incident.category}
                    </span>
                    <span className="text-small text-ink-muted">{formatTime(incident.reportedAt)}</span>
                    <Badge tone={decision.tone}>{decision.label}</Badge>
                    <MarkBadge mark={marks[markKey.incident(incident.id)]} />
                  </div>
                  <p className="text-ink whitespace-pre-line">{incident.note}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!terminal && session.status !== 'suspended' ? (
        <section aria-labelledby="probleme-titre" className="grid gap-3">
          <h2 id="probleme-titre" className="font-display text-ink text-lg font-semibold">
            {s.otherActions}
          </h2>
          {panel === 'incident' ? (
            <IncidentForm
              busy={gesture.busy === 'incident'}
              onSubmit={reportIncident}
              onCancel={() => setPanel(null)}
            />
          ) : panel === 'missed' ? (
            <SessionMissedForm
              scheduledStart={session.scheduledStart}
              arrivedAt={session.arrival?.arrivedAt ?? null}
              busy={gesture.busy === 'missed'}
              onSubmit={reportMissed}
              onCancel={() => setPanel(null)}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Button variant="secondary" onClick={() => setPanel('incident')} disabled={busy || !running}>
                  <IconFlag className="size-5" />
                  {s.incidentOpen}
                </Button>
                {!running ? <p className="text-small text-ink-muted">{s.incidentLocked}</p> : null}
              </div>
              <div className="grid gap-1">
                {!assigned ? null : lead ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setPanel('missed')}
                      disabled={busy || !started}
                    >
                      {s.missedOpen}
                    </Button>
                    {assigned && !started ? (
                      <p className="text-small text-ink-muted">
                        {s.missedNotBefore(formatTime(session.scheduledStart))}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-small text-ink-muted">{s.missedLeadOnly}</p>
                )}
              </div>
            </div>
          )}
          <GestureMessage result={gesture.messageFor('incident') ?? gesture.messageFor('missed')} />
        </section>
      ) : null}

      {main ? <BottomBar>{main}</BottomBar> : null}
    </article>
  );
}
