import { OFFLINE_DATABASE } from '@/lib/api/account-data';

/**
 * Base hors ligne de l'Espace pro (IndexedDB `ksp-pro`, F-022), sans dépendance :
 *
 * - `today` : tâches du jour lisibles sans réseau (planning, fiches), par compte, 48 h au plus ;
 * - `outbox` : actions de terrain en attente d'envoi, dans l'ordre des gestes (clé auto-incrémentée).
 *
 * La déconnexion supprime la base (`lib/api/account-data`) : la connexion ouverte ici se ferme d'elle-même
 * (`versionchange`) pour ne pas bloquer la suppression, et la prochaine lecture rouvre une base vide.
 */

export const TODAY_STORE = 'today';
export const OUTBOX_STORE = 'outbox';
const VERSION = 1;

let connection: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const request = indexedDB.open(OFFLINE_DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TODAY_STORE)) db.createObjectStore(TODAY_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(OUTBOX_STORE))
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => {
      const db = request.result;
      const forget = () => {
        connection = null;
      };
      // Suppression demandée (déconnexion, autre compte) : on libère la base tout de suite.
      db.onversionchange = () => {
        db.close();
        forget();
      };
      db.onclose = forget;
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB refusée'));
    request.onblocked = () => reject(new Error('IndexedDB bloquée'));
  });
}

function database(): Promise<IDBDatabase> {
  connection ??= open().catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

/**
 * Une transaction sur un magasin : `operation` lance une ou plusieurs requêtes et renvoie celle dont le
 * résultat compte. La promesse se résout quand la transaction est validée (écriture durable).
 */
export async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest<T> | (() => T),
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const outcome = operation(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(typeof outcome === 'function' ? outcome() : outcome.result);
    transaction.onerror = () => reject(transaction.error ?? new Error('Transaction refusée'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction annulée'));
  });
}

/** Ferme la connexion (tests, changement de compte). */
export async function closeOfflineDatabase(): Promise<void> {
  const current = connection;
  connection = null;
  if (!current) return;
  try {
    (await current).close();
  } catch {
    // Jamais ouverte : rien à fermer.
  }
}
