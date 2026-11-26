/**
 * Textes communs de l'interface, en français. Peu de texte, des mots simples : l'Espace pro se lit
 * dehors, sur un téléphone, souvent d'une main.
 */
export const fr = {
  common: {
    skipToContent: 'Aller au contenu',
    retry: 'Réessayer',
    comingSoon: 'Bientôt disponible',
    backToSpaces: 'Retour à mes espaces',
    appName: 'KSP Pro',
  },
  header: {
    home: 'KSP Pro, choisir mon espace',
    accountMenu: 'Mon compte',
  },
  account: {
    loading: 'Chargement de votre espace…',
    unavailable: 'Impossible de vérifier votre connexion.',
    offline:
      'Hors connexion : vous voyez ce qui est gardé sur ce téléphone. Vos actions de terrain partiront au retour du réseau.',
    endedTitle: 'Vous n’êtes plus connecté',
    endedText: 'Votre session a pris fin. Reconnectez-vous pour retrouver votre espace.',
    signOut: 'Se déconnecter',
    signingOut: 'Déconnexion…',
    unsent: (count: number) =>
      count > 1
        ? `${count} actions de terrain ne sont pas encore envoyées. Si vous vous déconnectez, elles seront perdues.`
        : 'Une action de terrain n’est pas encore envoyée. Si vous vous déconnectez, elle sera perdue.',
    signOutAnyway: 'Me déconnecter quand même',
    stay: 'Rester connecté',
    phone: 'Numéro de connexion',
    refreshAccess: 'Actualiser mes accès',
    refreshingAccess: 'Actualisation…',
    accessRefreshed: 'Vos accès sont à jour.',
    accessRefreshFailed: 'Vos accès n’ont pas pu être actualisés.',
    deletionPendingTitle: 'Compte en cours de suppression',
    deletionPendingText:
      'Votre compte KSP est en cours de suppression. Pour l’annuler, rendez-vous dans « Mon compte » sur ksp.bj.',
    openPortail: 'Ouvrir ksp.bj',
  },
  login: {
    title: 'Se connecter',
    subtitle: 'Espace des professionnels KSP',
    intro: 'Pas de mot de passe : vous recevez un code par SMS ou WhatsApp.',
    newAccount: 'Première connexion ? Votre compte est créé avec votre numéro.',
    checking: 'Vérification de votre session…',
    phoneLegend: 'Votre numéro de téléphone',
    countryCode: 'Indicatif',
    phoneNumber: 'Numéro',
    phoneHint: 'Exemple : 01 97 00 00 45',
    phoneInvalid: 'Numéro invalide : vérifiez l’indicatif et le numéro.',
    /** Ancien numéro béninois à 8 chiffres, complété par 01 (ADR-063) : la forme envoyée est montrée. */
    phoneConverted: (phone: string) => `Numéro utilisé : ${phone}.`,
    phoneTenDigits: 'Les numéros béninois ont désormais 10 chiffres (01 devant).',
    channelLegend: 'Recevoir le code par',
    channels: { sms: 'SMS', whatsapp: 'WhatsApp' },
    sendCode: 'Recevoir mon code',
    sending: 'Envoi du code…',
    codeTitle: 'Saisissez votre code',
    codeSent: (channel: string, target: string) =>
      `Code envoyé par ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} au ${target}.`,
    codeValidity: (minutes: number) => `Valable ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    codeLabel: 'Code reçu',
    codeInvalid: 'Saisissez le code reçu, en chiffres.',
    verify: 'Valider',
    verifying: 'Vérification…',
    resend: 'Renvoyer le code',
    resendIn: (delay: string) => `Renvoyer le code dans ${delay}`,
    resent: 'Un nouveau code vous a été envoyé.',
    changeNumber: 'Modifier le numéro',
    attemptsRemaining: (count: number) =>
      count > 1 ? `Il vous reste ${count} essais.` : 'Il vous reste 1 essai.',
    retryIn: (delay: string) => `Nouvel essai possible dans ${delay}.`,
    delay: (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      if (minutes === 0) return `${rest} s`;
      return rest === 0 ? `${minutes} min` : `${minutes} min ${String(rest).padStart(2, '0')} s`;
    },
    mfaRequired:
      'Ce compte se connecte avec la double authentification, qui n’est pas disponible ici. Utilisez le back-office KSP.',
    genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
  },
  profile: {
    title: 'Complétez votre profil',
    intro: 'Vos prénom et nom figureront sur votre fiche et vos missions.',
    firstName: 'Prénom',
    lastName: 'Nom',
    firstNameRequired: 'Indiquez votre prénom.',
    lastNameRequired: 'Indiquez votre nom.',
    nameInvalid: 'Utilisez des lettres, des espaces, le trait d’union, l’apostrophe ou le point.',
    submit: 'Enregistrer et continuer',
    saving: 'Enregistrement…',
  },
  offline: {
    title: 'Pas de connexion',
    text: 'Cette page n’est pas encore enregistrée sur votre téléphone. Vérifiez votre réseau, puis réessayez.',
    hint: 'Les pages déjà ouvertes restent disponibles sans réseau.',
    retry: 'Réessayer',
  },
  install: {
    title: 'Installer KSP Pro',
    text: 'Ajoutez l’application à l’écran d’accueil : elle s’ouvre en un geste, même avec un réseau faible.',
    action: 'Ajouter à l’écran d’accueil',
    dismiss: 'Plus tard',
    iosText: 'Sur iPhone : touchez Partager, puis « Sur l’écran d’accueil ».',
  },
  errors: {
    notFoundTitle: 'Page introuvable',
    notFoundText: 'Cette page n’existe pas ou a été déplacée.',
    genericTitle: 'Une erreur est survenue',
    genericText: 'Cette page n’a pas pu s’afficher. Réessayez dans quelques instants.',
  },
} as const;

export type Dictionary = typeof fr;
