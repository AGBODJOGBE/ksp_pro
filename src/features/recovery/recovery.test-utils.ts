/**
 * Réponses de la gateway pour l'espace partenaire (contrat `ksp-api.v1.yaml`, `/api/v1/recovery/partner/*`),
 * pour les tests unitaires.
 */

export const ASSIGNMENT_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1001';
export const ASSIGNMENTS = '/api/v1/recovery/partner/assignments';
export const FILE = `${ASSIGNMENTS}/${ASSIGNMENT_ID}`;

const xof = (amount: number) => ({ amount, currency: 'XOF' });

export const act = (id: string, type: string, actDate: string, cost = 0) => ({
  id,
  type,
  actDate,
  cost: xof(cost),
  fileId: null,
  note: null,
  recordedAt: `${actDate}T10:00:00Z`,
  nextStepDate: null,
});

export const assignment = (
  id: string,
  caseNumber: string,
  status: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  caseId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e4001',
  caseNumber,
  partner: { id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e0001', kind: 'bailiff', name: 'Me Adjovi', office: null },
  status,
  assignedAt: '2026-11-03T09:00:00Z',
  withdrawnAt: null,
  withdrawalReason: null,
  acts: [] as unknown[],
  lastUpdateAt: null,
  ...overrides,
});

export const activeAssignment = () =>
  assignment(ASSIGNMENT_ID, 'REC-2026-00012', 'active', {
    acts: [
      act('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e2001', 'summons_to_pay', '2026-11-10', 35_000),
      act('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e2002', 'service', '2026-11-18'),
    ],
  });

export const assignmentFile = (overrides: Record<string, unknown> = {}) => ({
  assignment: activeAssignment(),
  debtors: [
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e6001',
      kind: 'person',
      role: 'main',
      displayName: 'Kossi Mensah',
      firstNames: 'Kossi',
      lastName: 'Mensah',
      legalName: null,
      ifu: null,
      rccm: null,
      representativeName: null,
      phones: ['+2290197001122'],
      emails: ['kossi.mensah@exemple.bj'],
      address: 'Rue 1024, Fidjrossè',
      communeKey: 'cotonou',
    },
  ],
  claims: [
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e7001',
      reference: 'FAC-2026-0142',
      amount: xof(250_000),
      dueDate: '2026-06-30',
      description: null,
    },
  ],
  amounts: {
    principal: xof(350_000),
    interests: xof(15_000),
    costs: xof(35_000),
    paid: xof(75_000),
    waived: xof(0),
    due: xof(325_000),
    overpaid: xof(0),
  },
  documents: [
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8001',
      kind: 'mandate',
      fileId: null,
      documentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8101',
      label: 'Mandat de recouvrement signé',
      addedBy: { type: 'creditor', userId: null, displayName: 'Quincaillerie du Port' },
      addedAt: '2026-09-15T10:00:00Z',
      visibleToDebtor: false,
    },
  ],
  signedPlan: null,
  notices: [],
  creditor: {
    type: 'organization',
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8eb001',
    displayName: 'Quincaillerie du Port',
  },
  ...overrides,
});

export const offlinePayment = (amount: number, receivedOn: string) => ({
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e3001',
  caseId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e4001',
  caseNumber: 'REC-2026-00012',
  source: 'partner',
  amount: xof(amount),
  receivedOn,
  reference: null,
  proofFileId: null,
  status: 'pending_approval',
  recordedBy: { type: 'partner', userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11', displayName: 'Me Adjovi' },
  approvedBy: null,
  rejectionReason: null,
  collectionId: null,
  createdAt: '2026-11-26T10:00:00Z',
  partnerAssignmentId: ASSIGNMENT_ID,
});
