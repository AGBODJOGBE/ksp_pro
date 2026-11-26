'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconAlert, IconChevronRight, IconCloudUp, IconRefresh } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { useSession } from '@/lib/api';
import { beninDate, formatDateTime, formatTime } from '@/lib/format';
import type { OutboxEntry } from '@/lib/offline/outbox';
import { useNow } from '@/lib/use-now';
import { useOnline } from '@/lib/use-online';
import { fieldTexts } from '@/features/cleaning/field-texts';
import { actionLabel, outboxTexts } from '@/features/cleaning/outbox-texts';
import { parseGroup } from '@/features/cleaning/field/actions';
import { deadlineOf, nearDeadline } from '@/features/cleaning/field/deadline';
import { explainError, occurredAtReason } from '@/features/cleaning/field/explain';
import { discardEntry, flushOutbox, retryEntry, useOutbox } from '@/features/cleaning/field/outbox';
import { useFieldAccount } from '@/features/cleaning/field/account';
import { loginHref } from '@/features/identity';
import { ConfirmInline } from './field-ui';

const t = outboxTexts;

/** Heure du geste : « 10:02 », ou « 25 novembre 2026 à 10:02 » si ce n'est pas aujourd'hui. */
function when(at: number): string {
  const iso = new Date(at).toISOString();
  return beninDate(new Date(at)) === beninDate() ? formatTime(iso) : formatDateTime(iso);
}

function sheetHref(group: string): string {
  const { kind, id } = parseGroup(group);
  const base = kind === 'visit' ? navigation.agentVisit.href : navigation.agentSession.href;
  return `${base}?id=${encodeURIComponent(id)}`;
}

/**
 * « Envois en attente » (`/agent/envois`) : les gestes de terrain pas encore reçus par KSP, par
 * intervention, dans l'ordre. En attente, en cours d'envoi, ou refusés (explication, « Réessayer », détail
 * de l'erreur, « Retirer ») ; avertissement à l'approche des 72 h. « Envoyer maintenant » relance la file.
 */
export function PendingSends() {
  const userId = useFieldAccount();
  const sessionUser = useSession()?.user.id ?? null;
  const outbox = useOutbox(userId);
  const online = useOnline();
  const now = useNow(60_000);
  const [flushing, setFlushing] = useState(false);

  const groups: Array<{ group: string; entries: OutboxEntry[] }> = [];
  for (const entry of outbox.entries) {
    const found = groups.find((item) => item.group === entry.group);
    if (found) found.entries.push(entry);
    else groups.push({ group: entry.group, entries: [entry] });
  }
  // Une action en attente derrière un refus de sa même intervention ne partira qu'après lui.
  const blockedGroups = new Set(
    outbox.entries.filter((entry) => entry.status === 'error').map((entry) => entry.group),
  );
  const waiting = outbox.entries.some(
    (entry) => entry.status === 'pending' && !blockedGroups.has(entry.group),
  );

  async function sendNow() {
    if (!sessionUser) return;
    setFlushing(true);
    try {
      await flushOutbox(sessionUser);
    } finally {
      setFlushing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted">{t.lead}</p>
      </div>
      {!online ? <FormMessage tone="info">{t.offline}</FormMessage> : null}
      {outbox.stop === 'auth' || (online && !sessionUser && outbox.entries.length) ? (
        <div className="rounded-card border-warning bg-warning-soft grid gap-3 border-2 p-4">
          <p className="text-ink font-semibold">{t.signIn}</p>
          <ButtonLink
            href={loginHref(navigation.agentOutbox.href)}
            variant="primary"
            className="sm:justify-self-start"
          >
            {t.signInAction}
          </ButtonLink>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
      ) : (
        groups.map(({ group, entries }) => {
          const { kind } = parseGroup(group);
          let blocked = false;
          return (
            <section
              key={group}
              aria-labelledby={`envois-${group}`}
              className="rounded-card border-line bg-surface grid gap-3 border p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-0.5">
                  <h2 id={`envois-${group}`} className="font-display text-ink text-lg font-semibold">
                    {kind === 'visit' ? t.visit : t.session}
                  </h2>
                  {entries[0]?.context ? (
                    <p className="text-small text-ink-muted">{entries[0].context}</p>
                  ) : null}
                </div>
                <Link
                  href={sheetHref(group)}
                  className="text-ink inline-flex min-h-12 items-center gap-1 font-semibold underline underline-offset-4"
                >
                  {t.openSheet}
                  <IconChevronRight className="size-4" />
                </Link>
              </div>
              <ol className="grid gap-2">
                {entries.map((entry) => {
                  const row = (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      inFlight={outbox.inFlight === entry.id}
                      blocked={blocked}
                      now={now}
                      canSend={!!sessionUser && online}
                    />
                  );
                  if (entry.status === 'error') blocked = true;
                  return row;
                })}
              </ol>
            </section>
          );
        })
      )}

      {waiting && online && sessionUser ? (
        <BottomBar>
          <Button
            variant="action"
            size="lg"
            className="w-full sm:w-auto"
            onClick={sendNow}
            disabled={flushing || outbox.inFlight !== null}
            aria-busy={flushing || undefined}
          >
            <IconRefresh className="size-5" />
            {flushing || outbox.inFlight !== null ? t.sending : t.sendNow}
          </Button>
        </BottomBar>
      ) : null}
    </div>
  );
}

function EntryRow({
  entry,
  inFlight,
  blocked,
  now,
  canSend,
}: {
  entry: OutboxEntry;
  inFlight: boolean;
  blocked: boolean;
  now: number | null;
  canSend: boolean;
}) {
  const [details, setDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const failed = entry.status === 'error' && entry.error;
  const reason = occurredAtReason(entry.error);
  const late = now !== null && nearDeadline(entry.occurredAt, now);

  async function act(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-line grid gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ink font-semibold">{actionLabel(entry.type, entry.body)}</span>
        {entry.label ? <span className="text-ink-muted">· {entry.label}</span> : null}
        {failed ? (
          <Badge tone="danger">
            <IconAlert className="size-3.5" />
            {t.failed}
          </Badge>
        ) : (
          <Badge tone="warning">
            <IconCloudUp className="size-3.5" />
            {inFlight ? t.inFlight : t.waiting}
          </Badge>
        )}
      </div>
      <p className="text-small text-ink-muted">{t.done(when(entry.occurredAt))}</p>
      {late && !failed ? (
        <p className="text-small text-warning flex items-start gap-2 font-semibold">
          <IconAlert className="mt-0.5 size-4 shrink-0" />
          {t.deadline(formatDateTime(deadlineOf(entry.occurredAt)))}
        </p>
      ) : null}
      {blocked && !failed ? <p className="text-small text-ink-muted">{t.blocked}</p> : null}
      {failed && entry.error ? (
        <div className="grid gap-2">
          <p className="text-danger font-medium">{explainError(entry.error)}</p>
          {details ? (
            <div className="text-small text-ink-muted bg-surface-muted rounded-control grid gap-1 p-3">
              <p>{entry.error.message}</p>
              <p>{t.code(entry.error.code)}</p>
              {entry.error.correlationId ? (
                <p>{fieldTexts.errors.reference(entry.error.correlationId)}</p>
              ) : null}
            </div>
          ) : null}
          {confirming ? (
            <ConfirmInline
              question={t.confirmRemove}
              yes={t.confirmRemoveYes}
              no={t.confirmRemoveNo}
              onYes={() => act(() => discardEntry(entry.id))}
              onNo={() => setConfirming(false)}
              busy={busy}
              tone="danger"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {reason !== 'too_old' ? (
                <Button
                  variant="secondary"
                  onClick={() => act(() => retryEntry(entry))}
                  disabled={busy || !canSend}
                >
                  {t.retry}
                </Button>
              ) : null}
              {reason === 'in_future' ? (
                <Button
                  variant="secondary"
                  onClick={() => act(() => retryEntry(entry, { withoutTime: true }))}
                  disabled={busy || !canSend}
                >
                  {t.retryNow}
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setDetails((value) => !value)} aria-expanded={details}>
                {details ? t.hideDetails : t.details}
              </Button>
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
                {t.remove}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
