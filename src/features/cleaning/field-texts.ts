/**
 * Textes communs du terrain (fiches de visite et de séance, envois en attente) : étapes, lieu, arrivée,
 * photos, explications des refus. Les textes propres à un écran sont dans `visit-texts`, `session-texts`
 * et `outbox-texts`. Phrases courtes, verbes d'action : l'agent lit dehors, d'une main. Aucun montant
 * (R-EX-04).
 */

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

export const fieldTexts = {
  back: 'Ma journée',
  retry: 'Réessayer',
  loading: 'Chargement de la fiche…',
  missing: 'Lien incomplet : ouvrez la fiche depuis votre journée.',
  notFound: 'Cette intervention ne vous est plus confiée, ou elle n’existe pas.',
  offlineNever:
    'Pas de réseau, et cette fiche n’a pas encore été gardée sur ce téléphone. Ouvrez-la une fois avec du réseau.',
  cachedAt: (time: string) => `Hors connexion : fiche gardée à ${time}.`,
  refreshing: 'Mise à jour…',
  lead: 'Chef d’équipe',
  steps: 'Étapes',
  stepDone: 'Fait',
  stepCurrent: 'À faire maintenant',
  stepLater: 'Plus tard',
  stepOpen: 'Possible maintenant',
  pending: 'En attente d’envoi',
  sending: 'Envoi…',
  failed: 'Non envoyé',
  pendingSummary: (count: number) =>
    `${count} ${plural(count, 'action attend', 'actions attendent')} le réseau pour partir.`,
  failedSummary: (count: number) =>
    `${count} ${plural(count, 'action n’a', 'actions n’ont')} pas pu être ${plural(count, 'envoyée', 'envoyées')}.`,
  seeOutbox: 'Voir les envois en attente',
  queued: 'Enregistré sur le téléphone : envoi dès le retour du réseau.',
  place: {
    title: 'Lieu',
    customer: (name: string) => `Client : ${name}`,
    hiddenVisit: (type: string, commune: string) =>
      `${type} à ${commune}. L’adresse exacte et le repère s’affichent quand vous marquez votre arrivée.`,
    hiddenSession: (type: string, commune: string) =>
      `${type} à ${commune}. L’adresse exacte et le repère s’affichent pendant la séance.`,
    landmark: (value: string) => `Repère : ${value}`,
    directions: 'Itinéraire',
    directionsHint: 'Ouvre l’application de cartes',
  },
  arrival: {
    title: 'Arrivée',
    action: 'Je suis arrivé',
    locating: 'Recherche de votre position…',
    sending: 'Enregistrement…',
    hint: 'Votre position est demandée une seule fois, pour confirmer l’arrivée.',
    done: (time: string) => `Arrivé à ${time}`,
    distance: (meters: number) => `à ${meters} m du lieu`,
    alert: 'Position éloignée du lieu : votre superviseur est prévenu.',
    withoutPosition: 'Position indisponible : arrivée enregistrée sans position.',
    denied: 'Position refusée : arrivée enregistrée sans position.',
    leadOnly: 'Le chef d’équipe marque l’arrivée.',
  },
  photos: {
    visitTitle: 'Photos',
    beforeTitle: 'Photos « avant »',
    afterTitle: 'Photos « après »',
    hint: 'Avec l’appareil photo du téléphone. 10 au plus.',
    beforeHint: 'Au moins une avant de démarrer. 10 au plus.',
    afterHint: 'Au moins une avant de clôturer. 10 au plus.',
    take: 'Prendre une photo',
    takeBefore: 'Prendre une photo « avant »',
    takeAfter: 'Prendre une photo « après »',
    preparing: 'Préparation de la photo…',
    count: (count: number) => `${count} / 10`,
    full: '10 photos : le maximum est atteint.',
    empty: 'Aucune photo.',
    remove: 'Retirer la photo',
    confirmRemove: 'Retirer cette photo ?',
    confirmRemoveYes: 'Retirer',
    confirmRemoveNo: 'Garder',
    alt: (index: number) => `Photo ${index}`,
    unavailable: 'Aperçu indisponible',
    wrongType: 'Format refusé : prenez une photo JPEG, PNG ou WebP.',
    tooLarge: 'Photo trop lourde (8 Mo au plus).',
    locked: 'Possible après votre arrivée.',
  },
  errors: {
    visitTooEarly: (time: string) =>
      `Trop tôt : la visite commence à ${time}. Le constat, la fin et l’absence du client se déclarent à partir de cette heure.`,
    sessionTooEarly: (minutes: number, time: string) =>
      `Trop tôt pour marquer l’arrivée : c’est possible ${minutes} min avant le début (${time}) au plus.`,
    supervisor: 'La séance ne peut pas démarrer pour le moment. Contactez votre superviseur.',
    photosMissingBefore: 'Ajoutez au moins une photo « avant ».',
    photosMissingAfter: 'Ajoutez au moins une photo « après ».',
    checklistIncomplete: 'Cochez tous les points de la liste avant de clôturer.',
    waitNotElapsed: (minutes: number) =>
      `Attendez encore : le client peut être déclaré absent après ${minutes} min d’attente, comptées à partir de l’heure prévue.`,
    leadOnly: 'Seul le chef d’équipe peut faire cette action.',
    photoLimit: '10 photos au plus.',
    invalidTransition: 'Cette action n’est plus possible : la fiche a changé entre-temps.',
    notFound: 'Cette intervention ne vous est plus confiée.',
    keyReused: 'Envoi refusé : cette action a déjà servi. Retirez-la et refaites le geste.',
    inFuture:
      'L’heure de votre téléphone est en avance : l’action est datée dans le futur. Réglez l’heure, ou renvoyez-la à l’heure de réception.',
    tooOld:
      'Action de plus de 72 h : KSP ne peut plus l’enregistrer. Retirez-la et prévenez votre superviseur.',
    outOfRange: 'L’heure de l’action ne convient pas (avant l’arrivée, ou hors de la séance).',
    forbidden: 'Vous n’avez plus accès à cette action. Contactez votre superviseur.',
    storage: 'Ce téléphone ne peut pas garder l’action hors connexion. Réessayez avec du réseau.',
    reference: (id: string) => `Référence : ${id}`,
  },
} as const;
