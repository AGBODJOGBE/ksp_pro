import type { BadgeTone } from '@/components/ui/badge';
import type { AssignmentStatusFilter } from './agent-api';

/**
 * Textes de l'espace agent du Nettoyage, chargés seulement par ses écrans. Peu de mots, des mots simples :
 * l'agent lit dehors, d'une main. Aucun montant (R-EX-04).
 */

interface Label {
  label: string;
  tone: BadgeTone;
}

/** Statut d'une affectation (`CleaningAgentAssignmentView.status`). */
export const ASSIGNMENT_STATUS: Record<string, Label> = {
  pending_confirmation: { label: 'À confirmer', tone: 'warning' },
  confirmed: { label: 'Confirmée', tone: 'action' },
  proposed: { label: 'Proposée', tone: 'brand' },
  declined: { label: 'Refusée', tone: 'neutral' },
  expired: { label: 'Expirée', tone: 'neutral' },
  removed: { label: 'Retirée', tone: 'neutral' },
};

/** Onglets de « Mes affectations », par statut. */
export const ASSIGNMENT_TAB: Record<AssignmentStatusFilter, string> = {
  pending_confirmation: 'À confirmer',
  confirmed: 'Confirmées',
  proposed: 'Proposées',
  declined: 'Refusées',
  expired: 'Expirées',
  removed: 'Retirées',
};

/** Statut d'un agent vu dans son profil (« Acceptée » est le vocabulaire de la candidature). */
export const AGENT_STATUS: Record<string, Label> = {
  active: { label: 'Actif', tone: 'action' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  deactivated: { label: 'Désactivé', tone: 'neutral' },
};

/** Statut de la visite ou de la séance (`targetStatus`). */
export const TARGET_STATUS: Record<string, string> = {
  scheduled: 'prévue',
  to_assign: 'à affecter',
  assigned: 'prévue',
  in_progress: 'en cours',
  interrupted: 'interrompue',
  completed: 'terminée',
  missed: 'manquée',
  suspended: 'suspendue',
  cancelled: 'annulée',
};

export const TARGET_KIND: Record<string, string> = {
  visit: 'Visite des lieux',
  session: 'Séance de nettoyage',
};

export const UNAVAILABILITY_KIND: Record<string, string> = {
  leave: 'Congé',
  sickness: 'Maladie',
  other: 'Autre motif',
};

export const EMPLOYMENT_KIND: Record<string, string> = {
  employee: 'Salarié KSP',
  independent: 'Indépendant partenaire',
};

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

export const agentTexts = {
  genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
  retry: 'Réessayer',
  loading: 'Chargement…',
  nav: {
    label: 'Espace agent',
    today: 'Aujourd’hui',
    assignments: 'Affectations',
    availability: 'Disponibilités',
    profile: 'Profil',
  },
  card: {
    lead: 'Chef d’équipe',
    target: (kind: string, status: string) => `${kind} ${status}`,
    open: 'Ouvrir la fiche',
    respondBefore: (time: string) => `Répondez avant ${time}`,
    remaining: (delay: string) => `il reste ${delay}`,
    lessThanMinute: 'moins d’une minute',
    expiredLocally: 'Délai de réponse dépassé.',
    accept: 'Accepter',
    accepting: 'Acceptation…',
    decline: 'Refuser',
    declining: 'Refus…',
    confirmDecline: 'Refuser cette affectation ? KSP la proposera à un autre agent.',
    confirmDeclineYes: 'Oui, refuser',
    confirmDeclineNo: 'Garder',
    accepted: 'Affectation acceptée.',
    declined: 'Affectation refusée.',
    employeePending: 'En attente de confirmation par KSP.',
    stale: 'Cette affectation n’attend plus votre réponse. La liste est mise à jour.',
  },
  today: {
    title: 'Aujourd’hui',
    next: 'Prochaine intervention',
    later: 'Plus tard aujourd’hui',
    done: 'Déjà passées',
    other: 'Annulées ou retirées',
    empty: 'Aucune intervention prévue aujourd’hui.',
    emptyHint: 'Vos prochaines affectations sont dans l’onglet « Affectations ».',
    seeAll: 'Voir mes affectations',
    loading: 'Chargement de votre journée…',
    cachedOffline: (time: string) =>
      `Hors connexion : journée gardée sur ce téléphone, mise à jour à ${time}.`,
    cachedRefreshing: (time: string) => `Journée gardée à ${time}, mise à jour en cours…`,
    pending: (count: number) =>
      `${count} ${plural(count, 'affectation attend', 'affectations attendent')} votre réponse`,
    pendingLink: 'Répondre',
    more: 'D’autres interventions sont prévues aujourd’hui : voir la liste complète.',
    notifications: 'Notifications',
    unread: (count: number) => (count === 1 ? '1 notification non lue' : `${count} notifications non lues`),
  },
  assignments: {
    title: 'Mes affectations',
    lead: 'Visites et séances qui vous sont confiées.',
    periodLegend: 'Période',
    from: 'Du',
    to: 'Au (inclus)',
    periodInvalid: 'La fin de la période doit suivre son début.',
    tabsLabel: 'Statut des affectations',
    all: 'Toutes',
    empty: 'Aucune affectation sur cette période.',
    loading: 'Chargement des affectations…',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement…',
    retry: 'Réessayer',
    employee:
      'Vous êtes salarié KSP : vos affectations sont confirmées d’office, vous n’avez pas à les accepter.',
    independent:
      'Indépendant partenaire : acceptez ou refusez chaque affectation avant l’heure indiquée. Sans réponse, KSP la confie à un autre agent.',
    total: (count: number) => `${count} ${plural(count, 'affectation', 'affectations')}`,
  },
  availability: {
    title: 'Mes disponibilités',
    lead: 'Vos jours et heures de travail. KSP vous affecte seulement sur ces plages.',
    loading: 'Chargement de vos disponibilités…',
    weeklyTitle: 'Semaine type',
    weeklyHint: '6 plages par jour au plus, heure du Bénin.',
    extrasTitle: 'Disponibilités exceptionnelles',
    extrasHint: 'Un jour où vous pouvez travailler en dehors de votre semaine type.',
    extrasEmpty: 'Aucune disponibilité exceptionnelle.',
    extraDate: 'Date',
    extraFrom: 'De',
    extraTo: 'À',
    extraAdd: 'Ajouter cette disponibilité',
    extraRemove: (label: string) => `Retirer la disponibilité du ${label}`,
    extraInvalid: 'Choisissez une date et une fin après le début.',
    extrasMax: '50 disponibilités exceptionnelles au plus.',
    save: 'Enregistrer mes disponibilités',
    saving: 'Enregistrement…',
    saved: 'Vos disponibilités sont enregistrées.',
    unsaved: 'Modifications non enregistrées.',
    inUse: (count: number) =>
      count > 0
        ? `Vous retirez une plage déjà occupée par ${count} ${plural(count, 'affectation', 'affectations')}. Pour la libérer, contactez votre superviseur KSP.`
        : 'Vous retirez une plage déjà occupée par une affectation. Pour la libérer, contactez votre superviseur KSP.',
    loadTitle: 'Charge maximale',
    load: (day: number, week: number) =>
      `${day} h par jour et ${week} h par semaine au plus, fixées par KSP.`,
  },
  unavailability: {
    title: 'Indisponibilités',
    hint: 'Congé, maladie ou empêchement : KSP ne vous affecte pas sur cette période.',
    empty: 'Aucune indisponibilité à venir.',
    add: 'Déclarer une indisponibilité',
    cancel: 'Annuler',
    kindLegend: 'Motif',
    kindMissing: 'Choisissez un motif.',
    allDay: 'Journées entières',
    startDate: 'Du',
    endDate: 'Au (inclus)',
    startTime: 'Heure de début',
    endTime: 'Heure de fin',
    note: 'Précision (facultatif)',
    noteCounter: (length: number) => `${length} / 300`,
    submit: 'Enregistrer l’indisponibilité',
    submitting: 'Enregistrement…',
    declared: 'Indisponibilité enregistrée.',
    invalid: 'Choisissez des dates, la fin après le début.',
    conflict: (count: number) =>
      count > 0
        ? `Cette période chevauche ${count} ${plural(count, 'affectation déjà prévue', 'affectations déjà prévues')}. Seul votre superviseur KSP peut l’enregistrer : contactez-le.`
        : 'Cette période chevauche des affectations déjà prévues. Seul votre superviseur KSP peut l’enregistrer : contactez-le.',
    forced: 'Enregistrée par votre superviseur',
    by: (name: string) => `Déclarée par ${name}`,
    remove: 'Retirer',
    removing: 'Retrait…',
    confirmRemove: 'Retirer cette indisponibilité ? Vous redevenez disponible sur cette période.',
    confirmRemoveYes: 'Oui, retirer',
    confirmRemoveNo: 'Garder',
    removed: 'Indisponibilité retirée.',
  },
  profile: {
    title: 'Mon profil',
    loading: 'Chargement de votre profil…',
    readOnly:
      'Votre profil est tenu par KSP. Pour corriger une information, contactez votre superviseur KSP.',
    status: 'Statut',
    phone: 'Téléphone',
    employment: 'Statut d’emploi',
    residence: 'Commune de résidence',
    zones: 'Zones de travail',
    skills: 'Compétences',
    skillValidated: 'Validée',
    skillPending: 'En attente de validation',
    noSkills: 'Aucune compétence enregistrée.',
    emergency: 'Personne à prévenir',
    mobileMoney: 'Numéro Mobile Money',
    none: 'Non renseigné',
    load: 'Charge maximale',
    loadValue: (day: number, week: number) => `${day} h par jour, ${week} h par semaine`,
    photoAlt: 'Votre photo',
  },
  activity: {
    title: 'Mon activité',
    lead: 'Vos heures réalisées, sans montants.',
    loading: 'Chargement de votre activité…',
    sessions: 'Séances réalisées',
    visits: 'Visites réalisées',
    hoursWeek: 'Heures cette semaine',
    hoursMonth: 'Heures ce mois-ci',
    rating: 'Note moyenne',
    ratingValue: (value: string) => `${value} / 5`,
    ratingCount: (count: number) => `${count} avis`,
    noRating: 'Pas encore de note',
    claims: 'Réclamations en cours',
    weeks: 'Par semaine',
    months: 'Par mois',
    week: (date: string) => `Semaine du ${date}`,
    period: 'Période',
    hours: 'Heures',
    periodSessions: 'Séances',
    empty: 'Pas encore d’activité enregistrée.',
  },
} as const;
