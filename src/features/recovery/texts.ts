import type { BadgeTone } from '@/components/ui/badge';

/*
 * Textes de l'espace partenaire du Recouvrement (huissiers et avocats partenaires, ADR-060), chargés par
 * ses écrans seulement. Libellés des valeurs du contrat : une valeur inconnue s'affiche telle quelle.
 */

/** Libellé d'une valeur du contrat, ou la valeur elle-même si elle est nouvelle. */
export function labelOf(labels: Readonly<Record<string, string>>, value: string): string {
  return labels[value] ?? value;
}

/** Types d'acte (`RecoveryLegalActRequest.type`), libellés du journal de preuve du back. */
export const ACT_TYPE_LABELS: Readonly<Record<string, string>> = {
  summons_to_pay: 'Sommation de payer',
  service: 'Signification',
  conservatory_measure: 'Mesure conservatoire',
  seizure: 'Saisie',
  injunction_request: 'Requête en injonction de payer',
  injunction_order: 'Ordonnance d’injonction de payer',
  hearing: 'Audience',
  judgment: 'Décision de justice',
  enforcement: 'Exécution forcée',
  insolvency_report: 'Constat d’insolvabilité ou de disparition',
  other: 'Autre acte',
};

export const ASSIGNMENT_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  active: { label: 'En cours', tone: 'action' },
  withdrawn: { label: 'Retiré', tone: 'warning' },
  completed: { label: 'Terminé', tone: 'neutral' },
};

export const DEBTOR_ROLE: Readonly<Record<string, string>> = {
  main: 'Débiteur principal',
  co_debtor: 'Codébiteur',
  guarantor: 'Caution',
};

export const DEBTOR_KIND: Readonly<Record<string, string>> = {
  person: 'Personne',
  company: 'Société',
};

export const PARTY_TYPE: Readonly<Record<string, string>> = {
  user: 'Particulier',
  organization: 'Organisation',
};

export const PLAN_STATUS: Readonly<Record<string, string>> = {
  proposed: 'Proposé',
  pending_creditor: 'En attente du créancier',
  signed: 'Signé',
  completed: 'Soldé',
  defaulted: 'Rompu',
  rejected: 'Refusé',
  cancelled: 'Annulé',
};

export const PLAN_RHYTHM: Readonly<Record<string, string>> = {
  weekly: 'chaque semaine',
  biweekly: 'toutes les deux semaines',
  monthly: 'chaque mois',
};

export const INSTALLMENT_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  upcoming: { label: 'À venir', tone: 'neutral' },
  due: { label: 'Exigible', tone: 'warning' },
  paid: { label: 'Payée', tone: 'success' },
  partial: { label: 'Partielle', tone: 'warning' },
  missed: { label: 'Manquée', tone: 'danger' },
};

export const NOTICE_STATUS: Readonly<Record<string, string>> = {
  issued: 'Émise',
  delivered: 'Remise',
};

export const DELIVERY_METHOD: Readonly<Record<string, string>> = {
  hand_delivery: 'Remise en main propre contre décharge',
  registered_mail: 'Lettre recommandée',
  bailiff: 'Huissier de justice',
  email: 'E-mail',
};

export const DOCUMENT_KIND: Readonly<Record<string, string>> = {
  evidence: 'Justificatif',
  mandate: 'Mandat',
  payment_plan: 'Échéancier',
  formal_notice: 'Mise en demeure',
  notice_delivery_proof: 'Preuve de remise',
  settlement_certificate: 'Attestation de solde',
  fee_quote: 'Devis',
  legal_act: 'Acte',
  evidence_log: 'Journal de preuve',
  receipt: 'Reçu',
  statement: 'Relevé',
  dispute_evidence: 'Pièce de contestation',
};

export const ACTOR_TYPE: Readonly<Record<string, string>> = {
  staff: 'KSP',
  creditor: 'Créancier',
  debtor: 'Débiteur',
  partner: 'Partenaire',
  system: 'KSP',
};

export const COLLECTION_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  pending_approval: { label: 'En attente de validation par la finance', tone: 'warning' },
  approved: { label: 'Validé par la finance', tone: 'success' },
  rejected: { label: 'Refusé par la finance', tone: 'danger' },
};

export const recoveryTexts = {
  genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
  reference: (id: string) => `référence : ${id}`,
  retry: 'Réessayer',
  list: {
    title: 'Mes dossiers',
    lead: 'Les dossiers de recouvrement que KSP vous a confiés.',
    tabsLabel: 'Dossiers par statut',
    tabs: { active: 'En cours', withdrawn: 'Retirés', completed: 'Terminés' },
    loading: 'Chargement des dossiers…',
    retry: 'Réessayer',
    loadMore: 'Voir plus',
    loadingMore: 'Chargement…',
    empty: {
      active: 'Aucun dossier en cours ne vous est confié.',
      withdrawn: 'Aucun dossier ne vous a été retiré.',
      completed: 'Aucune mission terminée.',
    },
    assignedOn: (date: string) => `Confié le ${date}`,
    acts: (count: number) => (count === 0 ? 'Aucun acte' : count === 1 ? '1 acte' : `${count} actes`),
    lastAct: (label: string, date: string) => `Dernier acte : ${label}, le ${date}`,
    lastUpdate: (date: string) => `Dernière mise à jour le ${date}`,
    open: 'Ouvrir le dossier',
    withdrawnOn: (date: string) => `Retiré le ${date}`,
    withdrawalReason: (reason: string) => `Motif : ${reason}`,
    closedNote: 'Ce dossier ne vous est plus confié : sa fiche ne s’ouvre plus.',
    completedNote: 'Mission terminée : la fiche du dossier ne s’ouvre plus.',
  },
  file: {
    back: 'Mes dossiers',
    title: (number: string) => `Dossier ${number}`,
    fallbackTitle: 'Dossier',
    loading: 'Chargement du dossier…',
    missing: 'Aucun dossier indiqué. Ouvrez un dossier depuis « Mes dossiers ».',
    assignedOn: (date: string) => `Confié le ${date}`,
    audit: 'Chaque ouverture de ce dossier est enregistrée au journal de KSP.',
    refresh: 'Actualiser',
    refreshing: 'Actualisation…',
    refreshed: (time: string) => `Lu à ${time}`,
    goneTitle: 'Ce dossier ne vous est plus confié',
    goneText:
      'KSP vous a retiré ce dossier, la mission est terminée ou le dossier est clos. Ses retraits et sa fin figurent dans « Mes dossiers ».',
    backToList: 'Retour à mes dossiers',
    amounts: 'Montants',
    due: 'Reste dû',
    principal: 'Principal',
    interests: 'Intérêts',
    costs: 'Frais',
    paid: 'Déjà payé',
    waived: 'Remis',
    overpaid: 'Trop-perçu',
    debtors: 'Débiteurs',
    call: 'Appeler',
    callLabel: (name: string, phone: string) => `Appeler ${name} au ${phone}`,
    write: 'Écrire',
    writeLabel: (name: string, email: string) => `Écrire à ${name} : ${email}`,
    address: 'Adresse',
    commune: 'Commune (code)',
    ifu: 'IFU',
    rccm: 'RCCM',
    representative: 'Représentant',
    noContact: 'Aucun téléphone ni e-mail connu.',
    claims: 'Créances',
    claimDue: (date: string) => `Échue le ${date}`,
    noClaims: 'Aucune créance détaillée.',
    creditor: 'Créancier',
    plan: 'Échéancier signé',
    noPlan: 'Aucun échéancier signé.',
    planSigned: (date: string) => `Signé le ${date}`,
    planTerms: (first: string, firstDate: string, count: number, rhythm: string) =>
      `Premier versement de ${first} le ${firstDate}, puis ${count} échéance${count > 1 ? 's' : ''} ${rhythm}.`,
    planTotal: 'Total de l’échéancier',
    planMissed: (count: number) =>
      count === 0
        ? 'Aucune échéance manquée.'
        : count === 1
          ? '1 échéance manquée.'
          : `${count} échéances manquées.`,
    installmentsCaption: 'Échéances',
    installmentRank: 'N°',
    installmentDate: 'Date',
    installmentAmount: 'Montant',
    installmentPaid: 'Payé',
    installmentStatus: 'État',
    notices: 'Mises en demeure',
    noNotices: 'Aucune mise en demeure.',
    noticeIssued: (date: string) => `Émise le ${date}`,
    noticeSignedBy: (name: string) => `Signée par ${name}`,
    noticeDelivery: 'Remise',
    noticeDelivered: (date: string) => `Remise le ${date}`,
    noticeDeadline: (date: string) => `Délai jusqu’au ${date}`,
    documents: 'Pièces de la mission',
    noDocuments: 'Aucune pièce transmise.',
    documentAdded: (date: string, by: string) => `Ajoutée le ${date} · ${by}`,
    documentsLocked: 'Lecture des pièces pas encore possible',
    documentsLockedText:
      'Les pièces sont listées, mais leur lecture depuis l’Espace pro arrive bientôt. En attendant, demandez-les à votre interlocuteur KSP.',
    documentsNeed: 'Lien de lecture temporaire d’une pièce de la mission, pour le partenaire (prérequis B7).',
    history: 'Historique des actes',
    noActs: 'Aucun acte enregistré pour l’instant.',
    actCost: (cost: string) => `Coût : ${cost}`,
    actNoCost: 'Sans frais',
    actNext: (date: string) => `Prochaine échéance : ${date}`,
    actRecorded: (date: string) => `Enregistré le ${date}`,
    actWithFile: 'Pièce jointe',
    recordAct: 'Enregistrer un acte',
    declareCollection: 'Déclarer un encaissement',
    actRecordedMessage: 'Acte enregistré. Le créancier et le juriste KSP sont prévenus.',
  },
  act: {
    title: 'Enregistrer un acte',
    lead: 'Le créancier et le juriste KSP sont prévenus dès l’enregistrement.',
    cancel: 'Annuler',
    type: 'Type d’acte',
    typePlaceholder: 'Choisissez le type',
    typeRequired: 'Choisissez le type d’acte.',
    actDate: 'Date de l’acte',
    actDateRequired: 'Indiquez la date de l’acte.',
    actDateFuture: 'La date de l’acte ne peut pas dépasser aujourd’hui.',
    cost: 'Coût de l’acte (F CFA)',
    costHint: 'Prélevé sur la provision du créancier ; KSP n’avance aucun frais. Indiquez 0 sans frais.',
    costRequired: 'Indiquez le coût, en francs CFA (0 sans frais).',
    costInvalid: 'Le coût est un nombre entier de francs CFA, sans décimales.',
    file: 'Pièce de l’acte (facultative)',
    note: 'Note (facultative)',
    noteHint: 'Pour le créancier et le juriste KSP.',
    noteTooLong: (max: number) => `${max} caractères au plus.`,
    nextStepDate: 'Prochaine échéance (facultative)',
    nextStepHint: 'Audience, délai de signification… Pas avant la date de l’acte.',
    nextStepBefore: 'La prochaine échéance ne peut pas précéder la date de l’acte.',
    review: 'Vérifier',
    confirmTitle: 'Confirmer l’enregistrement',
    confirmText: 'L’acte sera inscrit au dossier ; le créancier et le juriste KSP seront prévenus.',
    confirm: 'Enregistrer l’acte',
    sending: 'Enregistrement…',
    edit: 'Modifier',
    summaryType: 'Type',
    summaryDate: 'Date',
    summaryCost: 'Coût',
    summaryFile: 'Pièce',
    summaryNext: 'Prochaine échéance',
    none: 'Aucune',
  },
  collection: {
    title: 'Déclarer un encaissement',
    lead: 'Une somme reçue du débiteur pour ce dossier.',
    cancel: 'Annuler',
    due: (amount: string) => `Reste dû : ${amount}`,
    amount: 'Montant reçu (F CFA)',
    amountRequired: 'Indiquez le montant reçu, en francs CFA.',
    amountInvalid: 'Le montant est un nombre entier de francs CFA, sans décimales.',
    amountAboveDue: (due: string) => `Le montant ne peut pas dépasser le reste dû (${due}).`,
    receivedOn: 'Date de réception',
    receivedOnRequired: 'Indiquez la date de réception.',
    receivedOnFuture: 'La date de réception ne peut pas dépasser aujourd’hui.',
    proof: 'Preuve de l’encaissement (facultative)',
    note: 'Note (facultative)',
    review: 'Vérifier',
    confirmTitle: 'Confirmer la déclaration',
    confirmText: 'La somme sera imputée au dossier après rapprochement et validation par la finance de KSP.',
    confirm: 'Déclarer l’encaissement',
    sending: 'Envoi…',
    edit: 'Modifier',
    summaryAmount: 'Montant',
    summaryDate: 'Reçu le',
    summaryProof: 'Preuve',
    none: 'Aucune',
    doneTitle: 'Encaissement déclaré',
    doneText: (amount: string, date: string) => `${amount} reçus le ${date}.`,
    reminderTitle: 'À virer à KSP sous 5 jours ouvrés',
    reminderText:
      'Virez cette somme à KSP sans attendre : elle n’est imputée au dossier qu’après rapprochement et validation par la finance.',
    suspendedTitle: 'Dossier suspendu',
    suspendedText:
      'Le débiteur conteste ce dossier : la déclaration attend la décision du juriste KSP. Contactez KSP avant tout nouvel encaissement.',
  },
  evidence: {
    hint: 'PDF ou image (JPEG, PNG, WebP), 10 Mo au plus.',
    choose: 'Joindre une pièce',
    replace: 'Remplacer la pièce',
    remove: 'Retirer',
    uploading: 'Envoi de la pièce…',
    uploaded: (name: string) => `Pièce jointe : ${name}`,
    wrongType: 'Format refusé : joignez un PDF ou une image (JPEG, PNG, WebP).',
    tooLarge: 'Pièce trop lourde : 10 Mo au plus.',
    failed: 'La pièce n’a pas pu être envoyée. Réessayez.',
  },
  errors: {
    keyReused:
      'Cette demande a déjà été envoyée avec un autre contenu. Vérifiez l’historique du dossier avant de recommencer.',
    invalidTransition:
      'Cette action n’est plus possible sur ce dossier. Actualisez le dossier pour voir son état.',
    validation: 'Une information est refusée : vérifiez le formulaire.',
  },
  denied: {
    title: 'Votre accès partenaire n’est pas encore actif',
    text: 'Contactez KSP pour activer votre accès, puis actualisez vos accès.',
    back: 'Retour à mes espaces',
  },
} as const;
