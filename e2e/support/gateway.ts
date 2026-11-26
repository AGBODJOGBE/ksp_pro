import type { Page, Route } from '@playwright/test';

/**
 * Gateway simulée par interception des requêtes du navigateur (recopiée du portail) : routes
 * `/api/v1/identity/*`, `/api/v1/cleaning/agent/*`, `/api/v1/cleaning/catalog/zones`, envoi de fichiers
 * (`/api/v1/file/*`, avec un stockage simulé sur l'origine de la gateway, autorisée par la CSP) et
 * notifications, au format du contrat `ksp-api.v1.yaml`. En-têtes CORS avec cookies comme la vraie
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
  /** `POST /me/unavailabilities` refusé : chevauche des affectations (409). */
  unavailabilityConflict?: boolean;
}

export interface FakeGateway {
  forbiddenHeaders: string[];
  calls: Array<{ method: string; path: string; body: unknown; headers: Record<string, string> }>;
  /** Contenus reçus par le stockage simulé. */
  stored: string[];
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
    notifications: notificationsList(),
    uploads: 0,
  };
  const employmentKind = options.employmentKind ?? 'independent';
  const gateway: FakeGateway = { forbiddenHeaders: [], calls: [], stored: [] };
  const activeContext = { type: 'individual', organizationId: null, organizationName: null };

  // Préchargements des liens par le routeur de Next : refusés, comme dans le portail (serveur partagé).
  await page.route(
    (url) => url.searchParams.has('_rsc'),
    (route) => (route.request().headers()['next-router-prefetch'] ? route.abort() : route.fallback()),
  );

  // Stockage simulé : `PUT` présigné, sans jeton ni cookie (préflight CORS pour `Content-Type`).
  await page.route(`${STORAGE}/**`, async (route) => {
    const request = route.request();
    const cors = {
      'Access-Control-Allow-Origin': request.headers().origin ?? '*',
      'Access-Control-Allow-Methods': 'PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
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
