# Architecture de l'Espace pro

Décisions F-012 (architecture commune des fronts), F-021 (Espace pro) et F-022 (PWA sans dépendance), dans `docs/decisions.md`. Le modèle est `ksp_portail` (`docs/architecture.md`) : ce document ne reprend que ce qui est **propre à l'Espace pro** ou qui s'en écarte.

## Le site

`ksp_pro` (prod prévue : https://pro.ksp.bj, dév : http://localhost:3050) sert trois profils, chacun dans son espace :

| Profil                                                             | Droit lu dans le jeton                                                        | Espace      | Adresse        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------- | -------------- |
| Agent du Nettoyage (`cleaning_agent`)                              | permission `cleaning.session.perform` dans `perms`                            | agent       | `/agent`       |
| Partenaire du Recouvrement (`recovery_bailiff`, `recovery_lawyer`) | rôle dans `roles`, ou permission partenaire (correction attendue du back, B1) | partenaire  | `/partenaire`  |
| Candidat (compte sans rôle)                                        | aucun : `GET /cleaning/agent/me` donne l'état de la candidature               | candidature | `/candidature` |

Les clients ont leur espace sur le portail ; le personnel KSP, sur le back-office.

## Principes (communs aux fronts, F-012)

1. Les règles métier vivent dans `ksp_back` ; le front affiche, recueille et transmet.
2. Découpage vertical par fonctionnalité, nommée comme le service du backend (`src/features/<service>`), importée seulement par son `index.ts`.
3. Espaces connectés, option A (F-005) : coque statique rendue par le serveur, composant client en feuille qui appelle `api` ; jeton d'accès en mémoire, renouvellement par le cookie posé par la gateway.
4. Frontières vérifiées par ESLint (`no-restricted-imports`, `fetch` interdit hors de `src/lib/api`) ; poids mesuré à chaque build.

## Dossiers

```
src/
├── app/                     routes : choix de l'espace, connexion, espaces, invitation, hors ligne, manifeste
├── features/
│   ├── identity/            connexion par téléphone (SMS d'abord), profil, garde, accès, déconnexion
│   ├── cleaning/            agent et candidat du Nettoyage : candidature, invitation, espace agent
│   ├── file/                dépôt d'une photo (service file) : compression, envoi au stockage, confirmation
│   ├── notification/        centre de notifications de l'agent, pastille des non lues
│   ├── recovery/            partenaire du Recouvrement : accueil
│   └── spaces/              choix de l'espace (sans service propre, comme `home` du portail)
├── components/
│   ├── ui/                  briques recopiées du portail (futur ksp-ui) + barre d'action du bas, grande carte de choix, « bientôt », assistant à étapes, liste paginée
│   └── layout/              en-tête, incitation à installer, enregistrement du service worker, « Réessayer » hors ligne
├── lib/                     api (client, session, droits du jeton), format, phone, idempotency, cn, device-storage (localStorage avec expiration), use-paged-list, use-now
├── config/                  environnement, identité du site, adresses
└── i18n/                    textes communs
public/
├── sw.js                    service worker écrit à la main (≤ 5 Ko)
└── icons/                   icônes 192, 512 et maskable, tirées du logo KSP
```

| Fonctionnalité          | Routes de la gateway                                                                                                                                                                                                                                                                                                                       | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/identity`     | `POST otp/request` (`channel` `sms` ou `whatsapp`), `POST otp/verify`, `POST token/refresh`, `PATCH me`, `POST logout`                                                                                                                                                                                                                     | Connexion par téléphone : SMS proposé d'abord, WhatsApp possible ; code ; « Complétez votre profil » ; garde `RequireSession` et chemin de retour (`?retour=`, chemin interne seulement) ; menu du compte (nom, numéro, « Actualiser mes accès », « Se déconnecter ») ; compte en cours de suppression : renvoi vers le portail. La déconnexion efface aussi les données du compte sur l'appareil (`lib/api/account-data`). |
| `features/cleaning`     | `GET agent/me`, `POST agent/applications` (clé), `GET catalog/zones`, `GET admin/cleaning/skills` (seulement si la gateway l'accepte, B4), `GET me/assignments`, `POST assignments/{id}/accept` et `decline` (clé), `GET` et `PUT me/availability`, `POST me/unavailabilities` (clé), `DELETE me/unavailabilities/{id}`, `GET me/activity` | Profil d'agent (404 `CLEANING_AGENT_NOT_FOUND` : jamais candidat) ; candidature en 11 étapes et son suivi (`/candidature`) ; invitation `/invitations/[id]` gardée sur l'appareil 7 jours (`ksp.pro.invitation`) ; espace agent : Aujourd'hui, Mes affectations, Mes disponibilités, Profil et activité, fiches provisoires. Détail : « Espace agent » plus bas.                                                            |
| `features/file`         | `POST file/uploads`, `POST file/files/{id}/complete`                                                                                                                                                                                                                                                                                       | Une photo compressée (1600 px, JPEG 0,75, `canvas`, sans dépendance), déclarée, envoyée au stockage par l'adresse présignée (`lib/api/upload`), confirmée ; seul son identifiant part avec le formulaire.                                                                                                                                                                                                                   |
| `features/notification` | `GET notifications`, `GET notifications/unread-count`, `POST notifications/{id}/read`, `POST notifications/read-all`                                                                                                                                                                                                                       | Centre de notifications de l'agent (`/agent/notifications` : toutes ou non lues, marquer lu, tout marquer lu) et pastille des non lues (Aujourd'hui, Profil). Les messages de l'agent n'ont pas de lien : aucun bouton « Voir ».                                                                                                                                                                                            |
| `features/recovery`     | —                                                                                                                                                                                                                                                                                                                                          | Accueil provisoire de l'espace partenaire.                                                                                                                                                                                                                                                                                                                                                                                  |
| `features/spaces`       | —                                                                                                                                                                                                                                                                                                                                          | Choix de l'espace (`choice.ts`, testé), garde d'un espace (`SpaceGate`) : sans le droit, message, « Actualiser mes accès » et retour aux espaces.                                                                                                                                                                                                                                                                           |

## Choix de l'espace (`/`)

`lib/api/claims.ts` (recopié du back-office) lit `roles`, `perms` et `zone_perms` du jeton d'accès, sans le vérifier : ces droits ne servent qu'à choisir l'écran, la gateway reste seule juge.

1. `perms` contient `cleaning.session.perform` → espace agent ; rôle `recovery_bailiff` ou `recovery_lawyer`, ou permission partenaire → espace partenaire.
2. Un seul espace : ouverture directe (`router.replace`), l'application installée s'ouvre donc sur l'espace de l'agent.
3. Les deux : deux grandes cartes.
4. Aucun : `GET /cleaning/agent/me` → état de la candidature (envoyée, en examen, acceptée, suspendu, désactivé, non retenue), ou « Devenir agent KSP » ; lien vers l'espace client du portail.
5. « Actualiser mes accès » (sur cet écran, dans le menu du compte et sur la garde d'un espace) force `POST /identity/token/refresh` : un rôle donné par KSP n'entre dans le jeton qu'à son renouvellement. Une panne de la gateway garde alors la session en cours (`session.renew()`), au lieu de la vider comme un renouvellement sur 401. Candidature acceptée : le bouton devient l'action principale.

**À valider** : la permission partenaire n'existe pas encore (B1). `recovery.assignment.perform`, exemple donné par B1, est déjà reconnue (`features/spaces/choice.ts`) ; à remplacer par le code retenu par le back.

## Rendu

| Route                                                                                                                             | Rendu                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`, `/agent`, `/partenaire`, `/candidature`, `/connexion`, `/hors-ligne`                                                         | Statique (○), coque + composants client                                                                                                                                                          |
| `/agent/affectations`, `/agent/disponibilites`, `/agent/profil`, `/agent/notifications`, `/agent/visite?id=`, `/agent/seance?id=` | Statique (○) ; garde de session, garde du droit d'agent et cadre (navigation) une seule fois dans `app/agent/layout.tsx` ; écrans chargés à la demande (`features/cleaning/components/lazy.tsx`) |
| `/invitations/[id]`                                                                                                               | Dynamique (ƒ) : identifiant connu à la requête ; `Referrer-Policy: no-referrer`, jamais gardé par le service worker (`no-store`)                                                                 |
| `/manifest.webmanifest`, `/robots.txt`, `/icon.svg`, `/apple-icon.png`                                                            | Statiques (conventions de Next)                                                                                                                                                                  |
| `/api/health`                                                                                                                     | Dynamique (sonde)                                                                                                                                                                                |

Les fiches des prochaines versions passeront leur identifiant dans la recherche (`/agent/seance?id=…`, lue sous `Suspense`) : une seule coque par écran, que le service worker garde une fois pour toutes.

Tout le site est `noindex` (métadonnées, `robots.txt`, en-tête `X-Robots-Tag`).

## Application installable (PWA, F-022)

| Élément                | Où                                       | Règle                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifeste              | `src/app/manifest.ts`                    | « KSP Pro », `standalone`, `start_url` et `scope` à `/`, couleur `#0F2850`, icônes 192 et 512 (`any`) et 512 `maskable` (contenu dans la zone de sécurité de 80 %).                                                                                                                                                                                                                                                                                                           |
| Icônes                 | `public/icons`, `src/app/apple-icon.png` | Tirées des tracés du logo (`components/ui/brand/logo.tsx`) : « KSP » blanc, signature, pastille « PRO » orange, sur bleu nuit. Générées une fois (rendu du SVG par Chromium) ; à régénérer quand le fichier officiel du logo arrivera.                                                                                                                                                                                                                                        |
| Service worker         | `public/sw.js`                           | Écrit à la main, sans dépendance, 5 Ko au plus (test unitaire et test de bout en bout). Pages : réseau d'abord ; passé 5 s ou sans réseau, la copie gardée (clé : le chemin, sans la recherche) ; sinon `/hors-ligne`. `/_next/static` et `/icons` : cache d'abord. Jamais une autre origine (gateway, stockage), ni `/api`, ni une requête autre que `GET`, ni une réponse `no-store`.                                                                                       |
| Installation du SW     | `public/sw.js`                           | Garde `/hors-ligne` et `/`, avec les styles, scripts et police qu'elles appellent (lus dans leur HTML).                                                                                                                                                                                                                                                                                                                                                                       |
| Versions               | `VERSION` dans `public/sw.js`            | Caches `ksp-pro-pages-<version>` et `ksp-pro-assets-<version>` (40 pages, 200 fichiers au plus) ; l'activation efface les caches `ksp-pro-*` des autres versions. Changer `VERSION` quand la stratégie change.                                                                                                                                                                                                                                                                |
| Enregistrement         | `components/layout/service-worker.tsx`   | En production seulement.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Page hors connexion    | `/hors-ligne`                            | Statique, sans appel à la gateway, « Réessayer » en bas de l'écran.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Incitation à installer | `components/layout/install-prompt.tsx`   | Bandeau discret sous l'en-tête : `beforeinstallprompt` (Chrome, Edge, Samsung Internet), ou le geste à faire sur iPhone (« Partager », puis « Sur l'écran d'accueil »). Jamais dans l'application installée ; « Plus tard » mémorisé 30 jours (`localStorage`, confort seulement).                                                                                                                                                                                            |
| En-têtes               | `next.config.ts`                         | `/sw.js` : `Cache-Control: no-cache`. CSP : `worker-src 'self'`, `manifest-src 'self'`, `connect-src` limité au site, à la gateway et à l'origine du stockage (`NEXT_PUBLIC_FILE_STORAGE_ORIGIN`). `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`.                                                                                                                                                                                                    |
| Déconnexion            | `lib/api/account-data.ts`                | Efface les clés `ksp.` de l'onglet et de l'appareil (`sessionStorage` et `localStorage` : invitation, brouillon de la candidature ; aussi quand un autre compte se connecte sur l'appareil, les réglages de confort `ksp-pro.…` restent) et supprime la base hors ligne IndexedDB `ksp-pro` (créée par les parcours de terrain, versions suivantes). Les copies de pages gardées par le service worker ne contiennent aucune donnée personnelle (coques statiques, option A). |

Les tests de bout en bout bloquent le service worker (`serviceWorkers: 'block'`) pour que la gateway simulée voie toutes les requêtes ; le parcours hors connexion l'autorise.

## Interface de terrain

- Mobile d'abord, une main : action principale fixée en bas de l'écran sur téléphone (`components/ui/bottom-bar.tsx`, marge de la barre de gestes respectée), dans le flux dès 640 px.
- Cibles de 48 px au moins (boutons `md` 48 px, `lg` 56 px ; champs du numéro et du code plus hauts).
- Gros contrastes, peu de texte ; colonne de 42 rem centrée sur ordinateur, en-tête aligné sur elle.
- En-tête bleu nuit (couleur de l'application installée) : logo et pastille « Pro » (retour au choix de l'espace), nom de l'espace ouvert, menu du compte.

### Gamme d'accent (F-002) — à valider

Orange « signal » (`signal-*`, 500 = `#F26A1B`), comme un gilet de haute visibilité : lisible au soleil, distinct du vert d'action et du bleu nuit. Rôles : pastille « Pro », liseré d'une carte mise en avant, étiquette « Bientôt disponible », tuile d'icône. Contrastes : bleu nuit sur l'orange 4,8:1 ; texte orange foncé (`accent-ink`, 700 = `#B4430C`) sur blanc 5,6:1 ; jamais de texte blanc sur l'orange (3,1:1). L'or reste dans la signature du logo. Alternative étudiée : un cyan (8:1 avec le bleu nuit en fond clair), écarté parce que trop proche du vert d'action et peu visible en plein soleil.

## Budget de poids

Budget validé : **200 Ko de JavaScript par écran** (premier chargement, gzip ; 3G de terrain) et **5 Ko pour `sw.js`**. `pnpm build && pnpm size` signale une page au-dessus du budget et sort en erreur (CI).

Écarts au modèle du portail, imposés par ce budget (le portail est à 212–215 Ko par écran connecté) :

1. `config/env.ts` valide les adresses sans zod : il est lu par toutes les pages (client de la gateway).
2. Les schémas zod des réponses sont chargés **à la demande**, en même temps que l'appel part (`Promise.all([import('./schemas'), api.get(…)])`) : zod (17 Ko) sort du premier chargement sans attente de plus. `lib/api/index.ts` ne réexporte plus les schémas de la session (`@/lib/api/session-schema` pour qui les valide). **À valider** : à généraliser aux prochaines fonctionnalités.
3. Relais chargés à la demande (`components/lazy.tsx`, comme le portail) : connexion, « Complétez votre profil » et menu du compte (11 Ko), incitation à installer (1 Ko).

Mesure du 26 novembre 2026 (socle PWA et connexion) :

| Page                         | First Load JS |
| ---------------------------- | ------------- |
| `/connexion`, 404            | 184,4 Ko      |
| `/hors-ligne`                | 185,0 Ko      |
| `/candidature`               | 187,5 Ko      |
| `/`, `/agent`, `/partenaire` | 190,0 Ko      |
| `public/sw.js`               | 4,1 Ko        |

Le socle de React et Next pèse à lui seul environ 156 Ko : chaque écran dispose d'une quarantaine de Ko pour ses composants, ses textes et zod.

Mesure du 26 novembre 2026 (agent, partie en ligne) — `pnpm size` :

| Page                                                                       | First Load JS |
| -------------------------------------------------------------------------- | ------------- |
| `/connexion`, 404                                                          | 185,0 Ko      |
| `/hors-ligne`                                                              | 185,6 Ko      |
| `/candidature`                                                             | 186,8 Ko      |
| `/`, `/partenaire`, `/agent/affectations`, `/agent/disponibilites`, fiches | 190,4 Ko      |
| `/agent`, `/agent/profil`, `/agent/notifications` (pastille)               | 190,8 Ko      |

Les écrans (candidature, Aujourd'hui, affectations, disponibilités, profil, notifications) sont chargés à la demande, pendant la vérification de la session (`components/lazy.tsx` de chaque fonctionnalité) : `pnpm size` ne les compte pas. Mesuré dans Chromium (script du premier chargement et écran compris, sans les polyfills que Chromium ne charge pas) : de 176 à 188 Ko par écran, sous le budget aussi.

## Espace agent (agent du Nettoyage, partie en ligne)

| Écran                                      | Routes                                                                                                     | Règles d'affichage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidature `/candidature`                 | `GET agent/me`, `GET catalog/zones`, `GET admin/cleaning/skills`, `POST file/*`, `POST agent/applications` | 11 étapes, une par écran (« Retour » et « Continuer » sous le pouce). Brouillon dans `localStorage` (`ksp.pro.candidature`), rattaché au compte, 7 jours après la dernière saisie ; une photo de plus de 23 h en est retirée (le service file purge à 24 h un fichier jamais rattaché). Envoi avec clé d'idempotence (même contenu, même clé). Refus lus : déjà candidat (l'état s'affiche), invitation refusée (« Envoyer sans invitation »), commune ou compétence inconnue et champ refusé (retour à l'étape), `CLEANING_GEO_UNAVAILABLE` (nouvel essai, même clé). |
| Suivi `/candidature`                       | `GET agent/me`                                                                                             | Envoyée, en examen (« Actualiser »), acceptée (« Actualiser mes accès », puis « Ouvrir mon espace agent »), non retenue (sans motif : le contrat n'en donne pas), suspendu, désactivé.                                                                                                                                                                                                                                                                                                                                                                                 |
| Aujourd'hui `/agent`                       | `GET me/assignments` (minuit à minuit, heure du Bénin), `GET me/assignments?status=pending_confirmation`   | La prochaine intervention en tête, puis le reste de la journée, ce qui est passé, ce qui est annulé ou retiré ; bandeau « n affectations attendent votre réponse » ; lien vers la fiche (`/agent/visite?id=`, `/agent/seance?id=`, coques provisoires remplies par la version « terrain »).                                                                                                                                                                                                                                                                            |
| Mes affectations `/agent/affectations`     | `GET me/assignments` (du… au…, onglets par statut, curseur), `POST assignments/{id}/accept` et `decline`   | Indépendant : accepter ou refuser avant `respondBefore` (compte à rebours, refus confirmé, clé d'idempotence ; 422 : la liste est relue). Salarié : explication, pas d'onglet « À confirmer », aucun bouton.                                                                                                                                                                                                                                                                                                                                                           |
| Mes disponibilités `/agent/disponibilites` | `GET` et `PUT me/availability`, `POST` et `DELETE me/unavailabilities`                                     | Semaine type (6 plages par jour) et disponibilités exceptionnelles enregistrées ensemble (le `PUT` remplace les deux) ; 409 `CLEANING_AVAILABILITY_IN_USE` : « contactez votre superviseur ». Indisponibilités : journées entières ou heures, motif, note de 300 caractères ; 409 `CLEANING_UNAVAILABILITY_CONFLICT` expliqué ; retrait confirmé. Charge maximale en lecture.                                                                                                                                                                                          |
| Profil `/agent/profil`                     | `GET agent/me`, `GET me/activity`, `GET catalog/zones` (noms des communes)                                 | Profil en lecture (aucune route ne permet de le modifier : l'écran le dit) ; activité : chiffres de la semaine et du mois, heures et séances par semaine et par mois (tableau, barre d'aide de la même teinte), sans montant.                                                                                                                                                                                                                                                                                                                                          |
| Notifications `/agent/notifications`       | `GET notifications`, `unread-count`, `POST read`, `read-all`                                               | Messages sans lien.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Navigation de l'espace (`AgentShell`) : barre du bas sur téléphone (Aujourd'hui, Affectations, Disponibilités, Profil ; cibles de 68 px), onglets au-dessus du contenu dès 640 px. Elle réserve sa hauteur (`--bottom-nav-h`) : `BottomBar` se pose au-dessus.

**À valider** :

1. Compétences : aucune route ne les liste pour un candidat (B4). La candidature essaie `GET /admin/cleaning/skills` ; refusée (403 attendu), l'étape affiche « Bientôt disponible » (route attendue visible hors production) et l'envoi est bloqué et expliqué au récapitulatif ; le brouillon reste. Le contrat ne documente aucun code de compétence : aucune saisie libre n'est proposée.
2. Commune de résidence : la liste des communes desservies (`GET /cleaning/catalog/zones`) sert aussi à la commune de résidence, en attendant une liste des communes (B4).
3. Finalité des fichiers de la candidature : `cleaning_intervention_photo` (photo et pièce d'identité), choix gardé dans `features/cleaning/application/files.ts` seulement.
4. Brouillon : 7 jours après la dernière saisie (et non après la première) ; effacé à la déconnexion, comme l'invitation.

## Couverture des routes (`pnpm routes:coverage`)

`scripts/routes-coverage.mjs` lit le contrat (`KSP_CONTRACT`, sinon `../ksp_back/contracts/openapi/ksp-api.v1.yaml`) et garde le périmètre de l'Espace pro : `/cleaning/agent/*`, routes de terrain des visites et des séances, `/recovery/partner/*`, identity (connexion et profil), file (envoi), notification (hors back-office). Routes écartées avec leur raison : `docs/routes-coverage.json`. Les routes non intégrées sont normales à ce stade (socle) : elles arrivent avec les versions suivantes (agent en ligne, terrain et hors ligne, partenaire).

## Prérequis du back (demandés à ksp_back le 26 novembre 2026)

B1 accès partenaire (routes contrôlées sur `roles`, qui ne portent que `customer` sur le web) ; B2 lien des notifications partenaire ; B3 `CLEANING_AGENT_APP_URL` → `http://localhost:3050` ; B4 compétences et communes lisibles par un candidat ; B5 `requestId` dans les vues de l'agent ; B6 position d'une visite ; B7 pièces du partenaire ; B8 destinataires des notifications agent ; CORS : origine `http://localhost:3050` à ajouter à la gateway locale.
