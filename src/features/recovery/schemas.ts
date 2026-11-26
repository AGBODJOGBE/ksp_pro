import * as z from 'zod/mini';

/*
 * Espace partenaire du Recouvrement (contrat `ksp-api.v1.yaml`, routes `/api/v1/recovery/partner/*`,
 * ADR-060) : assignations, dossier transmis, acte, encaissement déclaré. Champ par champ : un champ
 * obligatoire absent rend la réponse invalide, un champ ajouté est ignoré. Les énumérations restent des
 * chaînes : une valeur nouvelle s'affiche telle quelle au lieu de casser l'écran. Chargé à la demande,
 * pendant l'appel (hors du premier chargement).
 */

/** `Money` : entier de francs CFA, jamais de décimales. */
export const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });

/** `RecoveryLegalAct` : acte enregistré par le partenaire. */
export const legalActSchema = z.object({
  id: z.string(),
  type: z.string(),
  actDate: z.string(),
  cost: moneySchema,
  fileId: z.nullable(z.string()),
  note: z.nullable(z.string()),
  recordedAt: z.string(),
  nextStepDate: z.nullable(z.string()),
});

/** `RecoveryPartnerRef`. */
export const partnerRefSchema = z.object({
  id: z.string(),
  /** `bailiff` (huissier) ou `lawyer` (avocat). */
  kind: z.string(),
  name: z.string(),
  office: z.nullable(z.string()),
});

/** `RecoveryPartnerAssignment` : une assignation, avec ses actes. */
export const partnerAssignmentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  partner: partnerRefSchema,
  /** `active`, `withdrawn` ou `completed`. */
  status: z.string(),
  assignedAt: z.string(),
  withdrawnAt: z.nullable(z.string()),
  withdrawalReason: z.nullable(z.string()),
  acts: z.array(legalActSchema),
  lastUpdateAt: z.nullable(z.string()),
});

/** `RecoveryAssignmentPage` : sans total (pagination par curseur). */
export const assignmentPageSchema = z.object({
  assignments: z.array(partnerAssignmentSchema),
  nextCursor: z.nullable(z.string()),
});

/** `RecoveryDebtor` : coordonnées du débiteur (personne ou société). */
export const debtorSchema = z.object({
  id: z.string(),
  /** `person` ou `company`. */
  kind: z.string(),
  /** `main`, `co_debtor` ou `guarantor`. */
  role: z.string(),
  displayName: z.string(),
  firstNames: z.nullable(z.string()),
  lastName: z.nullable(z.string()),
  legalName: z.nullable(z.string()),
  ifu: z.nullable(z.string()),
  rccm: z.nullable(z.string()),
  representativeName: z.nullable(z.string()),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  address: z.nullable(z.string()),
  communeKey: z.nullable(z.string()),
});

/** `RecoveryClaim` : une créance. */
export const claimSchema = z.object({
  id: z.string(),
  reference: z.string(),
  amount: moneySchema,
  dueDate: z.string(),
  description: z.nullable(z.string()),
});

/** `RecoveryCaseAmounts` : montants du dossier. */
export const amountsSchema = z.object({
  principal: moneySchema,
  interests: moneySchema,
  costs: moneySchema,
  paid: moneySchema,
  waived: moneySchema,
  due: moneySchema,
  overpaid: moneySchema,
});

/** `RecoveryActor`. */
export const actorSchema = z.object({
  type: z.string(),
  userId: z.nullable(z.string()),
  displayName: z.nullable(z.string()),
});

/** `RecoveryCaseDocument` : pièce visible du partenaire. */
export const caseDocumentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  fileId: z.nullable(z.string()),
  documentId: z.nullable(z.string()),
  label: z.string(),
  addedBy: actorSchema,
  addedAt: z.string(),
  visibleToDebtor: z.boolean(),
});

/** `RecoveryInstallment`. */
export const installmentSchema = z.object({
  id: z.nullable(z.string()),
  rank: z.int(),
  dueDate: z.string(),
  amount: moneySchema,
  paidAmount: moneySchema,
  /** `upcoming`, `due`, `paid`, `partial` ou `missed`. */
  status: z.string(),
  paidAt: z.nullable(z.string()),
});

/** `RecoveryPaymentPlan` : échéancier signé. */
export const paymentPlanSchema = z.object({
  id: z.string(),
  status: z.string(),
  terms: z.object({
    firstAmount: moneySchema,
    firstDueDate: z.string(),
    /** `weekly`, `biweekly` ou `monthly`. */
    rhythm: z.string(),
    installmentsCount: z.int(),
  }),
  total: moneySchema,
  installments: z.array(installmentSchema),
  withinScale: z.boolean(),
  violations: z.array(z.string()),
  proposedBy: z.string(),
  renegotiation: z.boolean(),
  documentId: z.nullable(z.string()),
  signedAt: z.nullable(z.string()),
  missedCount: z.int(),
  createdAt: z.string(),
});

/** `RecoveryFormalNotice` : mise en demeure. */
export const formalNoticeSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  /** `issued` ou `delivered`. */
  status: z.string(),
  signedBy: actorSchema,
  issuedAt: z.string(),
  deliveryMethod: z.nullable(z.string()),
  deliveredAt: z.nullable(z.string()),
  proofFileId: z.nullable(z.string()),
  deadlineAt: z.nullable(z.string()),
});

/** `RecoveryParty` : le créancier. */
export const partySchema = z.object({
  /** `user` ou `organization`. */
  type: z.string(),
  id: z.string(),
  displayName: z.string(),
});

/** `RecoveryAssignmentFile` : le dossier transmis au partenaire (chaque lecture est tracée). */
export const assignmentFileSchema = z.object({
  assignment: partnerAssignmentSchema,
  debtors: z.array(debtorSchema),
  claims: z.array(claimSchema),
  amounts: amountsSchema,
  documents: z.array(caseDocumentSchema),
  signedPlan: z.nullable(paymentPlanSchema),
  notices: z.array(formalNoticeSchema),
  creditor: partySchema,
});

/** `RecoveryOfflinePayment` : somme encaissée déclarée, en attente de validation par la finance. */
export const offlinePaymentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  source: z.string(),
  amount: moneySchema,
  receivedOn: z.string(),
  reference: z.nullable(z.string()),
  proofFileId: z.nullable(z.string()),
  /** `pending_approval`, `approved` ou `rejected`. */
  status: z.string(),
  recordedBy: actorSchema,
  approvedBy: z.nullable(actorSchema),
  rejectionReason: z.nullable(z.string()),
  collectionId: z.nullable(z.string()),
  createdAt: z.string(),
  partnerAssignmentId: z.nullable(z.string()),
});

export type Money = z.infer<typeof moneySchema>;
export type LegalAct = z.infer<typeof legalActSchema>;
export type PartnerAssignment = z.infer<typeof partnerAssignmentSchema>;
export type AssignmentPage = z.infer<typeof assignmentPageSchema>;
export type Debtor = z.infer<typeof debtorSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type CaseAmounts = z.infer<typeof amountsSchema>;
export type CaseDocument = z.infer<typeof caseDocumentSchema>;
export type PaymentPlan = z.infer<typeof paymentPlanSchema>;
export type FormalNotice = z.infer<typeof formalNoticeSchema>;
export type AssignmentFile = z.infer<typeof assignmentFileSchema>;
export type OfflinePayment = z.infer<typeof offlinePaymentSchema>;
