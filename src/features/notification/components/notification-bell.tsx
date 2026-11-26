'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconBell } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { countUnread } from '@/features/notification/api';
import { notificationTexts } from '@/features/notification/texts';

const t = notificationTexts.bell;

/**
 * Accès aux notifications avec la pastille du nombre de non lues, lu à l'affichage (pas de notification
 * en direct). Une panne de lecture n'affiche pas de pastille : le lien reste utilisable.
 */
export function NotificationBell({ href, className }: { href: string; className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    countUnread().then(
      (value) => {
        if (active) setCount(value);
      },
      () => {
        if (active) setCount(null);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const unread = count ?? 0;
  const label = count === null ? t.label : unread > 0 ? t.unread(unread) : t.none;
  return (
    <Link
      href={href}
      aria-label={`${t.label} — ${label}`}
      className={cn(
        'border-line-strong bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-focus relative grid size-12 shrink-0 place-items-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <IconBell className="size-6" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="bg-danger absolute -top-1 -right-1 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs leading-6 font-bold text-white tabular-nums"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
