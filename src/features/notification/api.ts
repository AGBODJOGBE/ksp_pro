'use client';

import { api, parseResponse } from '@/lib/api';
import type { InAppNotification, NotificationList } from './schemas';

/** Centre de notifications du compte (service notification, ADR-039), session requise. */
const NOTIFICATIONS = '/api/v1/notification/notifications';
const UNREAD_COUNT = '/api/v1/notification/notifications/unread-count';
const READ_ALL = '/api/v1/notification/notifications/read-all';
const readPath = (id: string) => `/api/v1/notification/notifications/${encodeURIComponent(id)}/read`;

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
