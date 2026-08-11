# Cartes personnalisées

Application Nuxt pour créer des jeux de cartes personnalisés avec photos, affectations par carte/personnage et génération IA.

## Jeu de tarot

Partie multijoueur Tarot français (FFT, 3–5 joueurs) : moteur pur testé, sync publique Yjs, mains privées via WebSocket Nitro, table 3D TresJS.

- **Tests moteur** : `pnpm test`
- **Sync publique locale** : `docker compose up -d` démarre aussi **yjs** (`npx y-websocket@2.0.4` sur le port `1234`). Vérifiez `NUXT_PUBLIC_YJS_WEBSOCKET_URL=ws://localhost:1234` (voir `.env.example`).
- **Interface de jeu** : [`/play`](http://localhost:3003/play) — connexion requise ; créez d’abord un deck **tarot78** (faces S3 optionnelles → placeholders). WebGL requis.
- **Debug gfx** : `?debugGfx=1` sur `/play/[code]` (profil qualité, fps, textures)
- **Spec & plan** : cycle 1 [`docs/superpowers/specs/2026-08-11-tarot-game-engine-design.md`](docs/superpowers/specs/2026-08-11-tarot-game-engine-design.md) · cycle 2 3D [`docs/superpowers/specs/2026-08-12-tarot-table-3d-design.md`](docs/superpowers/specs/2026-08-12-tarot-table-3d-design.md)

## Déploiement production

Le déploiement est prévu sur le même modèle que Quizwar: build Docker multi-stage, serveur Nitro sur le port `3000`, migrations Drizzle lancées au build puis au démarrage du conteneur.

### Configuration plateforme

Dans Coolify ou la plateforme qui construit le `Dockerfile`:

- Build pack: `Dockerfile`
- Port exposé: `3000`
- Domaine: `https://cards.untestcomplique.com`
- Variables d'environnement disponibles au build et au runtime:

```dotenv
DATABASE_URL=postgresql://quizwar:quizwar@<postgres-host>:5432/cards
NUXT_PUBLIC_SITE_URL=https://cards.untestcomplique.com
NUXT_PUBLIC_YJS_WEBSOCKET_URL=wss://<y-websocket-host>:1234
NUXT_SESSION_PASSWORD=<secret-long-32-chars-minimum>
NUXT_OAUTH_GOOGLE_CLIENT_ID=<google-client-id-prod>
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=<google-client-secret-prod>
GOOGLE_GENERATIVE_AI_API_KEY=<google-generative-ai-key>
NUXT_BUCKET_ENDPOINT=s3.quizwar.app
NUXT_BUCKET_NAME=quizwar
NUXT_BUCKET_PUBLIC_URL=https://s3.quizwar.app
MINIO_USER=<s3-access-key>
MINIO_PASSWORD=<s3-secret-key>
```

Si la base `cards` n'existe pas encore sur le Postgres partagé de Quizwar:

```sql
CREATE DATABASE cards OWNER quizwar;
```

### Google OAuth

Dans le client OAuth Google de production, ajouter:

Authorized JavaScript origins:

```text
https://cards.untestcomplique.com
```

Authorized redirect URIs:

```text
https://cards.untestcomplique.com/auth/google
```

Pour le développement local, ajouter aussi:

```text
http://localhost:3003
http://localhost:3003/auth/google
```

### Test local du conteneur

Le `Dockerfile` lance une migration pendant le build, comme Quizwar. Il faut donc fournir au moins `DATABASE_URL` au build:

```bash
docker build \
  --build-arg DATABASE_URL=postgresql://quizwar:quizwar@host.docker.internal:5432/cards \
  --build-arg NUXT_PUBLIC_SITE_URL=https://cards.untestcomplique.com \
  -t cards .
```

Puis lancer le conteneur avec les variables runtime:

```bash
docker run --rm -p 3000:3000 --env-file .env.production cards
```

## Impression & dorure

Specs canoniques : [`shared/utils/printSpec.ts`](shared/utils/printSpec.ts) et [`docs/print-pipeline.md`](docs/print-pipeline.md).  
Règle agent : [`.cursor/rules/print-pipeline.mdc`](.cursor/rules/print-pipeline.mdc).

| Élément | Valeur |
|---------|--------|
| DPI | 300 |
| Fond perdu | 3 mm |
| Poker / enseignes | 63,5 × 88,9 mm |
| Atouts 9:16 | 70 × 124,4 mm |
| Dorure | Masques noir/blanc générés **dans l’app** (pas d’Illustrator) |
| Dos | Génération IA + cadre or + masque foil |
| Export | `POST /api/decks/:id/exports/print` → ZIP `faces` / `foil` / `back` / `print-spec.json` |

UI : panneau **Impression & dorure** sur la page d’un deck.

**Ne pas changer ces specs à la légère** : elles sont alignées avec le renderer, l’export et la doc imprimeur.

---

# Nuxt Portfolio Template

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Use this template to create your own portfolio with [Nuxt UI](https://ui.nuxt.com).

- [Live demo](https://portfolio-template.nuxt.dev/)
- [Documentation](https://ui.nuxt.com/docs/getting-started/installation/nuxt)

<a href="https://portfolio-template.nuxt.dev/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://ui.nuxt.com/assets/templates/nuxt/portfolio-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://ui.nuxt.com/assets/templates/nuxt/portfolio-light.png">
    <img alt="Nuxt Portfolio Template" src="https://ui.nuxt.com/assets/templates/nuxt/portfolio-light.png">
  </picture>
</a>

## Quick Start

```bash [Terminal]
npm create nuxt@latest -- -t ui/portfolio
```

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-name=portfolio&repository-url=https%3A%2F%2Fgithub.com%2Fnuxt-ui-templates%2Fportfolio&demo-image=https%3A%2F%2Fui.nuxt.com%2Fassets%2Ftemplates%2Fnuxt%2Fportfolio-dark.png&demo-url=https%3A%2F%2Fportfolio-template.nuxt.dev%2F&demo-title=Nuxt%20Portfolio%20Template&demo-description=A%20sleek%20portfolio%20template%20to%20showcase%20your%20work%2C%20skills%20and%20blog%20powered%20by%20Nuxt%20Content.)

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.
