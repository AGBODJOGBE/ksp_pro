'use client';

import { api, parseResponse } from '@/lib/api';
import type { Page } from '@/lib/use-paged-list';
import type { AssignmentFile, LegalAct, OfflinePayment, PartnerAssignment } from './schemas';

/**
 * Appels de l'espace partenaire du Recouvrement (`/api/v1/recovery/partner/*`, huissiers et avocats,
 * ADR-060), en ligne seulement (F-022). Schémas chargés pendant l'appel (hors du premier chargement).
 *
 * La gateway contrôle aujourd'hui ces routes sur les rôles du jeton, qui ne portent que `customer` sur le
 * web : 403 en réel tant que le back n'est pas corrigé (prérequis B1).
 */

const ASSIGNMENTS = '/api/v1/recovery/partner/assignments';
const assignmentPath = (id: string) => `/api/v1/recovery/partner/assignments/${encodeURIComponent(id)}`;
const actsPath = (id: string) => `/api/v1/recovery/partner/assignments/${encodeURIComponent(id)}/acts`;
const collectionsPath = (id: string) =>
  `/api/v1/recovery/partner/assignments/${encodeURIComponent(id)}/collections`;

const schemas = () => import('./schemas');

/** Statuts d'une assignation (`status` de la liste), dans l'ordre des onglets. */
export const ASSIGNMENT_STATUSES = ['active', 'withdrawn', 'completed'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const PAGE_SIZE = 20;

/** Mes dossiers assignés (`GET /recovery/partner/assignments`), par statut, page par page (sans total). */
export async function listMyAssignments(
  status: AssignmentStatus,
  cursor?: string,
): Promise<Page<PartnerAssignment>> {
  const [{ assignmentPageSchema }, body] = await Promise.all([
    schemas(),
    api.get(ASSIGNMENTS, { query: { status, limit: PAGE_SIZE, cursor } }),
  ]);
  const page = parseResponse(assignmentPageSchema, body);
  return { data: page.assignments, nextCursor: page.nextCursor };
}

/**
 * Dossier transmis (`GET …/assignments/{id}`). **Chaque lecture est inscrite au journal d'audit du back** :
 * un seul appel par ouverture de la fiche, jamais de préchargement ni de lecture automatique.
 * 404 `RECOVERY_ASSIGNMENT_NOT_FOUND` : l'assignation n'est plus en cours (retirée, terminée, dossier clos).
 */
export async function getMyAssignment(id: string): Promise<AssignmentFile> {
  const [{ assignmentFileSchema }, body] = await Promise.all([schemas(), api.get(assignmentPath(id))]);
  return parseResponse(assignmentFileSchema, body);
}

/** Types d'acte du contrat (`RecoveryLegalActRequest.type`), dans l'ordre d'une procédure. */
export const LEGAL_ACT_TYPES = [
  'summons_to_pay',
  'service',
  'conservatory_measure',
  'seizure',
  'injunction_request',
  'injunction_order',
  'hearing',
  'judgment',
  'enforcement',
  'insolvency_report',
  'other',
] as const;
export type LegalActType = (typeof LEGAL_ACT_TYPES)[number];

/** Corps de `POST …/acts` : coût en entiers de FCFA, pièce déposée au service file (`recovery_evidence`). */
export interface LegalActBody {
  type: LegalActType;
  /** AAAA-MM-JJ, au plus aujourd'hui. */
  actDate: string;
  cost: { amount: number; currency: 'XOF' };
  fileId?: string;
  note?: string;
  /** AAAA-MM-JJ, pas avant la date de l'acte. */
  nextStepDate?: string;
}

/** Enregistre un acte (le créancier et le juriste KSP sont prévenus par le back). Rejoué : le même acte. */
export async function recordLegalAct(
  id: string,
  body: LegalActBody,
  idempotencyKey: string,
): Promise<LegalAct> {
  const [{ legalActSchema }, response] = await Promise.all([
    schemas(),
    api.post(actsPath(id), body, { idempotencyKey }),
  ]);
  return parseResponse(legalActSchema, response);
}

/** Corps de `POST …/collections`. */
export interface CollectionBody {
  amount: { amount: number; currency: 'XOF' };
  /** AAAA-MM-JJ, au plus aujourd'hui. */
  receivedOn: string;
  proofFileId?: string;
  note?: string;
}

/**
 * Déclare une somme encaissée (à virer à KSP sous 5 jours ouvrés) : en attente de validation par la
 * finance, imputée au dossier seulement à la validation.
 */
export async function declareCollection(
  id: string,
  body: CollectionBody,
  idempotencyKey: string,
): Promise<OfflinePayment> {
  const [{ offlinePaymentSchema }, response] = await Promise.all([
    schemas(),
    api.post(collectionsPath(id), body, { idempotencyKey }),
  ]);
  return parseResponse(offlinePaymentSchema, response);
}
