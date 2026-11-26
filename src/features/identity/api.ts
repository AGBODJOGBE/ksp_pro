import { api, parseResponse, type Session } from '@/lib/api';
import type { OtpChannel } from './channels';
import type { OtpChallenge, Profile } from './schemas';

/**
 * Appels du navigateur à la gateway pour la connexion et le profil (option A, F-005) : la session vit
 * dans le navigateur, ces appels ne passent donc pas par le serveur Next.
 *
 * Les schémas (zod) sont chargés à la demande, en même temps que l'appel part : ils restent hors du
 * premier chargement des écrans (budget de 200 Ko, docs/architecture.md), sans attente de plus.
 */

const PATHS = {
  requestOtp: '/api/v1/identity/otp/request',
  verifyOtp: '/api/v1/identity/otp/verify',
  logout: '/api/v1/identity/logout',
  me: '/api/v1/identity/me',
} as const;

const schemas = () => import('./schemas');

/**
 * Demande un code par le canal choisi. La gateway bascule d'elle-même sur l'autre canal si l'envoi
 * échoue : le canal réellement utilisé est dans la réponse.
 */
export async function requestOtp(phone: string, channel: OtpChannel): Promise<OtpChallenge> {
  const [{ otpChallengeSchema }, body] = await Promise.all([
    schemas(),
    api.post(PATHS.requestOtp, { phone, channel }, { auth: false }),
  ]);
  return parseResponse(otpChallengeSchema, body);
}

export type VerifyOtpResult = { status: 'authenticated'; session: Session } | { status: 'mfa_required' };

/** Valide le code ; la gateway pose le cookie de renouvellement et renvoie la session. */
export async function verifyOtp(challengeId: string, code: string): Promise<VerifyOtpResult> {
  const [{ verifyOtpResponseSchema }, response] = await Promise.all([
    schemas(),
    api.post(PATHS.verifyOtp, { challengeId, code }, { auth: false }),
  ]);
  const body = parseResponse(verifyOtpResponseSchema, response);
  if (body.status === 'mfa_required') return { status: 'mfa_required' };
  const { isNewUser: _isNewUser, ...session } = body;
  return { status: 'authenticated', session };
}

/** Complète le profil (prénom et nom). */
export async function updateProfile(input: { firstName: string; lastName: string }): Promise<Profile> {
  const [{ profileSchema }, body] = await Promise.all([schemas(), api.patch(PATHS.me, input)]);
  return parseResponse(profileSchema, body);
}

/** Ferme la session de cet appareil ; la gateway efface le cookie de renouvellement. */
export async function logout(): Promise<void> {
  await api.post(PATHS.logout);
}
