import { publicEnv } from '@/config/env';
import { type ApiClient, createApiClient } from './client';
import { session } from './session';

export { ApiError } from './errors';
export { isBackendPending } from './pending';
export type { ApiClient, RequestOptions } from './client';
export { grantsFromAccessToken, rolesFromAccessToken, type AccessGrants } from './claims';
export {
  isDeletionPending,
  session,
  useSession,
  type ActiveContext,
  type RestoreResult,
  type Session,
  type SessionUser,
} from './session';
// Schémas zod de la session : importés directement (`@/lib/api/session-schema`) par qui les valide,
// jamais par cet index que lisent toutes les pages (zod est chargé à la demande, docs/architecture.md).
export { parseResponse } from './validate';

/** Client à utiliser dans les composants du navigateur (jeton d'accès de la session, cookies inclus). */
export const api: ApiClient = createApiClient({
  baseUrl: publicEnv.apiUrl,
  withCredentials: true,
  getAccessToken: () => session.getAccessToken(),
  refreshSession: () => session.refresh(),
});
