'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconAlert, IconChevronRight, IconCloudUp, IconWifiOff } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { useSession } from '@/lib/api';
import { deviceAccountId } from '@/lib/api/device-account';
import { cn } from '@/lib/cn';
import { listEntries, type OutboxEntry, subscribeOutbox } from '@/lib/offline/outbox';
import { pruneToday } from '@/lib/offline/today';
import { useNow } from '@/lib/use-now';
import { useOnline } from '@/lib/use-online';
import { nearDeadline } from '@/features/cleaning/field/deadline';

/*
 * Libellés écrits ici : ce bandeau est chargé par toutes les pages de l'espace agent, sans les textes ni
 * le moteur des écrans de terrain (chargés seulement quand il y a quelque chose à envoyer).
 */
const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);
const t = {
  offline: 'Hors connexion',
  pending: (count: number) => `${count} ${plural(count, 'envoi', 'envois')} en attente`,
  failed: (count: number) => `${count} ${plural(count, 'envoi refusé', 'envois refusés')}`,
  soon: 'Délai de 72 h bientôt atteint',
};

/** Rejoue la file : moteur chargé à la demande (dépôt des photos, appels de terrain). */
function flush(userId: string) {
  void import('@/features/cleaning/field/outbox').then((runtime) => runtime.flushOutbox(userId));
}

/**
 * Écrans de terrain gardés pour une ouverture hors connexion : leur code est téléchargé dès que l'espace
 * agent s'ouvre avec du réseau, et gardé par le service worker avec les autres fichiers du site.
 */
function preloadFieldScreens() {
  void import('./visit-sheet');
  void import('./session-sheet');
  void import('./session-panels');
  void import('./pending-sends');
  void import('@/features/cleaning/field-schemas');
  void import('@/features/cleaning/field/outbox');
}

/** Actions de terrain du compte encore sur le téléphone, à jour à chaque changement de la file. */
function useEntries(userId: string | null): OutboxEntry[] {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const read = () =>
      void listEntries(userId).then((list) => {
        if (active) setEntries(list);
      });
    read();
    const stop = subscribeOutbox(read);
    return () => {
      active = false;
      stop();
    };
  }, [userId]);
  return userId ? entries : [];
}

/**
 * État du terrain en tête de l'espace agent, et déclencheur du rejeu de la file :
 *
 * - rejeu au démarrage, au retour du réseau (`online`) et au retour au premier plan, s'il reste des actions ;
 * - purge des copies du jour de plus de 48 h ; préchargement des écrans de terrain ;
 * - bandeau « Hors connexion » et compteur des envois en attente (refusés, délai de 72 h proche), lien
 *   vers « Envois en attente ». Rien quand tout est envoyé et le réseau présent.
 */
export function FieldStatus() {
  const sessionUser = useSession()?.user.id ?? null;
  const userId = sessionUser ?? deviceAccountId();
  const online = useOnline();
  const entries = useEntries(userId);
  const now = useNow(60_000);
  const waiting = entries.some((entry) => entry.status === 'pending');

  useEffect(() => {
    if (sessionUser) void pruneToday(sessionUser);
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser || !waiting) return;
    const replay = () => {
      if (navigator.onLine !== false) flush(sessionUser);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') replay();
    };
    replay();
    window.addEventListener('online', replay);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', replay);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [sessionUser, waiting]);

  useEffect(() => {
    if (!online) return;
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1500));
    idle(preloadFieldScreens);
  }, [online]);

  const count = entries.length;
  const failed = entries.filter((entry) => entry.status === 'error').length;
  const late = now !== null && entries.some((entry) => nearDeadline(entry.occurredAt, now));
  if (online && !count) return null;

  const alarming = failed > 0 || late;
  return (
    <Link
      href={navigation.agentOutbox.href}
      className={cn(
        'rounded-card focus-visible:outline-focus mb-5 flex min-h-12 items-center gap-3 border-2 px-4 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2',
        alarming ? 'border-danger bg-danger-soft' : 'border-warning bg-warning-soft',
      )}
    >
      {online ? (
        alarming ? (
          <IconAlert className="text-danger size-6 shrink-0" />
        ) : (
          <IconCloudUp className="text-warning size-6 shrink-0" />
        )
      ) : (
        <IconWifiOff className="text-warning size-6 shrink-0" />
      )}
      <span className="text-ink flex-1 font-semibold">
        {[
          online ? null : t.offline,
          count - failed > 0 ? t.pending(count - failed) : null,
          failed ? t.failed(failed) : null,
          late ? t.soon : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {count ? <IconChevronRight className="text-ink size-5 shrink-0" /> : null}
    </Link>
  );
}
