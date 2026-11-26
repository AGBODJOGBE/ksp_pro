'use client';

import { api, parseResponse } from '@/lib/api';
import type { InAppNotification, NotificationList, NotificationPreferences } from './schemas';

/** Centre de notifications du compte (service notification, ADR-039), session requise. */
const NOTIFICATIONS = '/api/v1/notification/notifications';
const UNREAD_COUNT = '/api/v1/notification/notifications/unread-count';
const READ_ALL = '/api/v1/notification/notifications/read-all';
const readPath = (id: string) => `/api/v1/notification/notifications/${encodeURIComponent(id)}/read`;
const PREFERENCES = '/api/v1/notification/preferences';

const schemas = () => import('./schemas');

export const PAGE_SIZE = 20;

/** Les plus récentes d'abord ; `unreadOnly` : seulement les non lues. */
export async function listNotifications(cursor?: string, unreadOnly = false): Promise<NotificationList> {
  const [{ notificationListSchema }, body] = await Promise.all([
    schemas(),
    api.get(NOTIFICATIONS, { query: { limit: PAGE_SIZE, cursor, unread: unreadOnly ? 'true' : undefined } }),
  ]);
  return parseResponse(notificationListSchema, body);
}

export async function countUnread(): Promise<number> {
  const [{ unreadCountSchema }, body] = await Promise.all([schemas(), api.get(UNREAD_COUNT)]);
  return parseResponse(unreadCountSchema, body).unreadCount;
}

export async function markRead(
  id: string,
): Promise<{ notification: InAppNotification; unreadCount: number }> {
  const [{ markReadSchema }, body] = await Promise.all([schemas(), api.post(readPath(id))]);
  return parseResponse(markReadSchema, body);
}

export async function markAllRead(): Promise<{ marked: number; unreadCount: number }> {
  const [{ markAllReadSchema }, body] = await Promise.all([schemas(), api.post(READ_ALL)]);
  return parseResponse(markAllReadSchema, body);
}

/** Canaux souhaités pour les messages facultatifs (WhatsApp, e-mail) ; `updatedAt` null : jamais modifiés. */
export async function getPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
  const [{ preferencesSchema }, body] = await Promise.all([schemas(), api.get(PREFERENCES, { signal })]);
  return parseResponse(preferencesSchema, body);
}

/** Remplace les préférences ; tout écarter est permis (les messages restent dans « Notifications »). */
export async function updatePreferences(body: {
  whatsapp: boolean;
  email: boolean;
}): Promise<NotificationPreferences> {
  const [{ preferencesSchema }, response] = await Promise.all([schemas(), api.put(PREFERENCES, body)]);
  return parseResponse(preferencesSchema, response);
}
