/**
 * Textes de l'écran « Envois en attente », chargés seulement par lui. Aucun montant (R-EX-04).
 */

const MISSED_CAUSE: Record<string, string> = {
  customer_absent: 'Client absent',
  access_impossible: 'Accès impossible',
};

/** Libellé d'une action de la file (« Envois en attente »). */
export function actionLabel(type: string, body: Record<string, unknown>): string {
  switch (type) {
    case 'visit.arrive':
    case 'session.arrive':
      return 'Arrivée sur place';
    case 'visit.observations':
      return 'Constat';
    case 'visit.photo':
      return 'Photo';
    case 'session.photo':
      return body.kind === 'after' ? 'Photo « après »' : 'Photo « avant »';
    case 'visit.photo.remove':
    case 'session.photo.remove':
      return 'Photo retirée';
    case 'visit.complete':
      return 'Visite terminée';
    case 'visit.missed':
      return 'Client absent';
    case 'session.start':
      return 'Séance démarrée';
    case 'session.checklist':
      return Array.isArray(body.items) && (body.items as Array<{ checked?: boolean }>)[0]?.checked === false
        ? 'Point décoché'
        : 'Point coché';
    case 'session.incident':
      return 'Incident signalé';
    case 'session.complete':
      return 'Séance clôturée';
    case 'session.missed':
      return MISSED_CAUSE[String(body.cause)] ?? 'Séance manquée';
    default:
      return 'Action de terrain';
  }
}

export const outboxTexts = {
  title: 'Envois en attente',
  lead: 'Actions faites sur le terrain qui n’ont pas encore été reçues par KSP. Elles partent seules dès que le réseau revient, dans l’ordre.',
  empty: 'Tout est envoyé.',
  emptyHint: 'Vos actions de terrain sont bien reçues par KSP.',
  offline: 'Hors connexion : l’envoi reprendra au retour du réseau.',
  signIn:
    'Votre session a expiré : reconnectez-vous pour envoyer vos actions. Elles restent sur ce téléphone.',
  signInAction: 'Me reconnecter',
  sendNow: 'Envoyer maintenant',
  sending: 'Envoi en cours…',
  waiting: 'En attente',
  inFlight: 'Envoi…',
  failed: 'Non envoyée',
  done: (time: string) => `Faite à ${time}`,
  deadline: (time: string) => `À envoyer avant ${time} : passé 72 h, KSP ne pourra plus l’enregistrer.`,
  retry: 'Réessayer',
  retryNow: 'Renvoyer à l’heure de réception',
  details: 'Voir l’erreur',
  hideDetails: 'Masquer l’erreur',
  code: (code: string) => `Code : ${code}`,
  remove: 'Retirer',
  confirmRemove: 'Retirer cette action ? Elle ne sera jamais envoyée.',
  confirmRemoveYes: 'Oui, retirer',
  confirmRemoveNo: 'Garder',
  blocked: 'Bloquée par l’action non envoyée ci-dessus.',
  openSheet: 'Ouvrir la fiche',
  visit: 'Visite des lieux',
  session: 'Séance de nettoyage',
} as const;
