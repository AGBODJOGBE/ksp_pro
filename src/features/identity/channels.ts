/**
 * Canaux d'envoi du code de connexion (`OtpChannel` du contrat). Espace pro : SMS proposé d'abord, un agent
 * de terrain n'a pas toujours WhatsApp ni de données mobiles. Module sans zod (lu par l'écran du numéro).
 */
export const OTP_CHANNELS = ['sms', 'whatsapp'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];
