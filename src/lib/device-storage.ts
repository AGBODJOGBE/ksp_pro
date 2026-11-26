/**
 * Données gardées sur l'appareil (`localStorage`), avec une date d'expiration : brouillon de la
 * candidature, invitation d'un agent. L'application installée et le navigateur peuvent ne pas partager
 * le même onglet : `sessionStorage` perdrait la candidature à la fermeture de l'application.
 *
 * Clés `ksp.…` : effacées à la déconnexion et quand un autre compte se connecte (`lib/api/account-data`).
 * Confort seulement : un stockage bloqué (navigation privée) ou une valeur abîmée se lisent comme absents.
 * Module sans dépendance.
 */

const DAY_MS = 86_400_000;

interface Stored<T> {
  value: T;
  /** Instant d'expiration (millisecondes depuis l'époque Unix). */
  expiresAt: number;
}

function deviceStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Valeur encore valable, ou `null` (absente, expirée, abîmée). Une valeur expirée est effacée. */
export function readStored<T>(key: string, now: number = Date.now()): T | null {
  const storage = deviceStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const stored = JSON.parse(raw) as Partial<Stored<T>> | null;
    if (!stored || typeof stored.expiresAt !== 'number' || !('value' in stored)) {
      storage.removeItem(key);
      return null;
    }
    if (stored.expiresAt <= now) {
      storage.removeItem(key);
      return null;
    }
    return stored.value as T;
  } catch {
    return null;
  }
}

/** Garde une valeur `days` jours ; `false` si le stockage la refuse (plein, bloqué). */
export function writeStored<T>(key: string, value: T, days: number, now: number = Date.now()): boolean {
  const storage = deviceStorage();
  if (!storage) return false;
  try {
    const stored: Stored<T> = { value, expiresAt: now + days * DAY_MS };
    storage.setItem(key, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    deviceStorage()?.removeItem(key);
  } catch {
    // Stockage bloqué : rien à effacer.
  }
}
