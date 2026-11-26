import { TODAY_STORE, withStore } from './db';

/**
 * Tâches du jour lisibles sans réseau (magasin `today`) : copies des réponses de la gateway, par compte,
 * gardées 48 h au plus. Confort seulement : une base indisponible (navigation privée, stockage plein) se
 * lit comme vide et une écriture refusée est ignorée. Ce qui est gardé est choisi par l'appelant (jamais la
 * position d'une visite : voir `features/cleaning`).
 */

export const TODAY_MAX_AGE_MS = 48 * 3_600_000;

export interface Cached<T> {
  data: T;
  /** Instant de la copie (millisecondes depuis l'époque Unix). */
  savedAt: number;
}

interface TodayRecord<T> extends Cached<T> {
  key: string;
  userId: string;
}

const keyOf = (userId: string, name: string) => `${userId}:${name}`;

/** Garde une copie (`name` : `planning`, `visit:<id>`, `session:<id>`). */
export async function saveToday<T>(userId: string, name: string, data: T, now = Date.now()): Promise<void> {
  try {
    const record: TodayRecord<T> = { key: keyOf(userId, name), userId, data, savedAt: now };
    await withStore(TODAY_STORE, 'readwrite', (store) => store.put(record));
  } catch {
    // Copie de confort : la page reste utilisable sans elle.
  }
}

/** Copie encore valable du compte, ou `null` (absente, trop vieille, base indisponible). */
export async function readToday<T>(
  userId: string,
  name: string,
  now = Date.now(),
): Promise<Cached<T> | null> {
  try {
    const record = (await withStore(TODAY_STORE, 'readonly', (store) => store.get(keyOf(userId, name)))) as
      TodayRecord<T> | undefined;
    if (!record || record.userId !== userId) return null;
    if (now - record.savedAt > TODAY_MAX_AGE_MS) return null;
    return { data: record.data, savedAt: record.savedAt };
  } catch {
    return null;
  }
}

/** Efface les copies de plus de 48 h, et celles d'un autre compte. */
export async function pruneToday(userId: string, now = Date.now()): Promise<void> {
  try {
    const records = (await withStore(TODAY_STORE, 'readonly', (store) => store.getAll())) as Array<
      TodayRecord<unknown>
    >;
    const stale = records.filter(
      (record) => record.userId !== userId || now - record.savedAt > TODAY_MAX_AGE_MS,
    );
    if (!stale.length) return;
    await withStore(TODAY_STORE, 'readwrite', (store) => {
      stale.forEach((record) => store.delete(record.key));
      return () => undefined;
    });
  } catch {
    // Rien à purger si la base est indisponible.
  }
}
