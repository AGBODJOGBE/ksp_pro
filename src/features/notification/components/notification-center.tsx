'use client';

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { listNotifications, markAllRead, markRead } from '@/features/notification/api';
import { internalLink } from '@/features/notification/links';
import type { InAppNotification } from '@/features/notification/schemas';
import { notificationTexts as t } from '@/features/notification/texts';

const describe = (error: unknown) => (error instanceof ApiError ? error.message : t.genericError);

/** Espace qui affiche le centre : textes, et liens reconnus (fiche d'un dossier du partenaire). */
export type NotificationSpace = 'agent' | 'partner';

/**
 * Une notification : titre, texte, date, « Marquer comme lue ». Les messages de l'agent n'ont pas de lien
 * (« Retrouvez les détails dans votre application KSP ») : aucun bouton « Voir ». Ceux du partenaire
 * mènent à la fiche du dossier quand leur lien est une adresse de l'Espace pro (B2) : « Voir le dossier »,
 * jamais préchargé (chaque ouverture de la fiche est tracée par le back).
 */
function NotificationItem({
  notification,
  onRead,
}: {
  notification: InAppNotification;
  onRead: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const unread = notification.readAt === null;
  const titleId = `notification-${notification.id}`;
  const href = internalLink(notification.link, globalThis.location?.origin);

  async function read() {
    setPending(true);
    await onRead(notification.id);
    setPending(false);
  }

  return (
    <li
      aria-labelledby={titleId}
      className={cn(
        'rounded-card border-line bg-surface grid gap-2 border p-4 shadow-xs sm:p-5',
        unread && 'border-l-action border-l-4',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={titleId} className={cn('text-ink text-lg', unread ? 'font-bold' : 'font-semibold')}>
          {notification.title}
        </h2>
        {unread ? (
          <Badge tone="action" dot>
            {t.unreadLabel}
          </Badge>
        ) : null}
      </div>
      <p className="text-ink-muted whitespace-pre-line">{notification.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-ink-subtle">
          <time dateTime={notification.createdAt}>
            {t.receivedOn(formatDateTime(notification.createdAt))}
          </time>
        </p>
        <div className="flex flex-wrap gap-2">
          {href ? (
            <ButtonLink href={href} prefetch={false} variant="secondary" aria-describedby={titleId}>
              {t.openFile}
            </ButtonLink>
          ) : null}
          {unread ? (
            <Button
              variant="ghost"
              onClick={read}
              aria-busy={pending || undefined}
              aria-describedby={titleId}
              disabled={pending}
            >
              {t.markRead}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Notifications({ unreadOnly }: { unreadOnly: boolean }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [readIds, setReadIds] = useState<Record<string, string>>({});
  const [allPending, setAllPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      const page = await listNotifications(cursor, unreadOnly);
      setUnreadCount(page.unreadCount);
      return page;
    },
    [unreadOnly],
  );
  const list = usePagedList(load, describe);

  async function onRead(id: string) {
    setMessage(null);
    try {
      const result = await markRead(id);
      setReadIds((previous) => ({
        ...previous,
        [id]: result.notification.readAt ?? new Date().toISOString(),
      }));
      setUnreadCount(result.unreadCount);
    } catch (error) {
      setMessage({ tone: 'error', text: describe(error) });
    }
  }

  async function onReadAll() {
    setAllPending(true);
    setMessage(null);
    try {
      const result = await markAllRead();
      const now = new Date().toISOString();
      setReadIds((previous) => ({
        ...previous,
        ...Object.fromEntries(list.items.map((item) => [item.id, previous[item.id] ?? item.readAt ?? now])),
      }));
      setUnreadCount(result.unreadCount);
      setMessage({ tone: 'success', text: t.allMarked });
    } catch (error) {
      setMessage({ tone: 'error', text: describe(error) });
    } finally {
      setAllPending(false);
    }
  }

  const items = list.items.map((item) => (readIds[item.id] ? { ...item, readAt: readIds[item.id]! } : item));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink font-medium" role="status">
          {unreadCount === null ? '' : t.unreadCount(unreadCount)}
        </p>
        {unreadCount ? (
          <Button
            variant="secondary"
            onClick={onReadAll}
            aria-busy={allPending || undefined}
            disabled={allPending}
          >
            {allPending ? t.markingAll : t.markAllRead}
          </Button>
        ) : null}
      </div>
      <FormMessage tone={message?.tone ?? 'error'}>{message?.text}</FormMessage>
      <PagedListState
        list={{ ...list, items }}
        labels={t}
        empty={<p className="text-ink">{unreadOnly ? t.emptyUnread : t.empty}</p>}
      >
        <ul className="grid gap-3">
          {items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onRead={onRead} />
          ))}
        </ul>
      </PagedListState>
    </div>
  );
}

const CHIP =
  'inline-flex min-h-12 items-center rounded-full border px-5 font-semibold focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** « Notifications » : filtre (toutes, non lues), liste paginée, marquer lu, tout marquer lu. */
export function NotificationCenter({ space = 'agent' }: { space?: NotificationSpace }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const choices = [
    { value: false, label: t.filterAll },
    { value: true, label: t.filterUnread },
  ];
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted mt-1">{space === 'partner' ? t.partnerLead : t.lead}</p>
      </div>
      <div role="group" aria-label={t.filtersLabel} className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice.label}
            type="button"
            aria-pressed={unreadOnly === choice.value}
            onClick={() => setUnreadOnly(choice.value)}
            className={cn(
              CHIP,
              unreadOnly === choice.value
                ? 'border-brand bg-brand text-on-brand'
                : 'border-line-strong bg-surface text-ink hover:border-brand',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {/* Une clé par filtre : la liste repart de la première page, avec son chargement. */}
      <Notifications key={unreadOnly ? 'unread' : 'all'} unreadOnly={unreadOnly} />
    </div>
  );
}
