/**
 * Notifications du compte (service notification, ADR-039) : pastille, centre de notifications (agent et
 * partenaire), préférences des canaux.
 */
// Écrans client chargés à la demande (voir components/lazy.tsx).
export {
  NotificationBell,
  NotificationCenter,
  NotificationPreferences,
  UnreadBadge,
} from './components/lazy';
export type { NotificationSpace } from './components/notification-center';
