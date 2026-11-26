import type { BadgeTone } from '@/components/ui/badge';

/**
 * Textes de la fiche de visite des lieux, chargés seulement par cet écran (les textes communs du terrain sont dans
 * `./field-texts`). Phrases courtes : l'agent lit dehors, d'une main. Aucun montant (R-EX-04).
 */

interface Label {
  label: string;
  tone: BadgeTone;
}

export const VISIT_STATUS: Record<string, Label> = {
  scheduled: { label: 'Prévue', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'action' },
  completed: { label: 'Terminée', tone: 'success' },
  missed: { label: 'Client absent', tone: 'warning' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

export const visitTexts = {
  observations: {
    title: 'Constat',
    lead: 'Mesures réelles du lieu. Les valeurs déclarées par le client sont déjà remplies : corrigez-les si besoin.',
    locked: 'Marquez d’abord votre arrivée.',
    tooEarlyHint: (time: string) => `Le constat se saisit à partir de ${time}, heure prévue de la visite.`,
    save: 'Enregistrer le constat',
    saving: 'Enregistrement…',
    saved: 'Constat enregistré.',
    edit: 'Modifier le constat',
    cancelEdit: 'Annuler la modification',
    note: 'Note pour le superviseur (facultatif)',
    noteHint: 'Jamais montrée au client.',
    noteCounter: (length: number) => `${length} / 1000`,
    required: 'Obligatoire',
    optional: 'facultatif',
    yes: 'Oui',
    no: 'Non',
    missingValue: 'Renseignez cette valeur.',
    notInteger: 'Entrez un nombre entier.',
    range: (min: number, max: number) => `Entre ${min} et ${max}.`,
    rangeHint: (min: number, max: number, unit: string | null) =>
      `Entre ${min.toLocaleString('fr-BJ')} et ${max.toLocaleString('fr-BJ')}${unit ? ` ${unit}` : ''}.`,
    fixErrors: 'Corrigez les valeurs signalées.',
    empty: 'Aucune mesure n’est demandée pour ce lieu.',
    noValue: 'Non renseigné',
  },
  visit: {
    title: 'Visite des lieux',
    request: (number: string) => `Demande ${number}`,
    duration: (value: string) => `durée prévue ${value}`,
    finishTitle: 'Fin de la visite',
    complete: 'Visite terminée',
    completing: 'Enregistrement…',
    completeLocked: 'Enregistrez d’abord le constat.',
    confirmComplete: (count: number) =>
      `Terminer la visite avec ${count} ${plural(count, 'photo', 'photos')} ? Le constat ne pourra plus être modifié.`,
    confirmCompleteYes: 'Oui, terminer',
    confirmNo: 'Pas encore',
    completed: (time: string) => `Visite terminée à ${time}.`,
    missedTitle: 'Client absent',
    missedOpen: 'Client absent',
    missedHint: 'Personne sur place ? Prenez une photo du lieu, puis déclarez le client absent.',
    missedNotBefore: (time: string) => `Possible à partir de ${time}, heure prévue de la visite.`,
    missedPhoto: 'Photo du lieu (obligatoire)',
    missedPhotoMissing: 'Prenez une photo du lieu.',
    missedSubmit: 'Déclarer le client absent',
    missedSending: 'Enregistrement…',
    missedDone: 'Client absent déclaré. KSP prévient le client.',
    cancelled: 'Cette visite est annulée : rien à faire.',
    missed: 'Visite manquée : client absent.',
    close: 'Fermer',
  },
} as const;
