/** Textes du choix de l'espace. */
export const spacesTexts = {
  greeting: (firstName: string | null) => (firstName ? `Bonjour ${firstName}` : 'Bonjour'),
  chooseLead: 'Choisissez votre espace.',
  opening: 'Ouverture de votre espace…',
  checking: 'Recherche de votre candidature…',
  agent: {
    title: 'Espace agent',
    text: 'Nettoyage : vos séances, visites et affectations.',
  },
  partner: {
    title: 'Espace partenaire',
    text: 'Recouvrement : les dossiers qui vous sont confiés.',
  },
  noSpaceLead: 'Aucun espace professionnel n’est encore ouvert sur ce compte.',
  accessHint: 'KSP vient de vous donner un accès ? Actualisez vos accès.',
  customerTitle: 'Vous êtes client de KSP ?',
  customerLink: 'Mon espace client sur ksp.bj',
  loadError: 'Votre candidature n’a pas pu être lue.',
  denied: {
    agentTitle: 'Espace agent non disponible',
    partnerTitle: 'Espace partenaire non disponible',
    text: 'Ce compte n’a pas encore accès à cet espace. Si KSP vient de vous le donner, actualisez vos accès.',
  },
} as const;
