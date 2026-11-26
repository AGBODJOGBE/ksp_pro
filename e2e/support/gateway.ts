import type { Page, Route } from '@playwright/test';

/**
 * Gateway simulée par interception des requêtes du navigateur (recopiée du portail) : routes
 * `/api/v1/identity/*` et `GET /api/v1/cleaning/agent/me` du contrat `ksp-api.v1.yaml`, en-têtes CORS
 * avec cookies comme la vraie gateway, et état de session côté « serveur » (le cookie de renouvellement
 * n'est pas reproduit : la session vit dans ce simulateur). Le jeton d'accès a la forme d'un JWT et
 * porte `roles` et `perms`, comme ceux d'identity (non signé : le front ne vérifie pas la signature).
 */

const GATEWAY = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005';

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
}

export interface FakeGateway {
  forbiddenHeaders: string[];
  calls: Array<{ method: string; path: string; body: unknown }>;
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

const agentProfile = (status: string) => ({
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
  status,
  firstName: 'Koffi',
  lastName: 'Adjovi',
  phone: '+2290197000101',
  photoUrl: null,
  employmentKind: 'independent',
  residenceCommuneKey: 'cotonou',
  zoneKeys: ['cotonou'],
  skills: [],
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
  emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000102' },
  mobileMoneyNumber: null,
  hasIdDocument: true,
  stats: {
    sessionsCompleted: 0,
    visitsCompleted: 0,
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    ratingAverage: null,
    ratingsCount: 0,
    openClaims: 0,
  },
  createdAt: '2026-11-20T09:00:00Z',
  updatedAt: '2026-11-21T09:00:00Z',
});

export async function mockGateway(page: Page, options: GatewayOptions = {}): Promise<FakeGateway> {
  const state = {
    signedIn: options.signedIn ?? false,
    firstName: options.named || options.signedIn ? 'Koffi' : (null as string | null),
    lastName: options.named || options.signedIn ? 'Adjovi' : (null as string | null),
    grants: options.grants ?? {},
    serial: 0,
    token: '',
    refreshed: false,
  };
  const gateway: FakeGateway = { forbiddenHeaders: [], calls: [] };
  const activeContext = { type: 'individual', organizationId: null, organizationName: null };

  // Préchargements des liens par le routeur de Next : refusés, comme dans le portail (serveur partagé).
  await page.route(
    (url) => url.searchParams.has('_rsc'),
    (route) => (route.request().headers()['next-router-prefetch'] ? route.abort() : route.fallback()),
  );

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

    const path = new URL(request.url()).pathname;
    const body = request.postData()
      ? (JSON.parse(request.postData() ?? '{}') as Record<string, unknown>)
      : undefined;
    gateway.calls.push({ method: request.method(), path, body });
    gateway.forbiddenHeaders.push(
      ...Object.keys(request.headers()).filter(
        (name) => name.startsWith('x-') && !ALLOWED_X_HEADERS.has(name),
      ),
    );
    const reply = (status: number, json: unknown) => route.fulfill({ status, headers: cors, json });
    const authorized = state.signedIn && request.headers().authorization === `Bearer ${state.token}`;
    const unauthorized = () => reply(401, error('GATEWAY_TOKEN_INVALID', 'Vous devez être connecté.'));

    switch (`${request.method()} ${path}`) {
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
        if (!options.agentStatus)
          return reply(404, error('CLEANING_AGENT_NOT_FOUND', 'Aucun profil d’agent pour ce compte.'));
        return reply(200, agentProfile(options.agentStatus));
      default:
        return reply(404, error('GATEWAY_ROUTE_NOT_FOUND', "Cette adresse n'existe pas."));
    }
  });

  return gateway;
}
