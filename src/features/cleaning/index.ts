/**
 * Nettoyage (service cleaning), côté agent et candidat : profil d'agent, invitation, candidature, espace
 * agent (aujourd'hui, affectations, disponibilités, profil et activité), terrain (fiches de visite et de
 * séance, file d'attente hors connexion, envois en attente).
 */
export { getMyAgentProfile } from './api';
export { AgentShell } from './components/agent/agent-shell';
// Écrans client chargés à la demande (voir components/lazy.tsx).
export {
  AgentAssignments,
  AgentAvailability,
  AgentProfileScreen,
  AgentToday,
  ApplicationScreen,
  InvitationWelcome,
  PendingSends,
  SessionSheet,
  VisitSheet,
} from './components/lazy';
export { agentStatusView, cleaningTexts, type AgentStatusView } from './texts';
export type { AgentProfile } from './schemas';
