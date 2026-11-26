# ksp_pro — Espace pro KSP

Application web installable (PWA), mobile d'abord, de l'écosystème KSP (décisions F-021 et F-022) pour les professionnels de terrain :

- **agents de nettoyage** (`cleaning_agent`) : affectations, visites des lieux, séances, disponibilités ;
- **partenaires du recouvrement** (`recovery_bailiff`, `recovery_lawyer`) : dossiers assignés, actes, encaissements ;
- **candidats agents** : candidature et suivi.

Même compte et même session que les autres sites `ksp.bj` (F-005). Les clients utilisent le portail ; le personnel KSP, le back-office.

## Démarrer

Prérequis : Node 22 (`.nvmrc`), pnpm 10.28 (`packageManager`), la gateway de `ksp_back` (en local : http://localhost:3005).

```bash
pnpm install
cp .env.example .env.local
pnpm dev                      # http://localhost:3050
```

La gateway doit autoriser l'origine `http://localhost:3050` (CORS) pour l'essai réel.

## Commandes

| Commande                                                        | Rôle                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                                                      | Serveur de développement (port 3050)                                     |
| `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` | Contrôles et tests unitaires (Vitest, Testing Library)                   |
| `pnpm build && pnpm size`                                       | Build de production et poids par écran (budget : 200 Ko)                 |
| `pnpm start`                                                    | Sert le build autonome (`.next/standalone`, port 3050 par défaut)        |
| `pnpm test:e2e`                                                 | Parcours Playwright, téléphone et ordinateur, contre une gateway simulée |
| `pnpm routes:coverage`                                          | Routes de la gateway du périmètre de l'Espace pro, intégrées ou non      |

## Organisation

Architecture par fonctionnalités commune aux fronts (F-012) : voir [`docs/architecture.md`](docs/architecture.md). Décisions : [`docs/decisions.md`](docs/decisions.md). Règles de travail : [`CONTRIBUTING.md`](CONTRIBUTING.md).

- `src/features/identity` : connexion par téléphone (code par SMS ou WhatsApp), profil, garde, déconnexion ;
- `src/features/spaces` : choix de l'espace selon les droits du compte ;
- `src/features/cleaning` : agent et candidat du Nettoyage ;
- `src/features/recovery` : partenaire du Recouvrement ;
- `public/sw.js` : service worker écrit à la main (hors ligne limité aux actions de terrain).

## Déploiement

Image Docker autonome par environnement (`Dockerfile`, variables `NEXT_PUBLIC_*` figées au build) ; CI GitHub (`.github/workflows/ci.yml`) : format, lint, typage, tests, build, poids, parcours de bout en bout, image.

`main` est la production : toute modification passe par une branche et une demande de fusion avec la CI au vert.
