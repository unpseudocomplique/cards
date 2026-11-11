# Cartes personnalisées

Application Nuxt pour créer des jeux de cartes personnalisés avec photos, affectations par carte/personnage et génération IA.

## Jeu de tarot

Partie multijoueur Tarot français (FFT, 3–5 joueurs) : moteur pur testé, sync publique Yjs, mains privées via WebSocket Nitro, table 3D TresJS.

- **Tests moteur** : `pnpm test`
- **Sync publique locale** : `docker compose up -d` démarre aussi **yjs** (`y-websocket@2.0.4` serveur sur `:1234`, compatible `yjs@13` + client `y-websocket@3`). Vérifiez `NUXT_PUBLIC_YJS_WEBSOCKET_URL=ws://localhost:1234`.
- **Yjs prod (Coolify)** : ne déployez **pas** le repo `yjs/y-websocket` (v3 = client only → `Cannot find module './y-websocket.cjs'`). Utilisez le Dockerfile `deploy/yjs/Dockerfile` (Build Pack Dockerfile, port **1234**), domaine `https://realtime-tarot.untestcomplique.com`, et sur Cards : `NUXT_PUBLIC_YJS_WEBSOCKET_URL=wss://realtime-tarot.untestcomplique.com`. Évitez `@y/websocket-server` / **yjs 14** tant que TipTap exige `yjs@^13` et que yjs 14 reste en beta (détails dans `deploy/yjs/README.md`).
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

L’app envoie `redirect_uri` depuis `NUXT_PUBLIC_SITE_URL` (ou `NUXT_OAUTH_GOOGLE_REDIRECT_URL`), pas depuis le host du reverse proxy. Les routes `/auth/**` sont exclues du prerender : un crawl au build sinon fige `http://localhost/auth/google` et provoque `redirect_uri_mismatch` en prod.

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

## Génération des cartes & impression

Specs canoniques : [`shared/utils/printSpec.ts`](shared/utils/printSpec.ts), thèmes : [`shared/utils/cardThemes.ts`](shared/utils/cardThemes.ts), doc : [`docs/print-pipeline.md`](docs/print-pipeline.md).  
Règle agent : [`.cursor/rules/print-pipeline.mdc`](.cursor/rules/print-pipeline.mdc).

| Élément | Valeur |
|---------|--------|
| DPI | 300 |
| Fond perdu | 3 mm |
| Format | **Un seul format par jeu**, atouts et Excuse compris : **61 × 112 mm** (tarot 56 / 78) ou 63,5 × 88,9 mm (jeu classique, et anciens decks) — changeable dans *Dos & impression* |
| Thème de couleurs | Palette des prompts + couleurs du cadre et des index, commun à tout le jeu |
| Dos | Un seul dos par jeu, même contour que les faces |
| Export | `POST /api/decks/:id/exports/print` → ZIP `faces` / `back` / `print-spec.json` |

UI : onglets **Style** (thème, style des illustrations) et **Dos & impression** de l’atelier d’un deck (`/decks/:id/style`, `/decks/:id/impression`). Les aperçus de cartes suivent le format du deck (`cardFormatRatio`).

**Ne pas changer ces specs à la légère** : elles sont alignées avec le renderer, l’export et la doc imprimeur.

## Interface

Nuxt 4 + Nuxt UI 4, thème `violet` / `zinc` (`app/app.config.ts`), polices Geist et Instrument Serif.

| Zone | Layout | Pages |
|------|--------|-------|
| Public | `default` (UHeader / UFooter) | `/` |
| Authentification | `auth` (formulaire + illustration) | `/auth/*` |
| Atelier | `dashboard` (UDashboardSidebar) | `/dashboard`, `/decks/new`, `/decks/:id/*`, `/play` |
| Table | `play` (plein écran, sombre) | `/play/:code` (salle d’attente puis table 3D) |

L’atelier d’un deck partage ses données entre onglets via `provideDeckWorkspace` / `useDeckWorkspace` (`app/composables/useDeckWorkspace.ts`), y compris la file de génération qui continue quand on change d’onglet.

## Développement

```bash
pnpm install
pnpm dev
```
