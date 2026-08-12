# Salon cast (play avatars)

Gemini generates **full-body seated** references (`public/salon-cast/{id}.png`).  
Runtime avatars are **authored 3D volumes** (materials, hair, glasses, tuxedo, chair) — not a photo projection.

- Catalog: `shared/play/salonCharacters.ts`
- Identity / hair / pose: `app/utils/salonSculpt/specs.ts`
- Builder: `app/utils/salonSculpt/buildSculptedGuest.ts`

Preview (no auth): `/play/salon-cast`

```bash
node --env-file=.env scripts/generate-salon-characters.mjs
```
