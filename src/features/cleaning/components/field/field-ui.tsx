'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { IconAlert, IconArrowLeft, IconCheck, IconCloudUp, IconPin, IconRoute } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { directionsUrl } from '@/lib/geo';
import type { OutboxEntry } from '@/lib/offline/outbox';
import type { FieldPlace } from '@/features/cleaning/field-schemas';
import { fieldTexts } from '@/features/cleaning/field-texts';
import type { Mark } from '@/features/cleaning/field/overlay';
import type { GestureResult } from '@/features/cleaning/field/use-field-sheet';

const t = fieldTexts;

/** Geste pas encore reçu par KSP : en attente d'envoi, en cours d'envoi, ou refusé. */
export function MarkBadge({
  mark,
  className,
  compact = false,
}: {
  mark: Mark | undefined;
  className?: string;
  /** Pastille ronde, icône seule (vignette de photo) : le libellé reste lu par les lecteurs d'écran. */
  compact?: boolean;
}) {
  if (!mark) return null;
  const label = mark === 'error' ? t.failed : mark === 'sending' ? t.sending : t.pending;
  if (compact)
    return (
      <span
        title={label}
        className={cn(
          'grid size-8 place-items-center rounded-full shadow-xs ring-2 ring-white',
          mark === 'error' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
          className,
        )}
      >
        {mark === 'error' ? <IconAlert className="size-4.5" /> : <IconCloudUp className="size-4.5" />}
        <span className="sr-only">{label}</span>
      </span>
    );
  if (mark === 'error')
    return (
      <Badge tone="danger" className={className}>
        <IconAlert className="size-3.5" />
        {t.failed}
      </Badge>
    );
  return (
    <Badge tone="warning" className={className}>
      <IconCloudUp className="size-3.5" />
      {mark === 'sending' ? t.sending : t.pending}
    </Badge>
  );
}

/** Fiche illisible : le message de la gateway (et sa référence pour le support), puis « Réessayer ». */
export function SheetFailure({
  message,
  correlationId,
  onRetry,
}: {
  message: string;
  correlationId?: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid justify-items-start gap-3">
      <FormMessage>
        {correlationId ? `${message} (${t.errors.reference(correlationId)})` : message}
      </FormMessage>
      <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={onRetry}>
        {t.retry}
      </Button>
    </div>
  );
}

/** Retour à « Aujourd'hui », en haut de chaque fiche. */
export function BackToToday() {
  return (
    <Link
      href={navigation.agentToday.href}
      className="text-ink-muted hover:text-ink focus-visible:outline-focus -ml-1 inline-flex min-h-12 items-center gap-2 self-start rounded-full px-1 font-semibold focus-visible:outline-2"
    >
      <IconArrowLeft className="size-5" />
      {t.back}
    </Link>
  );
}

/** Faite, à faire maintenant (une seule mise en avant), possible (facultative), plus tard. */
export type StepState = 'done' | 'current' | 'open' | 'later';

/**
 * Étape d'un parcours guidé : pastille numérotée (cochée une fois faite), titre, état en une ligne. L'étape
 * en cours est soulignée en orange « signal » (texte bleu nuit dessus, 4,8:1).
 */
export function Step({
  id,
  index,
  title,
  state,
  status,
  badge,
  children,
}: {
  id: string;
  index: number;
  title: string;
  state: StepState;
  status?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const label = { done: t.stepDone, current: t.stepCurrent, open: t.stepOpen, later: t.stepLater }[state];
  return (
    <li
      aria-labelledby={`${id}-titre`}
      aria-current={state === 'current' ? 'step' : undefined}
      className={cn(
        'rounded-card border p-4 sm:p-5',
        state === 'current'
          ? 'border-signal-500 bg-surface ring-signal-500/30 shadow-xs ring-2'
          : 'border-line bg-surface',
        state === 'later' && 'bg-surface-muted',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full font-bold tabular-nums',
            state === 'done' && 'bg-action text-on-action',
            state === 'current' && 'bg-signal-500 text-brand-900',
            (state === 'later' || state === 'open') && 'bg-surface-sunken text-ink-muted',
            state === 'open' && 'text-ink',
          )}
        >
          {state === 'done' ? <IconCheck className="size-5" /> : index}
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`${id}-titre`} className="font-display text-ink text-lg font-semibold">
              {title}
              <span className="sr-only"> — {label}</span>
            </h2>
            {badge}
          </div>
          {status ? <div className="text-ink-muted">{status}</div> : null}
          {children ? <div className="mt-3 grid gap-4">{children}</div> : null}
        </div>
      </div>
    </li>
  );
}

/** Lieu de l'intervention : position et adresses visibles seulement pendant l'intervention (R-EX-06, B6). */
export function PlaceCard({ place, hidden }: { place: FieldPlace; hidden: string }) {
  const location = place.location;
  const address = location?.address || location?.readableAddress;
  return (
    <section
      aria-labelledby="lieu-titre"
      className="rounded-card border-line bg-surface grid gap-3 border p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="bg-tile text-tile-ink rounded-icon grid size-11 shrink-0 place-items-center">
          <IconPin className="size-6" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h2 id="lieu-titre" className="font-display text-ink text-lg font-semibold">
            {place.name || place.placeTypeName}
          </h2>
          <p className="text-ink-muted">
            {place.placeTypeName} · {place.communeName}
          </p>
          <p className="text-ink-muted">{t.place.customer(place.customerFirstName)}</p>
        </div>
      </div>
      {location ? (
        <div className="grid gap-3">
          {address ? <p className="text-ink font-medium">{address}</p> : null}
          {location.landmark ? <p className="text-ink">{t.place.landmark(location.landmark)}</p> : null}
          <a
            href={directionsUrl(location.latitude, location.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-control border-line-strong bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-focus inline-flex min-h-12 items-center justify-center gap-2 border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 sm:justify-self-start"
          >
            <IconRoute className="size-5" />
            {t.place.directions}
            <span className="sr-only"> — {t.place.directionsHint}</span>
          </a>
        </div>
      ) : (
        <p className="text-small text-ink-muted bg-surface-muted rounded-control p-3">{hidden}</p>
      )}
    </section>
  );
}

/** Issue d'un geste près de son bouton : refus expliqué, ou « gardé sur le téléphone ». */
export function GestureMessage({ result }: { result: GestureResult | null }) {
  if (!result) return <FormMessage />;
  if (result.error) return <FormMessage>{result.error}</FormMessage>;
  return <FormMessage tone="info">{t.queued}</FormMessage>;
}

/** Résumé des gestes de cette fiche encore dans la file, avec l'accès aux envois en attente. */
export function OutboxNotice({ entries }: { entries: OutboxEntry[] }) {
  if (!entries.length) return null;
  const failed = entries.filter((entry) => entry.status === 'error').length;
  const pending = entries.length - failed;
  return (
    <div
      className={cn(
        'rounded-card flex flex-wrap items-center gap-x-4 gap-y-2 border-2 p-4',
        failed ? 'border-danger bg-danger-soft' : 'border-warning bg-warning-soft',
      )}
    >
      {failed ? (
        <IconAlert className="text-danger size-6 shrink-0" />
      ) : (
        <IconCloudUp className="text-warning size-6 shrink-0" />
      )}
      <p className="text-ink flex-1 font-semibold">
        {failed ? t.failedSummary(failed) : null}
        {failed && pending ? ' ' : null}
        {pending ? t.pendingSummary(pending) : null}
      </p>
      <Link
        href={navigation.agentOutbox.href}
        className="text-ink min-h-12 content-center font-semibold underline underline-offset-4"
      >
        {t.seeOutbox}
      </Link>
    </div>
  );
}

/** Confirmation en place d'un geste qui ne se défait pas (terminer, retirer). */
export function ConfirmInline({
  question,
  yes,
  no,
  onYes,
  onNo,
  busy,
  tone = 'action',
}: {
  question: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
  busy?: boolean;
  tone?: 'action' | 'danger';
}) {
  return (
    <div
      role="group"
      aria-label={question}
      className="rounded-card border-line-strong bg-surface grid gap-3 border p-4"
    >
      <p className="text-ink font-semibold">{question}</p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button
          variant={tone === 'danger' ? 'primary' : 'action'}
          onClick={onYes}
          disabled={busy}
          aria-busy={busy || undefined}
          className="w-full sm:w-auto"
        >
          {yes}
        </Button>
        <Button variant="secondary" onClick={onNo} disabled={busy} className="w-full sm:w-auto">
          {no}
        </Button>
      </div>
    </div>
  );
}

/** « Arrivé à 10:02, à 40 m du lieu » et l'alerte de distance. */
export function ArrivalSummary({
  arrival,
}: {
  arrival: { arrivedAt: string; distanceMeters: number | null; alert: boolean };
}) {
  return (
    <span className="grid gap-1">
      <span>
        {t.arrival.done(formatTime(arrival.arrivedAt))}
        {arrival.distanceMeters !== null ? `, ${t.arrival.distance(arrival.distanceMeters)}` : ''}
      </span>
      {arrival.alert ? <span className="text-warning font-semibold">{t.arrival.alert}</span> : null}
    </span>
  );
}

/** Ouverture d'un panneau secondaire (incident, client absent) : une seule à la fois. */
export function usePanel<T extends string>() {
  const [open, setOpen] = useState<T | null>(null);
  return { open, show: (name: T) => setOpen(name), hide: () => setOpen(null) };
}
