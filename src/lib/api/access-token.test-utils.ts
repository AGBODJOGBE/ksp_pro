/**
 * Jetons d'accès factices pour les tests : non signés, au format du contrat `access-token.v1.schema.json`
 * (session web : rôle `customer`, droits de terrain dans `perms`).
 */

const base64url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Jeton d'accès factice portant les rôles et, si fournies, les permissions (claim `perms`). */
export function accessToken(roles: string[] = ['customer'], perms?: string[]): string {
  const claims = {
    sub: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
    client_id: 'web',
    ctx: 'personal',
    roles: roles.map((role) => ({ role, scopeType: 'personal', scopeId: null })),
    mfa: false,
    auth_time: 1_800_000_000,
    ...(perms ? { perms } : {}),
  };
  return `${base64url({ alg: 'ES256', typ: 'at+jwt' })}.${base64url(claims)}.signature`;
}
