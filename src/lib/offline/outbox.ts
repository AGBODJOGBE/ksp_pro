import { OUTBOX_STORE, withStore } from './db';

/**
 * Actions de terrain en attente d'envoi (magasin `outbox`, F-022, R-EX-05). Chaque action est gardée au
 * moment du geste, telle qu'elle partira : corps figé (`occurredAt` compris), clé d'idempotence, photos
 * (le contenu `Blob`, déposé au service file au moment de l'envoi). L'identifiant auto-incrémenté donne
 * l'ordre des gestes ; `group` (la visite ou la séance) fixe l'ordre strict de l'envoi.
 */

/** Photo d'une action : son contenu, puis l'identifiant du service file une fois déposée. */
export interface OutboxFile {
  /** Champ du corps qui reçoit l'identifiant (`fileId`, `photoFileId`, `signatureFileId`, `photoFileIds`). */
  field: string;
  blob: Blob;
  name: string;
  /** Identifiant du fichier déposé (`POST /file/uploads`, puis `complete`). */
  fileId?: string;
  /** Instant du dépôt : un fichier jamais rattaché est purgé par le service file après 24 h. */
  uploadedAt?: number;
}

/** Refus d'un envoi, gardé pour l'écran « Envois en attente ». */
export interface OutboxError {
  status: number;
  code: string;
  message: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export interface OutboxEntry {
  id: number;
  userId: string;
  /** Visite ou séance concernée (`visit:<id>`, `session:<id>`) : ordre strict par groupe. */
  group: string;
  /** Nature de l'action (`visit.arrive`, `session.checklist`…). */
  type: string;
  body: Record<string, unknown>;
  /** Identifiant complémentaire de l'adresse (photo à retirer). */
  ref?: string;
  /** Détail affiché à l'agent (point de la liste de contrôle…). */
  label?: string;
  /** Intervention affichée à l'agent (« Villa · Cotonou »). */
  context?: string;
  /** Clé d'idempotence : la même à chaque nouvel essai, tant que le corps ne change pas. */
  key: string;
  /** Instant du geste (millisecondes) : `occurredAt` du corps, avertissement des 72 h. */
  occurredAt: number;
  files: OutboxFile[];
  status: 'pending' | 'error';
  error: OutboxError | null;
  attempts: number;
}

export type NewOutboxEntry = Omit<OutboxEntry, 'id' | 'status' | 'error' | 'attempts'>;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Prévenu à chaque changement de la file (compteur, fiches, écran « Envois en attente »). */
export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyOutbox(): void {
  listeners.forEach((listener) => listener());
}

/** Garde une action ; renvoie son identifiant (ordre des gestes). Échoue si la base est indisponible. */
export async function addEntry(entry: NewOutboxEntry): Promise<number> {
  const stored = { ...entry, status: 'pending', error: null, attempts: 0 };
  const id = await withStore(OUTBOX_STORE, 'readwrite', (store) => store.add(stored));
  notifyOutbox();
  return Number(id);
}

/** Actions du compte, dans l'ordre des gestes ; liste vide si la base est indisponible. */
export async function listEntries(userId: string): Promise<OutboxEntry[]> {
  try {
    const all = (await withStore(OUTBOX_STORE, 'readonly', (store) => store.getAll())) as OutboxEntry[];
    return all.filter((entry) => entry.userId === userId).sort((a, b) => a.id - b.id);
  } catch {
    return [];
  }
}

/**
 * Met à jour une action encore présente (jamais recréée : une action envoyée, ou une base effacée par la
 * déconnexion pendant l'envoi, ne revient pas).
 */
export async function patchEntry(id: number, patch: Partial<Omit<OutboxEntry, 'id'>>): Promise<void> {
  await withStore(OUTBOX_STORE, 'readwrite', (store) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as OutboxEntry | undefined;
      if (current) store.put({ ...current, ...patch, id });
    };
    return () => undefined;
  });
  notifyOutbox();
}

export async function removeEntry(id: number): Promise<void> {
  await withStore(OUTBOX_STORE, 'readwrite', (store) => store.delete(id));
  notifyOutbox();
}
