import type { BrowserContext, Page, Route } from '@playwright/test';

/**
 * Gateway simulée par interception des requêtes du navigateur (recopiée du portail) : routes
 * `/api/v1/identity/*`, `/api/v1/cleaning/agent/*`, `/api/v1/cleaning/catalog/zones`, routes de terrain des
 * visites et des séances (idempotence comprise : même clé et même corps, même réponse ; autre corps, 409),
 * envoi de fichiers
 * (`/api/v1/file/*`, avec un stockage simulé sur l'origine de la gateway, autorisée par la CSP),
 * notifications (liste, préférences) et espace partenaire du Recouvrement (`/api/v1/recovery/partner/*`),
 * au format du contrat `ksp-api.v1.yaml`. En-têtes CORS avec cookies comme la vraie
 * gateway, et état côté « serveur » (le cookie de renouvellement n'est pas reproduit : la session vit dans
 * ce simulateur). Le jeton d'accès a la forme d'un JWT et porte `roles` et `perms`, comme ceux d'identity
 * (non signé : le front ne vérifie pas la signature).
 */

const GATEWAY = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005';
/** Stockage simulé : sur l'origine de la gateway, déjà autorisée par la CSP (`connect-src`). */
const STORAGE = `${GATEWAY}/__stockage`;

/** En-têtes autorisés par la politique CORS de la gateway (services/gateway, enableCors). */
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-App-Version, Idempotency-Key, X-Debtor-Session';
const ALLOWED_X_HEADERS = new Set(['x-app-version', 'x-debtor-session']);

export const VALID_CODE = '482913';
export const AGENT_PERMS = ['cleaning.session.perform', 'cleaning.visit.perform'];

export interface Grants {
  roles?: string[];
  perms?: string[];
}

export interface GatewayOptions {
  /** Session déjà ouverte (cookie de renouvellement valide). */
  signedIn?: boolean;
  /** Profil complet (prénom et nom) ; faux par défaut pour un nouveau compte. */
  named?: boolean;
  /** Droits du jeton ; session web : `customer` seulement par défaut. */
  grants?: Grants;
  /** Droits donnés au prochain renouvellement (« Actualiser mes accès » après validation). */
  grantsAfterRefresh?: Grants;
  /** Statut de l'agent (`GET /cleaning/agent/me`), ou `null` : jamais candidaté (404). */
  agentStatus?: string | null;
  /** Statut d'emploi de l'agent ; indépendant par défaut. */
  employmentKind?: 'employee' | 'independent';
  /** `GET /admin/cleaning/skills` lisible par ce compte ; sinon 403 (prérequis back B4). */
  skillsReadable?: boolean;
  /** `PUT /me/availability` refusé : plage occupée par une affectation (409). */
  availabilityInUse?: boolean;
  /** Fiche de séance : l'agent est chef d'équipe (vrai par défaut). */
  sessionLead?: boolean;
  /** `POST /sessions/{id}/start` refusé avec ce code (422). */
  startRefused?: string;
  /** `POST /me/unavailabilities` refusé : chevauche des affectations (409). */
  unavailabilityConflict?: boolean;
  /** Routes du partenaire refusées (403) : accès pas encore actif (prérequis back B1, cas réel). */
  partnerForbidden?: boolean;
  /** `POST …/collections` refusé : dossier suspendu par une contestation (422). */
  caseSuspended?: boolean;
  /** Notifications du partenaire (lien vers la fiche d'un dossier, B2) au lieu de celles de l'agent. */
  partnerNotifications?: boolean;
}

export interface FakeGateway {
  forbiddenHeaders: string[];
  calls: Array<{ method: string; path: string; body: unknown; headers: Record<string, string> }>;
  /** Actions de terrain reçues : méthode, chemin, clé d'idempotence, corps (dans l'ordre). */
  field: Array<{ method: string; path: string; key: string; body: unknown }>;
  /** Contenus reçus par le stockage simulé. */
  stored: string[];
  /**
   * Réseau coupé : la gateway et le stockage simulés ne répondent plus. `context.setOffline` ne suffit pas :
   * les requêtes interceptées par `page.route` reçoivent quand même leur réponse simulée.
   */
  offline: boolean;
}

/** Coupe ou rétablit le réseau : celui du navigateur et celui de la gateway simulée. */
export async function setNetwork(context: BrowserContext, gateway: FakeGateway, online: boolean) {
  gateway.offline = !online;
  await context.setOffline(!online);
}

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function accessToken(grants: Grants, serial: number): string {
  const claims = {
    iss: 'ksp-identity',
    aud: 'ksp-api',
    sub: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
    client_id: 'web',
    jti: `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e${String(40 + serial)}`,
    ctx: 'personal',
    roles: (grants.roles ?? ['customer']).map((role) => ({ role, scopeType: 'personal', scopeId: null })),
    perms: grants.perms ?? [],
    mfa: false,
  };
  return `${base64url({ alg: 'ES256', typ: 'at+jwt' })}.${base64url(claims)}.signature-e2e`;
}

const error = (code: string, message: string, details: Record<string, unknown> = {}) => ({
  error: { code, message, details, correlationId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e12' },
});

const STATS = {
  sessionsCompleted: 14,
  visitsCompleted: 6,
  hoursThisWeek: 12.5,
  hoursThisMonth: 46,
  ratingAverage: 4.6,
  ratingsCount: 9,
  openClaims: 0,
};

const agentProfile = (status: string, employmentKind: string) => ({
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
  status,
  firstName: 'Koffi',
  lastName: 'Adjovi',
  phone: '+2290197000101',
  photoUrl: null,
  employmentKind,
  residenceCommuneKey: 'cotonou',
  zoneKeys: ['cotonou', 'abomey-calavi'],
  skills: [
    { code: 'interior_cleaning', name: 'Nettoyage intérieur', validated: true },
    { code: 'gardening', name: 'Jardinage', validated: false },
  ],
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
  emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000102' },
  mobileMoneyNumber: null,
  hasIdDocument: true,
  stats: STATS,
  createdAt: '2026-11-20T09:00:00Z',
  updatedAt: '2026-11-21T09:00:00Z',
});

const ZONES = [
  { communeKey: 'abomey-calavi', name: 'Abomey-Calavi' },
  { communeKey: 'cotonou', name: 'Cotonou' },
  { communeKey: 'porto-novo', name: 'Porto-Novo' },
];

const SKILLS = [
  {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9f01',
    code: 'interior_cleaning',
    name: 'Nettoyage intérieur',
    active: true,
  },
  { id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9f02', code: 'gardening', name: 'Jardinage', active: true },
  { id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9f03', code: 'pool', name: 'Piscine', active: false },
];

const HOUR = 3_600_000;
const iso = (at: number) => new Date(at).toISOString();

/** Planning de l'agent, autour de l'heure du test : une séance passée, la prochaine visite, une à confirmer. */
function assignmentsAround(now: number) {
  return [
    {
      assignmentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da001',
      target: { kind: 'session', id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db001' },
      status: 'confirmed',
      isLead: true,
      start: iso(now - 4 * HOUR),
      end: iso(now - 2 * HOUR),
      targetStatus: 'completed',
      placeTypeName: 'Bureau',
      communeName: 'Cotonou',
      respondBefore: null,
    },
    {
      assignmentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da002',
      target: { kind: 'visit', id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db002' },
      status: 'confirmed',
      isLead: false,
      start: iso(now + HOUR),
      end: iso(now + 2 * HOUR),
      targetStatus: 'scheduled',
      placeTypeName: 'Villa',
      communeName: 'Abomey-Calavi',
      respondBefore: null,
    },
    {
      assignmentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da003',
      target: { kind: 'session', id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db003' },
      status: 'pending_confirmation',
      isLead: true,
      start: iso(now + 26 * HOUR),
      end: iso(now + 29 * HOUR),
      targetStatus: 'assigned',
      placeTypeName: 'Appartement',
      communeName: 'Cotonou',
      respondBefore: iso(now + 9 * HOUR + 20 * 60_000),
    },
  ];
}

const availability = () => ({
  weekly: [
    { weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] },
    {
      weekday: 'wed',
      ranges: [
        { start: '08:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ],
    },
    { weekday: 'sat', ranges: [{ start: '09:00', end: '13:00' }] },
  ],
  extraAvailabilities: [
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc001',
      start: '2026-12-06T08:00:00Z',
      end: '2026-12-06T12:00:00Z',
    },
  ],
  unavailabilities: [
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dd001',
      start: '2026-12-21T23:00:00Z',
      end: '2026-12-26T23:00:00Z',
      kind: 'leave',
      note: 'Fêtes de fin d’année' as string | null,
      forced: false,
      createdBy: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
      createdAt: '2026-11-20T09:00:00Z',
      createdByName: 'Koffi Adjovi',
    },
  ],
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
});

const ACTIVITY = {
  stats: STATS,
  weeks: [
    { periodStart: '2026-11-23', hours: 12.5, sessionsCompleted: 4 },
    { periodStart: '2026-11-16', hours: 18, sessionsCompleted: 6 },
    { periodStart: '2026-11-09', hours: 9, sessionsCompleted: 3 },
    { periodStart: '2026-11-02', hours: 6.5, sessionsCompleted: 1 },
  ],
  months: [
    { periodStart: '2026-11-01', hours: 46, sessionsCompleted: 14 },
    { periodStart: '2026-10-01', hours: 31, sessionsCompleted: 10 },
  ],
};

const notificationsList = () => [
  {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8de001',
    templateCode: 'cleaning.assignment.proposed.agent',
    title: 'Nouvelle affectation à confirmer',
    body: 'Une séance vous est proposée demain à Cotonou.\nRetrouvez les détails dans votre application KSP.',
    link: null,
    createdAt: '2026-11-26T08:00:00Z',
    readAt: null as string | null,
  },
  {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8de002',
    templateCode: 'cleaning.agent.validated',
    title: 'Votre compte agent est actif',
    body: 'Bienvenue chez KSP.',
    link: null,
    createdAt: '2026-11-21T09:00:00Z',
    readAt: '2026-11-21T10:00:00Z' as string | null,
  },
];

export async function mockGateway(page: Page, options: GatewayOptions = {}): Promise<FakeGateway> {
  const state = {
    signedIn: options.signedIn ?? false,
    firstName: options.named || options.signedIn ? 'Koffi' : (null as string | null),
    lastName: options.named || options.signedIn ? 'Adjovi' : (null as string | null),
    grants: options.grants ?? {},
    serial: 0,
    token: '',
    refreshed: false,
    agentStatus: options.agentStatus ?? null,
    assignments: assignmentsAround(Date.now()),
    availability: availability(),
    notifications: (options.partnerNotifications
      ? partnerNotificationsList()
      : notificationsList()) as ReturnType<typeof partnerNotificationsList>,
    preferences: { whatsapp: true, email: true, updatedAt: null as string | null },
    partnerActs: partnerActs(),
    uploads: 0,
  };
  const employmentKind = options.employmentKind ?? 'independent';
  const gateway: FakeGateway = { forbiddenHeaders: [], calls: [], stored: [], field: [], offline: false };
  const visit = visitView(Date.now());
  const fieldSession = sessionView(Date.now(), options.sessionLead ?? true);
  /** Réponses gardées par clé d'idempotence (rejeu : même réponse). */
  const replays = new Map<string, { body: string; response: unknown }>();
  const activeContext = { type: 'individual', organizationId: null, organizationName: null };

  // Préchargements des liens par le routeur de Next : refusés, comme dans le portail (serveur partagé).
  await page.route(
    (url) => url.searchParams.has('_rsc'),
    (route) => (route.request().headers()['next-router-prefetch'] ? route.abort() : route.fallback()),
  );

  // Stockage simulé : `PUT` présigné, sans jeton ni cookie (préflight CORS pour `Content-Type`).
  await page.route(`${STORAGE}/**`, async (route) => {
    if (gateway.offline) return route.abort('internetdisconnected');
    const request = route.request();
    const cors = {
      'Access-Control-Allow-Origin': request.headers().origin ?? '*',
      'Access-Control-Allow-Methods': 'PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    // Lien temporaire de lecture d'une photo : petite image JPEG.
    if (request.method() === 'GET')
      return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'image/jpeg' }, body: JPEG });
    gateway.stored.push(`${request.method()} ${new URL(request.url()).pathname}`);
    return route.fulfill({ status: 200, headers: cors, body: '' });
  });

  const user = () => ({
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
    status: 'active',
    firstName: state.firstName,
    lastName: state.lastName,
    phone: '+2290197000101',
    email: null,
    emailVerified: false,
    preferredLanguage: 'fr',
    createdAt: '2026-10-21T09:00:00Z',
  });

  const session = () => {
    state.serial += 1;
    state.token = accessToken(state.grants, state.serial);
    return {
      status: 'authenticated',
      accessToken: state.token,
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      sessionId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e10',
      user: user(),
      profileIncomplete: !state.firstName || !state.lastName,
      activeContext,
    };
  };

  const storedFile = (id: string, status: string, completedAt: string | null) => ({
    id,
    purpose: 'cleaning_intervention_photo',
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    status,
    rejectionReason: null,
    subject: null,
    createdAt: '2026-11-26T09:00:00Z',
    completedAt,
  });

  const unreadCount = () => state.notifications.filter((item) => item.readAt === null).length;

  await page.route(`${GATEWAY}/api/v1/**`, async (route: Route) => {
    if (gateway.offline) return route.abort('internetdisconnected');
    const request = route.request();
    const origin = request.headers().origin ?? 'http://localhost:3050';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'X-Correlation-Id, Retry-After',
      'X-Correlation-Id': '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e13',
    };
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
          'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        },
      });
    }

    const url = new URL(request.url());
    const path = url.pathname;
    const body = request.postData()
      ? (JSON.parse(request.postData() ?? '{}') as Record<string, unknown>)
      : undefined;
    gateway.calls.push({ method: request.method(), path, body, headers: request.headers() });
    gateway.forbiddenHeaders.push(
      ...Object.keys(request.headers()).filter(
        (name) => name.startsWith('x-') && !ALLOWED_X_HEADERS.has(name),
      ),
    );
    const reply = (status: number, json: unknown) => route.fulfill({ status, headers: cors, json });
    const authorized = state.signedIn && request.headers().authorization === `Bearer ${state.token}`;
    const unauthorized = () => reply(401, error('GATEWAY_TOKEN_INVALID', 'Vous devez être connecté.'));
    const route_ = `${request.method()} ${path}`;

    // Routes de terrain (visite, séance) : agent connecté, clé d'idempotence rejouable.
    const field = fieldRoute(route_);
    if (field) {
      if (!authorized) return unauthorized();
      const key = request.headers()['idempotency-key'] ?? '';
      if (field.action) {
        gateway.field.push({ method: request.method(), path, key, body });
        const serialized = JSON.stringify(body ?? {});
        const replay = replays.get(key);
        if (replay)
          return replay.body === serialized
            ? reply(200, replay.response)
            : reply(
                409,
                error('CLEANING_IDEMPOTENCY_KEY_REUSED', 'Cette clé a déjà servi pour une autre opération.'),
              );
        const outcome = applyField(
          field,
          (body ?? {}) as Record<string, unknown>,
          visit,
          fieldSession,
          options,
        );
        if ('error' in outcome) return reply(outcome.status, outcome.error);
        replays.set(key, { body: serialized, response: outcome.view });
        return reply(200, outcome.view);
      }
      return reply(200, field.kind === 'visit' ? visitResponse(visit) : sessionResponse(fieldSession));
    }

    // Espace partenaire du Recouvrement : seulement ses assignations (404 sinon), clé d'idempotence rejouable.
    const partner =
      /^(GET|POST) \/api\/v1\/recovery\/partner\/assignments(?:\/([^/]+)(?:\/(acts|collections))?)?$/.exec(
        route_,
      );
    if (partner) {
      if (!authorized) return unauthorized();
      if (options.partnerForbidden)
        return reply(
          403,
          error('AUTH_FORBIDDEN', "Vous n'avez pas les droits nécessaires pour cette action."),
        );
      const [, method, id, action] = partner;
      if (!id) {
        const status = url.searchParams.get('status') ?? 'active';
        const all = PARTNER_ASSIGNMENTS.filter((item) => item.status === status).map((item) => ({
          ...item,
          acts: item.id === PARTNER_ASSIGNMENT_ID ? state.partnerActs : item.acts,
        }));
        // Deux pages pour les dossiers en cours (curseur), une seule ailleurs.
        const cursor = url.searchParams.get('cursor');
        const page = status === 'active' ? (cursor ? all.slice(1) : all.slice(0, 1)) : all;
        const nextCursor = status === 'active' && !cursor && all.length > 1 ? 'page-2' : null;
        return reply(200, { assignments: page, nextCursor });
      }
      const assignment = PARTNER_ASSIGNMENTS.find((item) => item.id === id && item.status === 'active');
      if (!assignment)
        return reply(404, error('RECOVERY_ASSIGNMENT_NOT_FOUND', 'Cette assignation est introuvable.'));
      if (method === 'GET' && !action) return reply(200, assignmentFile(assignment, state.partnerActs));
      if (method !== 'POST' || !action)
        return reply(404, error('GATEWAY_ROUTE_NOT_FOUND', "Cette adresse n'existe pas."));
      const key = request.headers()['idempotency-key'] ?? '';
      gateway.field.push({ method: request.method(), path, key, body });
      const serialized = JSON.stringify(body ?? {});
      const replay = replays.get(key);
      if (replay)
        return replay.body === serialized
          ? reply(200, replay.response)
          : reply(
              409,
              error('RECOVERY_IDEMPOTENCY_KEY_REUSED', 'Cette clé a déjà servi pour une autre opération.'),
            );
      const today = new Date().toISOString().slice(0, 10);
      if (action === 'acts') {
        if (String(body?.actDate) > today)
          return reply(
            400,
            error('RECOVERY_VALIDATION_FAILED', 'Date de l’acte au plus aujourd’hui.', { field: 'actDate' }),
          );
        const act = {
          id: `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e2${String(state.partnerActs.length + 1).padStart(3, '0')}`,
          type: String(body?.type),
          actDate: String(body?.actDate),
          cost: (body?.cost as { amount: number; currency: string } | undefined) ?? xof(0),
          fileId: typeof body?.fileId === 'string' ? body.fileId : null,
          note: typeof body?.note === 'string' ? body.note : null,
          recordedAt: new Date().toISOString(),
          nextStepDate: typeof body?.nextStepDate === 'string' ? body.nextStepDate : null,
        };
        state.partnerActs = [...state.partnerActs, act];
        replays.set(key, { body: serialized, response: act });
        return reply(200, act);
      }
      if (options.caseSuspended)
        return reply(
          422,
          error(
            'RECOVERY_CASE_SUSPENDED',
            'Ce dossier est suspendu par une contestation : cette action attend la décision du juriste.',
          ),
        );
      const amount = Number((body?.amount as { amount?: number } | undefined)?.amount ?? 0);
      if (amount < 1 || amount > DUE)
        return reply(
          422,
          error(
            'RECOVERY_PAYMENT_AMOUNT_INVALID',
            'Le montant doit être compris entre 1 FCFA et le montant dû (325 000 FCFA).',
            { due: { amount: DUE, currency: 'XOF' } },
          ),
        );
      const payment = {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e3001',
        caseId: assignment.caseId,
        caseNumber: assignment.caseNumber,
        source: 'partner',
        amount: { amount, currency: 'XOF' },
        receivedOn: String(body?.receivedOn),
        reference: null,
        proofFileId: typeof body?.proofFileId === 'string' ? body.proofFileId : null,
        status: 'pending_approval',
        recordedBy: {
          type: 'partner',
          userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
          displayName: 'Me Koffi Adjovi',
        },
        approvedBy: null,
        rejectionReason: null,
        collectionId: null,
        createdAt: new Date().toISOString(),
        partnerAssignmentId: assignment.id,
      };
      replays.set(key, { body: serialized, response: payment });
      return reply(200, payment);
    }

    // Routes à paramètre.
    const respond = /^POST \/api\/v1\/cleaning\/agent\/assignments\/([^/]+)\/(accept|decline)$/.exec(route_);
    if (respond) {
      if (!authorized) return unauthorized();
      const assignment = state.assignments.find((item) => item.assignmentId === respond[1]);
      if (!assignment) return reply(404, error('CLEANING_ASSIGNMENT_NOT_FOUND', 'Affectation introuvable.'));
      if (assignment.status !== 'pending_confirmation')
        return reply(
          422,
          error('CLEANING_INVALID_TRANSITION', 'Cette affectation n’attend plus de réponse.'),
        );
      assignment.status = respond[2] === 'accept' ? 'confirmed' : 'declined';
      return reply(200, assignment);
    }
    const complete = /^POST \/api\/v1\/file\/files\/([^/]+)\/complete$/.exec(route_);
    if (complete) {
      if (!authorized) return unauthorized();
      return reply(200, storedFile(complete[1] ?? '', 'available', '2026-11-26T09:00:05Z'));
    }
    const removal = /^DELETE \/api\/v1\/cleaning\/agent\/me\/unavailabilities\/([^/]+)$/.exec(route_);
    if (removal) {
      if (!authorized) return unauthorized();
      state.availability.unavailabilities = state.availability.unavailabilities.filter(
        (item) => item.id !== removal[1],
      );
      return reply(200, state.availability);
    }
    const read = /^POST \/api\/v1\/notification\/notifications\/([^/]+)\/read$/.exec(route_);
    if (read) {
      if (!authorized) return unauthorized();
      const notification = state.notifications.find((item) => item.id === read[1]);
      if (!notification) return reply(404, error('NOTIFICATION_NOT_FOUND', 'Notification introuvable.'));
      notification.readAt ??= '2026-11-26T10:00:00Z';
      return reply(200, { notification, unreadCount: unreadCount() });
    }

    switch (route_) {
      case 'POST /api/v1/identity/otp/request':
        return reply(200, {
          challengeId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e0f',
          maskedTarget: '+229********01',
          channel: body?.channel === 'whatsapp' ? 'whatsapp' : 'sms',
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        });
      case 'POST /api/v1/identity/otp/verify':
        if (body?.code !== VALID_CODE)
          return reply(
            400,
            error('IDENTITY_OTP_INVALID', 'Le code est incorrect.', { attemptsRemaining: 4 }),
          );
        state.signedIn = true;
        return reply(200, { ...session(), isNewUser: !state.firstName });
      case 'POST /api/v1/identity/token/refresh':
        if (!state.signedIn)
          return reply(
            401,
            error('IDENTITY_REFRESH_TOKEN_INVALID', 'Votre session a expiré, reconnectez-vous.'),
          );
        if (state.refreshed && options.grantsAfterRefresh) state.grants = options.grantsAfterRefresh;
        state.refreshed = true;
        return reply(200, session());
      case 'PATCH /api/v1/identity/me':
        if (!authorized) return unauthorized();
        state.firstName = String(body?.firstName ?? state.firstName);
        state.lastName = String(body?.lastName ?? state.lastName);
        return reply(200, { user: user(), profileIncomplete: false, activeContext, pendingEmail: null });
      case 'POST /api/v1/identity/logout':
        if (!authorized) return unauthorized();
        state.signedIn = false;
        return reply(200, { revokedSessions: 1 });
      case 'GET /api/v1/cleaning/agent/me':
        if (!authorized) return unauthorized();
        if (!state.agentStatus)
          return reply(404, error('CLEANING_AGENT_NOT_FOUND', 'Aucun profil d’agent pour ce compte.'));
        return reply(200, agentProfile(state.agentStatus, employmentKind));
      case 'GET /api/v1/cleaning/catalog/zones':
        return reply(200, { data: ZONES });
      case 'GET /api/v1/admin/cleaning/skills':
        if (!authorized) return unauthorized();
        if (!options.skillsReadable)
          return reply(403, error('GATEWAY_FORBIDDEN', 'Vous n’avez pas accès à cette action.'));
        return reply(200, { data: SKILLS, nextCursor: null, total: SKILLS.length });
      case 'POST /api/v1/file/uploads': {
        if (!authorized) return unauthorized();
        state.uploads += 1;
        const id = `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8df${String(state.uploads).padStart(3, '0')}`;
        return reply(200, {
          file: storedFile(id, 'pending', null),
          upload: {
            url: `${STORAGE}/${id}`,
            method: 'PUT',
            headers: { 'Content-Type': String(body?.contentType ?? 'image/jpeg') },
            expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          },
        });
      }
      case 'POST /api/v1/cleaning/agent/applications':
        if (!authorized) return unauthorized();
        if (state.agentStatus)
          return reply(
            409,
            error('CLEANING_AGENT_ALREADY_REGISTERED', 'Ce compte a déjà un profil d’agent.'),
          );
        state.agentStatus = 'applicant';
        return reply(200, agentProfile('applicant', String(body?.employmentKind ?? employmentKind)));
      case 'GET /api/v1/cleaning/agent/me/assignments': {
        if (!authorized) return unauthorized();
        const status = url.searchParams.get('status');
        // Période : début inclus, fin exclue (défaut de la gateway : aujourd'hui, 7 jours).
        const from = Date.parse(url.searchParams.get('from') ?? '') || -Infinity;
        const to = Date.parse(url.searchParams.get('to') ?? '') || Infinity;
        const data = state.assignments.filter(
          (item) =>
            (!status || item.status === status) &&
            Date.parse(item.start) >= from &&
            Date.parse(item.start) < to,
        );
        return reply(200, { data, nextCursor: null, total: data.length });
      }
      case 'GET /api/v1/cleaning/agent/me/availability':
        if (!authorized) return unauthorized();
        return reply(200, state.availability);
      case 'PUT /api/v1/cleaning/agent/me/availability':
        if (!authorized) return unauthorized();
        if (options.availabilityInUse)
          return reply(
            409,
            error('CLEANING_AVAILABILITY_IN_USE', 'Cette plage est déjà occupée par une affectation.', {
              assignments: ['0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da002'],
            }),
          );
        state.availability = {
          ...state.availability,
          weekly: (body?.weekly ?? []) as typeof state.availability.weekly,
          extraAvailabilities: (
            (body?.extraAvailabilities ?? []) as Array<{ start: string; end: string }>
          ).map((slot, index) => ({
            id: `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc${String(index).padStart(3, '0')}`,
            ...slot,
          })),
        };
        return reply(200, state.availability);
      case 'POST /api/v1/cleaning/agent/me/unavailabilities':
        if (!authorized) return unauthorized();
        if (options.unavailabilityConflict)
          return reply(
            409,
            error('CLEANING_UNAVAILABILITY_CONFLICT', 'L’indisponibilité chevauche des affectations.', {
              assignments: ['0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da002', '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da003'],
            }),
          );
        state.availability.unavailabilities = [
          ...state.availability.unavailabilities,
          {
            id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dd002',
            start: String(body?.start),
            end: String(body?.end),
            kind: String(body?.kind),
            note: typeof body?.note === 'string' ? body.note : null,
            forced: false,
            createdBy: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
            createdAt: '2026-11-26T09:00:00Z',
            createdByName: 'Koffi Adjovi',
          },
        ];
        return reply(200, state.availability);
      case 'GET /api/v1/cleaning/agent/me/activity':
        if (!authorized) return unauthorized();
        return reply(200, ACTIVITY);
      case 'GET /api/v1/notification/notifications': {
        if (!authorized) return unauthorized();
        const unreadOnly = url.searchParams.get('unread') === 'true';
        const data = state.notifications.filter((item) => !unreadOnly || item.readAt === null);
        return reply(200, { data, nextCursor: null, unreadCount: unreadCount() });
      }
      case 'GET /api/v1/notification/notifications/unread-count':
        if (!authorized) return unauthorized();
        return reply(200, { unreadCount: unreadCount() });
      case 'GET /api/v1/notification/preferences':
        if (!authorized) return unauthorized();
        return reply(200, state.preferences);
      case 'PUT /api/v1/notification/preferences':
        if (!authorized) return unauthorized();
        state.preferences = {
          whatsapp: body?.whatsapp === true,
          email: body?.email === true,
          updatedAt: '2026-11-26T10:00:00Z',
        };
        return reply(200, state.preferences);
      case 'POST /api/v1/notification/notifications/read-all': {
        if (!authorized) return unauthorized();
        const marked = unreadCount();
        state.notifications.forEach((item) => {
          item.readAt ??= '2026-11-26T10:00:00Z';
        });
        return reply(200, { marked, unreadCount: 0 });
      }
      default:
        return reply(404, error('GATEWAY_ROUTE_NOT_FOUND', "Cette adresse n'existe pas."));
    }
  });

  return gateway;
}

/* ——— Terrain : visite des lieux et séance ——— */

export const VISIT_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db002';
export const SESSION_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db001';

/** Petite image JPEG valide (1 × 1 pixel). */
export const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

const LOCATION = {
  latitude: 6.4485,
  longitude: 2.3557,
  landmark: 'Portail bleu après la pharmacie',
  address: 'Rue 12, Tankpè',
  readableAddress: null,
  accuracyMeters: 15,
};

const place = () => ({
  name: 'Villa Les Palmiers',
  placeTypeName: 'Villa',
  communeName: 'Abomey-Calavi',
  location: null as typeof LOCATION | null,
  customerFirstName: 'Afi',
});

interface Photo {
  fileId: string;
  kind: string;
  takenAt: string;
  url: string | null;
  urlExpiresAt: string | null;
}

function visitView(now: number) {
  return {
    id: VISIT_ID,
    requestNumber: 'NET-2026-00042',
    status: 'scheduled',
    scheduledAt: iso(now - 5 * 60_000),
    durationMinutes: 60,
    isLead: true,
    place: place(),
    cleaningTypes: [{ id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc101', code: 'sol', name: 'Sols' }],
    parameters: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc201',
        code: 'superficie',
        label: 'Superficie',
        kind: 'number',
        unit: 'm²',
        min: 10,
        max: 2000,
        choices: [],
        required: true,
        help: null,
        active: true,
      },
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc202',
        code: 'etat',
        label: 'État général',
        kind: 'choice',
        unit: null,
        min: null,
        max: null,
        choices: [
          { code: 'propre', label: 'Propre', active: true },
          { code: 'sale', label: 'Sale', active: true },
          { code: 'tres_sale', label: 'Très sale', active: false },
        ],
        required: true,
        help: 'Votre impression en entrant.',
        active: true,
      },
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc203',
        code: 'animaux',
        label: 'Animaux présents',
        kind: 'boolean',
        unit: null,
        min: null,
        max: null,
        choices: [],
        required: false,
        help: null,
        active: true,
      },
    ],
    declaredValues: { superficie: 120, etat: 'tres_sale', animaux: false } as Record<string, unknown>,
    observedValues: null as Record<string, unknown> | null,
    photos: [] as Photo[],
    arrival: null as Record<string, unknown> | null,
    completedAt: null as string | null,
    note: null as string | null,
  };
}

function sessionView(now: number, isLead: boolean) {
  return {
    id: SESSION_ID,
    programNumber: 'PRG-2026-0007',
    rank: 3,
    status: 'assigned',
    scheduledStart: iso(now - 10 * 60_000),
    scheduledEnd: iso(now + 170 * 60_000),
    isLead,
    team: [
      {
        agentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
        firstName: 'Koffi',
        lastName: 'Adjovi',
        photoUrl: null,
        isLead,
        confirmation: 'confirmed',
      },
      {
        agentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e31',
        firstName: 'Rachidi',
        lastName: 'Sanni',
        photoUrl: null,
        isLead: !isLead,
        confirmation: 'confirmed',
      },
    ],
    place: place(),
    checklist: [
      {
        code: 'arrival',
        label: 'Matériel déballé',
        cleaningTypeCode: null as string | null,
        checked: false,
        checkedAt: null as string | null,
      },
      {
        code: 'sol_balayage',
        label: 'Sols balayés',
        cleaningTypeCode: 'sol' as string | null,
        checked: false,
        checkedAt: null as string | null,
      },
    ],
    photos: [] as Photo[],
    incidents: [] as Array<Record<string, unknown>>,
    arrival: null as Record<string, unknown> | null,
    startedAt: null as string | null,
    completedAt: null as string | null,
  };
}

type Visit = ReturnType<typeof visitView>;
type FieldSession = ReturnType<typeof sessionView>;

/** Position et adresses visibles seulement pendant l'intervention en cours (R-EX-06, B6). */
const visitResponse = (visit: Visit) => ({
  ...visit,
  place: { ...visit.place, location: visit.status === 'in_progress' ? LOCATION : null },
});
const sessionResponse = (session: FieldSession) => ({
  ...session,
  place: { ...session.place, location: session.status === 'in_progress' ? LOCATION : null },
});

interface FieldRoute {
  kind: 'visit' | 'session';
  action: string | null;
  fileId?: string;
}

function fieldRoute(route: string): FieldRoute | null {
  if (route === `GET /api/v1/cleaning/agent/visits/${VISIT_ID}`) return { kind: 'visit', action: null };
  if (route === `GET /api/v1/cleaning/agent/sessions/${SESSION_ID}`) return { kind: 'session', action: null };
  const match =
    /^(POST|PUT|PATCH|DELETE) \/api\/v1\/cleaning\/(visits|sessions)\/([^/]+)\/([a-z]+)(?:\/([^/]+))?$/.exec(
      route,
    );
  if (!match) return null;
  const kind = match[2] === 'visits' ? 'visit' : 'session';
  if (match[3] !== (kind === 'visit' ? VISIT_ID : SESSION_ID)) return null;
  return { kind, action: `${match[1]} ${match[4]}`, fileId: match[5] };
}

const photoOf = (fileId: string, kind: string, takenAt: string): Photo => ({
  fileId,
  kind,
  takenAt,
  url: `${STORAGE}/${fileId}`,
  urlExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
});

function applyField(
  field: FieldRoute,
  body: Record<string, unknown>,
  visit: Visit,
  session: FieldSession,
  options: GatewayOptions,
): { view: unknown } | { status: number; error: unknown } {
  const at = typeof body.occurredAt === 'string' ? body.occurredAt : new Date().toISOString();
  const arrival = {
    arrivedAt: at,
    distanceMeters: typeof body.latitude === 'number' ? 42 : null,
    alert: false,
    placeAccuracyMeters: 15,
    arrivalAccuracyMeters: typeof body.accuracyMeters === 'number' ? body.accuracyMeters : null,
    uncertain: false,
  };
  const invalid = () => ({
    status: 422,
    error: error('CLEANING_INVALID_TRANSITION', 'Cette action n’est pas possible dans l’état actuel.'),
  });
  if (field.kind === 'visit') {
    switch (field.action) {
      case 'POST arrive':
        if (visit.status !== 'scheduled') return invalid();
        Object.assign(visit, { status: 'in_progress', arrival });
        break;
      case 'PUT observations':
        Object.assign(visit, { observedValues: body.values, note: body.note ?? null });
        break;
      case 'POST photos':
        visit.photos.push(photoOf(String(body.fileId), 'visit', at));
        break;
      case 'DELETE photos':
        visit.photos = visit.photos.filter((photo) => photo.fileId !== field.fileId);
        break;
      case 'POST complete':
        Object.assign(visit, { status: 'completed', completedAt: at });
        break;
      case 'POST missed':
        Object.assign(visit, { status: 'missed' });
        break;
      default:
        return invalid();
    }
    return { view: visitResponse(visit) };
  }
  switch (field.action) {
    case 'POST arrive':
      session.arrival = arrival;
      break;
    case 'POST photos':
      session.photos.push(photoOf(String(body.fileId), String(body.kind), at));
      break;
    case 'DELETE photos':
      session.photos = session.photos.filter((photo) => photo.fileId !== field.fileId);
      break;
    case 'POST start':
      if (options.startRefused)
        return { status: 422, error: error(options.startRefused, 'Démarrage refusé.') };
      if (!session.photos.some((photo) => photo.kind === 'before'))
        return {
          status: 422,
          error: error('CLEANING_PHOTOS_MISSING', 'Photo « avant » manquante.', { kind: 'before' }),
        };
      Object.assign(session, { status: 'in_progress', startedAt: at });
      break;
    case 'PATCH checklist':
      for (const tick of body.items as Array<{ code: string; checked: boolean }>) {
        const item = session.checklist.find((point) => point.code === tick.code);
        if (item) Object.assign(item, { checked: tick.checked, checkedAt: tick.checked ? at : null });
      }
      break;
    case 'POST incident':
      session.incidents.push({
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dc301',
        category: body.category,
        note: body.note,
        photos: [],
        reportedAt: at,
        decision: 'pending',
        decidedAt: null,
      });
      session.status = 'interrupted';
      break;
    case 'POST complete':
      if (session.checklist.some((item) => !item.checked))
        return { status: 422, error: error('CLEANING_CHECKLIST_INCOMPLETE', 'Liste incomplète.') };
      Object.assign(session, { status: 'completed', completedAt: at });
      break;
    case 'POST missed':
      session.status = 'missed';
      break;
    default:
      return invalid();
  }
  return { view: sessionResponse(session) };
}

/* ——— Espace partenaire du Recouvrement ——— */

export const PARTNER_GRANTS = { roles: ['customer', 'recovery_bailiff'] };
/** Dossier en cours, ouvert dans les parcours. */
export const PARTNER_ASSIGNMENT_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1001';
export const WITHDRAWN_ASSIGNMENT_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1002';
/** Reste dû du dossier en cours. */
const DUE = 325_000;
const xof = (amount: number) => ({ amount, currency: 'XOF' });
const PARTNER = {
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e0001',
  kind: 'bailiff',
  name: 'Me Koffi Adjovi',
  office: 'Étude Adjovi, Cotonou',
};

function partnerActs() {
  return [
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e2001',
      type: 'summons_to_pay',
      actDate: '2026-11-10',
      cost: xof(35_000),
      fileId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e5001' as string | null,
      note: 'Sommation remise au débiteur à son domicile.' as string | null,
      recordedAt: '2026-11-10T15:00:00Z',
      nextStepDate: '2026-11-24' as string | null,
    },
    {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e2002',
      type: 'service',
      actDate: '2026-11-18',
      cost: xof(0),
      fileId: null as string | null,
      note: null as string | null,
      recordedAt: '2026-11-18T10:30:00Z',
      nextStepDate: null as string | null,
    },
  ];
}

const assignmentOf = (
  id: string,
  caseNumber: string,
  status: string,
  assignedAt: string,
  extra: Partial<{ withdrawnAt: string; withdrawalReason: string; lastUpdateAt: string }> = {},
) => ({
  id,
  caseId: id.replace('8e1', '8e4'),
  caseNumber,
  partner: PARTNER,
  status,
  assignedAt,
  withdrawnAt: extra.withdrawnAt ?? null,
  withdrawalReason: extra.withdrawalReason ?? null,
  acts: [] as ReturnType<typeof partnerActs>,
  lastUpdateAt: extra.lastUpdateAt ?? null,
});

const PARTNER_ASSIGNMENTS = [
  assignmentOf(PARTNER_ASSIGNMENT_ID, 'REC-2026-00012', 'active', '2026-11-03T09:00:00Z', {
    lastUpdateAt: '2026-11-18T10:30:00Z',
  }),
  assignmentOf('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1004', 'REC-2026-00015', 'active', '2026-11-20T09:00:00Z'),
  assignmentOf(WITHDRAWN_ASSIGNMENT_ID, 'REC-2026-00007', 'withdrawn', '2026-10-02T09:00:00Z', {
    withdrawnAt: '2026-11-05T11:00:00Z',
    withdrawalReason: 'Dossier confié à un avocat pour la procédure judiciaire.',
  }),
  assignmentOf(
    '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1003',
    'REC-2026-00003',
    'completed',
    '2026-09-01T09:00:00Z',
    {
      lastUpdateAt: '2026-10-28T16:00:00Z',
    },
  ),
];

const actor = (type: string, displayName: string | null) => ({ type, userId: null, displayName });

function assignmentFile(
  assignment: (typeof PARTNER_ASSIGNMENTS)[number],
  acts: ReturnType<typeof partnerActs>,
) {
  return {
    assignment: { ...assignment, acts },
    debtors: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e6002',
        kind: 'company',
        role: 'guarantor',
        displayName: 'SARL Bâtir Plus',
        firstNames: null,
        lastName: null,
        legalName: 'SARL Bâtir Plus',
        ifu: '3201912345678',
        rccm: 'RB/COT/19 B 24567',
        representativeName: 'Aïcha Bello',
        phones: [],
        emails: ['contact@batirplus.bj'],
        address: 'Lot 214, Akpakpa',
        communeKey: 'cotonou',
      },
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
        phones: ['+2290197001122', '+2290166003344'],
        emails: ['kossi.mensah@exemple.bj'],
        address: 'Rue 1024, Fidjrossè, maison à portail vert',
        communeKey: 'cotonou',
      },
    ],
    claims: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e7001',
        reference: 'FAC-2026-0142',
        amount: xof(250_000),
        dueDate: '2026-06-30',
        description: 'Fourniture de matériaux de construction',
      },
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e7002',
        reference: 'FAC-2026-0187',
        amount: xof(100_000),
        dueDate: '2026-07-31',
        description: null,
      },
    ],
    amounts: {
      principal: xof(350_000),
      interests: xof(15_000),
      costs: xof(35_000),
      paid: xof(75_000),
      waived: xof(0),
      due: xof(DUE),
      overpaid: xof(0),
    },
    documents: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8001',
        kind: 'mandate',
        fileId: null,
        documentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8101',
        label: 'Mandat de recouvrement signé',
        addedBy: actor('creditor', 'Quincaillerie du Port'),
        addedAt: '2026-09-15T10:00:00Z',
        visibleToDebtor: false,
      },
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8002',
        kind: 'evidence',
        fileId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8201',
        documentId: null,
        label: 'Facture FAC-2026-0142',
        addedBy: actor('creditor', 'Quincaillerie du Port'),
        addedAt: '2026-09-15T10:05:00Z',
        visibleToDebtor: true,
      },
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8003',
        kind: 'formal_notice',
        fileId: null,
        documentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8103',
        label: 'Mise en demeure du 2 octobre 2026',
        addedBy: actor('staff', null),
        addedAt: '2026-10-02T09:00:00Z',
        visibleToDebtor: true,
      },
    ],
    signedPlan: {
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e9001',
      status: 'defaulted',
      terms: {
        firstAmount: xof(50_000),
        firstDueDate: '2026-08-15',
        rhythm: 'monthly',
        installmentsCount: 3,
      },
      total: xof(350_000),
      installments: [
        {
          id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e9101',
          rank: 1,
          dueDate: '2026-08-15',
          amount: xof(50_000),
          paidAmount: xof(50_000),
          status: 'paid',
          paidAt: '2026-08-14T12:00:00Z',
        },
        {
          id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e9102',
          rank: 2,
          dueDate: '2026-09-15',
          amount: xof(100_000),
          paidAmount: xof(25_000),
          status: 'partial',
          paidAt: null,
        },
        {
          id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e9103',
          rank: 3,
          dueDate: '2026-10-15',
          amount: xof(100_000),
          paidAmount: xof(0),
          status: 'missed',
          paidAt: null,
        },
        {
          id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e9104',
          rank: 4,
          dueDate: '2026-11-15',
          amount: xof(100_000),
          paidAmount: xof(0),
          status: 'missed',
          paidAt: null,
        },
      ],
      withinScale: true,
      violations: [],
      proposedBy: 'debtor',
      renegotiation: false,
      documentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8104',
      signedAt: '2026-08-01T10:00:00Z',
      missedCount: 2,
      createdAt: '2026-07-28T10:00:00Z',
    },
    notices: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8ea001',
        documentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8103',
        status: 'delivered',
        signedBy: actor('staff', 'Juriste KSP'),
        issuedAt: '2026-10-02T09:00:00Z',
        deliveryMethod: 'registered_mail',
        deliveredAt: '2026-10-06T14:00:00Z',
        proofFileId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e8202',
        deadlineAt: '2026-10-21T23:59:00Z',
      },
    ],
    creditor: {
      type: 'organization',
      id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8eb001',
      displayName: 'Quincaillerie du Port',
    },
  };
}

const partnerNotificationsList = () => [
  {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8de101',
    templateCode: 'recovery.partner_assigned.partner',
    title: 'Nouveau dossier confié',
    body: 'KSP vous confie le dossier REC-2026-00012.',
    link: `https://pro.ksp.bj/partenaire/dossiers/${PARTNER_ASSIGNMENT_ID}`,
    createdAt: '2026-11-03T09:05:00Z',
    readAt: null as string | null,
  },
  {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8de102',
    templateCode: 'recovery.partner_withdrawn.partner',
    title: 'Dossier retiré',
    body: 'Le dossier REC-2026-00007 ne vous est plus confié.',
    link: null,
    createdAt: '2026-11-05T11:05:00Z',
    readAt: '2026-11-05T12:00:00Z' as string | null,
  },
];
