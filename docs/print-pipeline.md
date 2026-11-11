# Génération des cartes & pipeline impression

Document de référence. **Ne pas modifier les specs sans mettre à jour aussi** `shared/utils/printSpec.ts`, `.cursor/rules/print-pipeline.mdc` et le README.

> La dorure (masques hot-foil) a été abandonnée : plus de masques `*-foil.png`, plus d’or « chirurgical ».

## Un jeu = un format, un thème, un dos

- **Format unique** : toutes les cartes d’un jeu (enseignes, figures, atouts, Excuse) sont en 3:4 — `DECK_CARD_ASPECT_RATIO`. Les anciennes lignes d’atouts en `9:16` sont ignorées au rendu.
- **Thème de couleurs** (`settings.colorTheme`, `shared/utils/cardThemes.ts`) : une palette et une lumière injectées dans **tous** les prompts (décor, personnage, dos), et les couleurs du rendu (papier, contour, cadre, filet, encre des index).
- **Dos unique** : un seul dos par jeu, rendu avec le même papier, le même contour et le même cadre que les faces. Utilisé pour toutes les cartes (jeu en ligne et impression).

## Formats

| Profil | Usage | Taille |
|--------|--------|--------|
| Screen | Aperçu UI / régénération | 900×1200 |
| Print | Pack imprimeur | 63,5 × 88,9 mm à 300 DPI + 3 mm de fond perdu |

## Anatomie d’une face (`server/utils/cardRenderer.ts`)

Une seule mise en page (`getCardLayout`) pour toutes les cartes, tailles relatives à la largeur de coupe :

1. Papier du thème + contour extérieur (identique sur le dos).
2. Fenêtre d’illustration (décor IA) avec cadre plein + filet extérieur.
3. Personnage détouré (fond vert) posé sur le bas de la fenêtre ; il peut dépasser par le haut, jamais sur les côtés ni sur les index.
4. Index dessinés depuis les contours de police (Liberation Serif Bold) : même hauteur de capitale partout, centrage optique sur la boîte réelle des glyphes, « 10 » / « 21 » resserrés puis condensés plutôt que réduits. Enseigne sous le rang ; atouts = numéro seul ; Excuse = étoile. Coin opposé = même groupe tourné à 180°.

## Dos de carte

1. Prompt libre (`cardBackPrompt`) + palette du thème, motif symétrique par rotation de 180°.
2. `POST /api/decks/:id/back/generate` → `renderCardBackImage()` (recadrage centré pour garder la symétrie).
3. URL : `cardBackImageUrl` dans les settings.

Changer de thème = régénérer les faces prêtes et le dos pour garder un jeu homogène.

## Export

`POST /api/decks/:id/exports/print` produit un ZIP :

```
print/faces/{cardCode}.png
print/back/card-back.png       ← le même dos pour toutes les cartes
print/print-spec.json
```

## Fichiers clés

- `shared/utils/printSpec.ts` — constantes, format unique
- `shared/utils/cardThemes.ts` — thèmes de couleurs
- `server/utils/cardPromptBuilder.ts` — prompts décor / personnage / dos
- `server/utils/cardRenderer.ts` — mise en page, cadre, index, dos, upscale
- `server/utils/printExport.ts` — ZIP
