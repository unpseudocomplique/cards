# Génération des cartes & pipeline impression

Document de référence. **Ne pas modifier les specs sans mettre à jour aussi** `shared/utils/printSpec.ts`, `.cursor/rules/print-pipeline.mdc` et le README.

> La dorure (masques hot-foil) a été abandonnée : plus de masques `*-foil.png`, plus d’or « chirurgical ».

## Un jeu = un format, un thème, un dos

- **Format unique par jeu** : toutes les cartes d’un jeu (enseignes, figures, atouts, Excuse) et son dos ont le même format, `settings.cardFormat` (`CARD_FORMATS` dans `shared/utils/printSpec.ts`) :
  - `tarot` — **61 × 112 mm**, le format du tarot français. Format des nouveaux decks tarot 56 / tarot 78.
  - `poker` — 63,5 × 88,9 mm. Jeu classique 52 cartes, et decks créés avant l’introduction des formats (pas de `cardFormat` = poker).
- **Changer de format** (`PATCH /api/decks/:id/format`, onglet *Dos & impression*) : les faces déjà rendues dans l’autre format (`metadata.format`, absent = poker) repassent en `pending` en gardant leur image comme référence ; elles ne sont ni exportées ni montrées à la table tant qu’elles ne sont pas régénérées. Revenir au format d’origine les réactive. Même règle pour le dos (`settings.cardBackFormat`).
- **Thème de couleurs** (`settings.colorTheme`, `shared/utils/cardThemes.ts`) : une palette et une lumière injectées dans **tous** les prompts (décor, personnage, dos), et les couleurs du rendu (papier, contour, cadre, filet, encre des index).
- **Dos unique** : un seul dos par jeu, rendu avec le même papier, le même contour et le même cadre que les faces. Utilisé pour toutes les cartes (jeu en ligne et impression).

## Formats

| Format | Screen (UI, table) | Print (pack imprimeur) | Ratio demandé à l’IA (scène + personnage / dos) | Mise en page |
|--------|--------------------|------------------------|-----------------------------------------------|--------------|
| `tarot` | 900 × 1652 | 61 × 112 mm à 300 DPI + 3 mm de fond perdu | 2:3 / 9:16 | `band` |
| `poker` | 900 × 1200 | 63,5 × 88,9 mm à 300 DPI + 3 mm de fond perdu | 3:4 / 3:4 | `side` |

## Anatomie d’une face (`server/utils/cardRenderer.ts`)

Une mise en page par format (`getCardLayout(format)`), identique pour toutes les cartes d’un jeu, tailles relatives à la largeur de coupe :

- `side` (poker) : index dans une colonne à gauche (et à droite, tournés), fenêtre entre les deux.
- `band` (tarot) : index en haut à gauche et en bas à droite, **au-dessus et au-dessous** de la fenêtre, qui prend presque toute la largeur — sur 61 × 112 mm une colonne d’index ne laisserait qu’une bande étroite à l’illustration.

Les positions viennent de `getCardLayoutRatios(format)` (`shared/utils/printSpec.ts`), lues à la fois par le renderer et par l’aperçu CSS `app/components/CardArt.vue`.

### Fond perdu et zone de sécurité

- **Fond perdu** (`PRINT_BLEED_MM` = 3 mm) : ajouté autour de la coupe à l’export, rempli avec le papier du thème.
- **Zone de sécurité** (`PRINT_SAFE_MM` = 3 mm, format tarot) : rien d’important à moins de 3 mm de la ligne de coupe, la coupe pouvant dériver d’environ 1 mm. Contour à 3,5 mm, index à 4,9 mm (horizontal) / 5,3 mm (vertical), cadre de l’illustration au-delà. Vérifié par `tests/server/cardRenderer.test.ts`.
- Le format poker garde sa mise en page historique (contour à ~2 mm) pour que les decks existants restent homogènes : coupe précise recommandée.

1. Papier du thème + contour extérieur (identique sur le dos).
2. Fenêtre d’illustration (décor IA) avec cadre plein + filet extérieur.
3. Personnage détouré (fond vert) posé sur le bas de la fenêtre ; il peut dépasser par le haut (jusqu’à `foregroundTop`), jamais sur les côtés ni sur les index.
4. Index dessinés depuis les contours de police (Liberation Serif Bold) : même hauteur de capitale partout, centrage optique sur la boîte réelle des glyphes, « 10 » / « 21 » resserrés puis condensés plutôt que réduits. Enseigne sous le rang ; atouts = numéro seul ; Excuse = étoile. Coin opposé = même groupe tourné à 180°.

## Dos de carte

1. Prompt libre (`cardBackPrompt`) + palette du thème, motif symétrique par rotation de 180°.
2. `POST /api/decks/:id/back/generate` → `renderCardBackImage()` (recadrage centré pour garder la symétrie).
3. URL : `cardBackImageUrl` dans les settings.

Changer de thème = régénérer les faces prêtes et le dos pour garder un jeu homogène.

## Export imprimeur

`POST /api/decks/:id/exports/print` produit un ZIP `{jeu}-impression.zip` :

```
{jeu}-recto.pdf     ← toutes les faces, une carte par page, dans l’ordre du jeu
{jeu}-verso.pdf     ← le dos, identique pour toutes les cartes (une page)
print-spec.json
```

Chaque page PDF (`server/utils/printPdf.ts`) :

- **Couleurs CMJN** : l’image sRGB est convertie avec le profil **Coated FOGRA39** (`server/assets/icc/FOGRA39L_coated.icc`, CC0) et placée en `DeviceCMYK` (JPEG qualité 95). Le profil est déclaré une fois comme *OutputIntent* du PDF.
- **Fond perdu** : la carte avec ses 3 mm de fond perdu (`BleedBox`), format fini en `TrimBox`.
- **Traits de coupe** : aux quatre coins, dans le prolongement des lignes de coupe, de 3 mm à 8 mm hors coupe (donc hors fond perdu), 0,25 pt en couleur de repérage (100 % CMJN). Page = format fini + 10 mm de marge de chaque côté.
- Une ligne d’identification (jeu, numéro de page, code de carte) en bas de page, hors fond perdu.

Constantes : `PRINT_SLUG_MM`, `PRINT_CROP_MARK_*`, `PRINT_ICC_PROFILE` dans `shared/utils/printSpec.ts`.

## Fichiers clés

- `shared/utils/printSpec.ts` — constantes, formats `tarot` / `poker`
- `server/api/decks/[id]/format.patch.ts` — changement de format d’un deck
- `shared/utils/cardThemes.ts` — thèmes de couleurs
- `server/utils/cardPromptBuilder.ts` — prompts décor / personnage / dos
- `server/utils/cardRenderer.ts` — mise en page, cadre, index, dos, upscale
- `server/utils/printExport.ts` — ZIP imprimeur
- `server/utils/printPdf.ts` — conversion CMJN, PDF une carte par page, traits de coupe
