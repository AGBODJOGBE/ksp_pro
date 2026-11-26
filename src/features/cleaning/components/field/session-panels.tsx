'use client';

/*
 * Panneaux de la séance ouverts à la demande (incident, client absent, signature du client) : chargés
 * seulement quand l'agent les ouvre, et préchargés avec réseau pour rester disponibles hors connexion
 * (`FieldStatus`).
 */
export { IncidentForm } from './incident-form';
export { SessionMissedForm } from './session-missed-form';
export { SignaturePad } from './signature-pad';
