# Salon cast (play avatars)

## Base cast (10 factories)

AI portraits: `public/salon-cast/*.png`  
Catalog: `shared/play/salonCharacters.ts`  
Sculpt specs: `app/utils/salonSculpt/specs.ts`  
Factories (img2threejs-style seated guests):

| ID | Factory |
| --- | --- |
| aurelien | `createAurelienModel` |
| camille | `createCamilleModel` |
| hassan | `createHassanModel` |
| ines | `createInesModel` |
| julien | `createJulienModel` |
| lea | `createLeaModel` |
| marco | `createMarcoModel` |
| nadege | `createNadegeModel` |
| olivier | `createOlivierModel` |
| sofia | `createSofiaModel` |

Registry: `app/components/play/tres/salon-cast/index.ts`  
Runtime mount: `PlayTresSalonAvatar` ← `RoomAmbiance`

Each factory builds a **seated** body with unique proportions / hair / outfit, and projects the portrait onto the **head mesh** (likeness albedo — no floating face disc). Skill checkout: `.agents/skills/img2threejs`.

Regenerate portraits:

```bash
node --env-file=.env scripts/generate-salon-characters.mjs
```

## Next: user play avatar

1. `POST /api/user/play-avatar` — scaffold done.
2. Cycle 3 bake: likeness pass → optional `generativeAssist` GLB.
3. Schema: `playAvatarPrompt`, `playAvatarGlbUrl`, `playAvatarStatus`.
4. If seated human has GLB URL, load GLTF; else salon cast factory.
