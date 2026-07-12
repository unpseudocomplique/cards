# Pipeline impression & dorure

Document de référence pour l’impression pro. **Ne pas modifier les specs sans mettre à jour aussi** `shared/utils/printSpec.ts`, `.cursor/rules/print-pipeline.mdc` et le README.

## Formats

| Profil | Usage | Taille |
|--------|--------|--------|
| Screen | Aperçu UI / régénération | 900×1200 (3:4) ou 900×1600 (9:16) |
| Print | Pack imprimeur | 300 DPI + 3 mm de fond perdu |

### Découpe (trim)

- Poker / enseignes : **63,5 × 88,9 mm**
- Atouts (9:16) : **70 × 124,4 mm**

## Dorure (hot foil) — 100 % dans l’app

1. **Faces** : or du costume/bijoux + cadres chrome. **Jamais** les indices ni les pips (R, carreau, etc. restent en encre).
2. **Dos** : `card-back-foil.png` = extraction HSV de l’or peint (filigranes, lunes…). Pas de rectangles SVG.
3. Noir = dorure, blanc = rien. Fichier : `server/utils/foilMask.ts` (`foilOptionsOrnament` / `foilOptionsCostume`).
4. **Bug corrigé** : ne jamais écrire `pixel || 255` pour un masque (le noir `0` était écrasé → masques quasi vides).
5. Coins d’index forcés en blanc sur le masque (`clearIndexCornersFromFoilMask`).

## Dos de carte

1. Prompt libre (`cardBackPrompt`) — full-bleed, **sans** mockup ni cadre rectangulaire simple.
2. `POST /api/decks/:id/back/generate` → motif IA **sans** traits de cadre superposés.
3. URLs : `cardBackImageUrl` / `cardBackFoilUrl` dans les settings.

Évite dans le prompt : `card game asset preview`, `isolated on gray background`, `--ar` (géré par l’API).

## Export

`POST /api/decks/:id/exports/print` produit un ZIP :

```
print/faces/
print/foil/
print/back/card-back.png
print/back/card-back-foil.png   ← masque dorure du dos
print/print-spec.json
```

UI : panneau **Impression & dorure** sur la page deck (`DeckPrintPanel.vue`).

## Fichiers clés

- `shared/utils/printSpec.ts` — constantes
- `server/utils/foilMask.ts` — extraction or chirurgicale
- `server/utils/cardRenderer.ts` — chrome faces, dos, foil, upscale
- `server/utils/printExport.ts` — ZIP
- `server/api/decks/[id]/back/generate.post.ts`
- `server/api/decks/[id]/exports/print.post.ts`
