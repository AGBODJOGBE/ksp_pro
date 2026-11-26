import type { BadgeTone } from '@/components/ui/badge';

/**
 * Textes de la fiche de séance, chargés seulement par cet écran (les textes communs du terrain sont dans
 * `./field-texts`). Phrases courtes : l'agent lit dehors, d'une main. Aucun montant (R-EX-04).
 */

interface Label {
  label: string;
  tone: BadgeTone;
}

export const SESSION_STATUS: Record<string, Label> = {
  to_assign: { label: 'À affecter', tone: 'neutral' },
  assigned: { label: 'Prévue', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'action' },
  interrupted: { label: 'Interrompue', tone: 'warning' },
  completed: { label: 'Réalisée', tone: 'success' },
  missed: { label: 'Manquée', tone: 'warning' },
  suspended: { label: 'Suspendue', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const INCIDENT_CATEGORY: Record<string, string> = {
  equipment: 'Matériel',
  access: 'Accès',
  safety: 'Sécurité',
  out_of_scope_request: 'Demande du client hors devis',
  other: 'Autre',
};

export const INCIDENT_DECISION: Record<string, Label> = {
  pending: { label: 'En attente du superviseur', tone: 'warning' },
  resumed: { label: 'Reprise', tone: 'action' },
  rescheduled: { label: 'Reportée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const MISSED_CAUSE: Record<string, string> = {
  customer_absent: 'Client absent',
  access_impossible: 'Accès impossible',
};

export const sessionTexts = {
  youLead: 'Vous êtes chef d’équipe : vous marquez l’arrivée, démarrez et clôturez la séance.',
  notLead: (name: string) =>
    `${name} est chef d’équipe : l’arrivée, le démarrage, la clôture et l’absence du client sont faits par lui.`,
  notLeadNoName: 'Le chef d’équipe marque l’arrivée, démarre et clôture la séance.',
  title: 'Séance de nettoyage',
  program: (number: string, rank: number) => `Programme ${number} · séance ${rank}`,
  team: 'Équipe',
  you: '(vous)',
  confirmation: { confirmed: 'Confirmé', pending: 'À confirmer', proposed: 'Proposé' } as Record<
    string,
    string
  >,
  beforeTitle: 'Photos « avant »',
  startTitle: 'Démarrage',
  start: 'Démarrer la séance',
  starting: 'Démarrage…',
  startLocked: 'Ajoutez au moins une photo « avant ».',
  started: (time: string) => `Démarrée à ${time}`,
  startLeadOnly: 'Le chef d’équipe démarre la séance.',
  checklistTitle: 'Liste de contrôle',
  checklistHint: 'Cochez chaque point dès qu’il est fait.',
  checklistLocked: 'Disponible une fois la séance démarrée.',
  checklistProgress: (done: number, total: number) => `${done} / ${total} points faits`,
  checklistEmpty: 'Aucun point à cocher pour cette séance.',
  common: 'Points communs',
  afterTitle: 'Photos « après »',
  closeTitle: 'Clôture',
  closeOpen: 'Clôturer la séance',
  closeLocked: 'Cochez toute la liste et ajoutez au moins une photo « après ».',
  closeLeadOnly: 'Le chef d’équipe clôture la séance.',
  signature: 'Signature du client (facultatif)',
  signatureHint: 'Faites signer le client du doigt dans le cadre.',
  signatureClear: 'Effacer',
  signatureEmpty: 'Cadre de signature vide',
  signatureSigned: 'Signature prise',
  signatureUnavailable: 'Signature impossible sur ce téléphone : clôturez sans signature.',
  closeSubmit: 'Clôturer la séance',
  closing: 'Clôture…',
  closed: (time: string) => `Séance réalisée, clôturée à ${time}.`,
  interrupted: 'Séance interrompue : votre superviseur décide de la suite (reprise, report ou annulation).',
  missed: 'Séance manquée.',
  cancelled: 'Cette séance est annulée : rien à faire.',
  suspended: 'Cette séance est suspendue. Contactez votre superviseur.',
  otherActions: 'En cas de problème',
  incidentOpen: 'Signaler un incident',
  incidentTitle: 'Signaler un incident',
  incidentHint: 'La séance est interrompue et votre superviseur prévenu : il décide de la suite.',
  incidentLocked: 'Possible pendant la séance.',
  category: 'Nature de l’incident',
  categoryMissing: 'Choisissez la nature de l’incident.',
  incidentNote: 'Ce qui se passe',
  incidentNoteMissing: 'Décrivez l’incident.',
  incidentNoteCounter: (length: number) => `${length} / 2000`,
  incidentPhotos: 'Photos (facultatif, 10 au plus)',
  incidentSubmit: 'Signaler l’incident',
  incidentSending: 'Envoi…',
  incidentDone: 'Incident signalé. Votre superviseur est prévenu.',
  incidents: 'Incidents',
  missedOpen: 'Client absent ou accès impossible',
  missedTitle: 'Client absent ou accès impossible',
  missedHint:
    'Après l’attente prévue et un appel au client. Prenez une photo du lieu, puis notez le début de l’attente et l’heure de l’appel.',
  missedLeadOnly: 'Le chef d’équipe déclare le client absent.',
  missedNotBefore: (time: string) => `Possible à partir de ${time}, heure prévue de la séance.`,
  cause: 'Motif',
  causeMissing: 'Choisissez le motif.',
  missedPhoto: 'Photo du lieu (obligatoire)',
  missedPhotoMissing: 'Prenez une photo du lieu.',
  waitStarted: 'Début de l’attente',
  calledAt: 'Heure de l’appel au client',
  timeMissing: 'Indiquez une heure.',
  timeFuture: 'Cette heure n’est pas encore passée.',
  missedSubmit: 'Déclarer la séance manquée',
  missedSending: 'Enregistrement…',
  missedDone: 'Séance déclarée manquée.',
  cancel: 'Annuler',
} as const;
