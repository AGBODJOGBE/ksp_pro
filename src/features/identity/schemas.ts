import * as z from 'zod/mini';
import { activeContextSchema, sessionSchema, sessionUserSchema } from '@/lib/api/session-schema';

/**
 * Réponses de la gateway pour la connexion par téléphone et le profil (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/identity/*`). Lecture tolérante : un champ ajouté par la gateway est ignoré.
 * Schémas lus dans le navigateur : `zod/mini`, bien plus léger que `zod`, et chargés à la demande par
 * `api.ts` (en parallèle de l'appel) pour rester hors du premier chargement des écrans.
 */

/** `RequestOtpResponse` : code envoyé. */
export const otpChallengeSchema = z.object({
  challengeId: z.string(),
  /** Numéro masqué, par exemple `+229********45`. */
  maskedTarget: z.string(),
  /** Canal réellement utilisé, après une éventuelle bascule vers l'autre canal. */
  channel: z.string(),
  expiresInSeconds: z.int().check(z.positive()),
  resendAfterSeconds: z.int().check(z.nonnegative()),
});

/** `VerifyOtpSessionResponse` ou `MfaRequiredResponse` (comptes du back-office, refusés ici). */
export const verifyOtpResponseSchema = z.discriminatedUnion('status', [
  z.extend(sessionSchema, { isNewUser: z.boolean() }),
  z.object({ status: z.literal('mfa_required') }),
]);

/** `MeResponse` (`PATCH /me`) : seuls les champs relus par l'Espace pro. */
export const profileSchema = z.object({
  user: sessionUserSchema,
  profileIncomplete: z.boolean(),
  activeContext: activeContextSchema,
});

export type OtpChallenge = z.infer<typeof otpChallengeSchema>;
export type VerifyOtpResponse = z.infer<typeof verifyOtpResponseSchema>;
export type Profile = z.infer<typeof profileSchema>;
