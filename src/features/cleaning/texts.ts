import type { AgentStatus } from './schemas';

/** Ton de l'étiquette d'un statut (le texte suffit : la couleur n'est qu'une aide). */
export type StatusTone = 'neutral' | 'brand' | 'action' | 'warning' | 'danger';

export interface AgentStatusView {
  label: string;
  title: string;
  text: string;
  tone: StatusTone;
  /** Le rôle d'agent existe peut-être déjà : proposer « Actualiser mes accès ». */
  suggestRefresh?: boolean;
}

const STATUS_VIEWS: Record<AgentStatus, AgentStatusView> = {
  applicant: {
    label: 'Envoyée',
    title: 'Candidature envoyée',
    text: 'L’équipe KSP va l’examiner.',
    tone: 'brand',
  },
  under_review: {
    label: 'En examen',
    title: 'Candidature en cours d’examen',
    text: 'L’équipe KSP vérifie votre dossier.',
    tone: 'brand',
  },
  active: {
    label: 'Acceptée',
    title: 'Candidature acceptée',
    text: 'Votre compte agent est actif. Actualisez vos accès pour ouvrir votre espace agent.',
    tone: 'action',
    suggestRefresh: true,
  },
  suspended: {
    label: 'Suspendu',
    title: 'Compte agent suspendu',
    text: 'Contactez votre superviseur KSP.',
    tone: 'warning',
  },
  deactivated: {
    label: 'Désactivé',
    title: 'Compte agent désactivé',
    text: 'Contactez votre superviseur KSP.',
    tone: 'neutral',
  },
  rejected: {
    label: 'Non retenue',
    title: 'Candidature non retenue',
    text: 'Votre candidature n’a pas été retenue.',
    tone: 'danger',
  },
};

/** Vue d'un statut d'agent ; un statut inconnu reçoit un libellé neutre. */
export function agentStatusView(status: string): AgentStatusView {
  return (
    STATUS_VIEWS[status as AgentStatus] ?? {
      label: 'Enregistrée',
      title: 'Candidature enregistrée',
      text: 'Votre dossier d’agent est enregistré chez KSP.',
      tone: 'neutral',
    }
  );
}

export const cleaningTexts = {
  becomeAgent: {
    title: 'Devenir agent KSP',
    text: 'Rejoignez les équipes de nettoyage KSP. Candidature en quelques minutes.',
  },
  applicationCard: 'Ma candidature',
  invitation: {
    title: 'Vous êtes invité à devenir agent KSP',
    text: 'Connectez-vous avec le numéro qui a reçu l’invitation, puis remplissez votre candidature.',
    kept: 'Invitation enregistrée sur ce téléphone.',
    signIn: 'Se connecter avec ce numéro',
    continue: 'Continuer ma candidature',
    invalidTitle: 'Lien d’invitation invalide',
    invalidText:
      'Ce lien est incomplet. Ouvrez à nouveau le lien reçu par SMS, ou demandez une nouvelle invitation.',
    validity: 'Une invitation est valable 7 jours.',
  },
} as const;
