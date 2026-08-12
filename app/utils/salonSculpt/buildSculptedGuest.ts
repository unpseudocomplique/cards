import * as THREE from 'three'
import { SculptKit } from './kit'
import type { HairStyle, SalonModelOptions, SalonSculptSpec } from './types'

type Mats = {
  skin: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
  silver: THREE.MeshStandardMaterial
  beard: THREE.MeshStandardMaterial
  suit: THREE.MeshStandardMaterial
  satin: THREE.MeshStandardMaterial
  shirt: THREE.MeshStandardMaterial
  bow: THREE.MeshStandardMaterial
  shoe: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  velvet: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  brow: THREE.MeshStandardMaterial
  lip: THREE.MeshStandardMaterial
  white: THREE.MeshStandardMaterial
  iris: THREE.MeshStandardMaterial
  pupil: THREE.MeshStandardMaterial
  catchlight: THREE.MeshStandardMaterial
}

function bowHex(style: SalonSculptSpec['bowTie']) {
  switch (style) {
    case 'white':
      return '#f4eee6'
    case 'burgundy':
      return '#6b1824'
    case 'gold_ornate':
      return '#c9a227'
    default:
      return '#121014'
  }
}

function makeMats(kit: SculptKit, spec: SalonSculptSpec): Mats {
  return {
    skin: kit.mat(spec.skin, { roughness: 0.58, metalness: 0.02 }),
    hair: kit.mat(spec.hair, { roughness: 0.72, metalness: 0.02 }),
    silver: kit.mat('#8a8680', { roughness: 0.7, metalness: 0.04 }),
    beard: kit.mat(spec.age > 0.45 ? '#6a6660' : spec.hair, { roughness: 0.72 }),
    suit: kit.mat(spec.suit, { roughness: 0.42, metalness: 0.08 }),
    satin: kit.mat('#0c0a10', { roughness: 0.22, metalness: 0.18 }),
    shirt: kit.mat(spec.shirt, { roughness: 0.68, metalness: 0.02 }),
    bow: kit.mat(bowHex(spec.bowTie), { roughness: 0.4, metalness: 0.06 }),
    shoe: kit.mat(spec.shoe, { roughness: 0.28, metalness: 0.22 }),
    wood: kit.mat('#4a2c18', { roughness: 0.58, metalness: 0.04 }),
    velvet: kit.mat('#7a1c28', { roughness: 0.82, metalness: 0 }),
    gold: kit.mat('#c4a35a', { roughness: 0.28, metalness: 0.72 }),
    brow: kit.mat(spec.browColor, { roughness: 0.7 }),
    lip: kit.mat(spec.lipColor, { roughness: 0.45 }),
    white: kit.mat('#f3eee6', { roughness: 0.32 }),
    iris: kit.mat(spec.eyeColor, { roughness: 0.22, side: THREE.DoubleSide }),
    pupil: kit.mat('#0a0806', { roughness: 0.18, side: THREE.DoubleSide }),
    catchlight: kit.mat('#fff6e8', {
      roughness: 0.12,
      emissive: '#fff4dc',
      emissiveIntensity: 0.9,
      side: THREE.DoubleSide
    })
  }
}

function addChair(kit: SculptKit, root: THREE.Group, mats: Mats, shadows: boolean) {
  const seat = kit.mesh(new THREE.BoxGeometry(0.7, 0.08, 0.58), mats.wood, [0, 0.46, 0.04], shadows)
  seat.name = 'chair-seat'
  root.add(seat)
  root.add(kit.mesh(new THREE.BoxGeometry(0.62, 0.07, 0.5), mats.velvet, [0, 0.53, 0.06], shadows))
  const back = kit.mesh(
    new THREE.BoxGeometry(0.64, 0.78, 0.09),
    mats.wood,
    [0, 0.98, -0.24],
    shadows,
    [0.08, 0, 0]
  )
  back.name = 'chair-back'
  root.add(back)
  root.add(kit.mesh(
    new THREE.BoxGeometry(0.56, 0.62, 0.06),
    mats.velvet,
    [0, 0.96, -0.18],
    shadows,
    [0.08, 0, 0]
  ))
  const crest = kit.mesh(new THREE.BoxGeometry(0.5, 0.1, 0.08), mats.wood, [0, 1.4, -0.28], shadows)
  crest.name = 'chair-crest'
  root.add(crest)
  root.add(kit.mesh(new THREE.SphereGeometry(0.035, 10, 8), mats.gold, [0, 1.46, -0.26], shadows))
  for (const sign of [-1, 1] as const) {
    const arm = kit.mesh(
      new THREE.BoxGeometry(0.09, 0.08, 0.5),
      mats.wood,
      [sign * 0.33, 0.68, 0.02],
      shadows
    )
    arm.name = `chair-arm-${sign < 0 ? 'l' : 'r'}`
    root.add(arm)
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.07, 0.04, 0.38),
      mats.velvet,
      [sign * 0.33, 0.74, 0.04],
      shadows
    ))
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 0.28, 10),
      mats.wood,
      [sign * 0.33, 0.56, -0.18],
      shadows
    ))
    for (const z of [-0.2, 0.2] as const) {
      root.add(kit.mesh(
        new THREE.CylinderGeometry(0.026, 0.036, 0.46, 10),
        mats.wood,
        [sign * 0.26, 0.23, z],
        shadows,
        [0.14, 0, sign * z > 0 ? 0.1 : -0.08]
      ))
    }
  }
}

function addHair(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean,
  hs: number
) {
  const style: HairStyle = spec.hairStyle
  const capMat = style === 'white_short' || style === 'bun_silver' ? mats.silver : mats.hair
  const fringe = kit.mesh(
    new THREE.SphereGeometry(0.145 * hs, 18, 14),
    capMat,
    [0, 0.06, -0.02],
    shadows,
    undefined,
    [spec.faceWidth * 1.06, 0.62, 1.02]
  )
  fringe.name = 'hair'
  head.add(fringe)

  if (style === 'salt_pepper' || spec.age > 0.5) {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      mats.silver,
      [-0.1 * hs, 0.02, 0.04],
      shadows,
      undefined,
      [1.1, 0.7, 0.8]
    ))
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      mats.silver,
      [0.1 * hs, 0.02, 0.04],
      shadows,
      undefined,
      [1.1, 0.7, 0.8]
    ))
  }
  if (style === 'updo') {
    head.add(kit.mesh(new THREE.SphereGeometry(0.09, 12, 10), mats.hair, [0, 0.16, -0.02], shadows))
  }
  if (style === 'bob') {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.14, 14, 12),
      mats.hair,
      [0, -0.04, -0.02],
      shadows,
      undefined,
      [1.15, 0.7, 1.1]
    ))
  }
  if (style === 'long_waves') {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.1, 12, 10),
      mats.hair,
      [0.08, -0.16, -0.04],
      shadows,
      undefined,
      [0.8, 1.6, 0.9]
    ))
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.1, 12, 10),
      mats.hair,
      [-0.08, -0.14, -0.05],
      shadows,
      undefined,
      [0.8, 1.5, 0.9]
    ))
  }
  if (style === 'bun_silver') {
    head.add(kit.mesh(new THREE.SphereGeometry(0.07, 12, 10), mats.silver, [0, 0.08, -0.12], shadows))
  }
  if (style === 'thick_dark') {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      mats.hair,
      [0, 0.06, 0.02],
      shadows,
      undefined,
      [1.15, 0.7, 1.05]
    ))
  }
}

function addFace(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean,
  hs: number
) {
  const eyeX = 0.046 * spec.faceWidth * hs
  const eyeY = 0.012
  const eyeZ = 0.11 * hs
  const eyeS = spec.eyeScale

  for (const sign of [-1, 1] as const) {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.022 * eyeS, 12, 10),
      mats.white,
      [sign * eyeX, eyeY, eyeZ],
      shadows,
      undefined,
      [1, 0.85, 0.7]
    ))
    head.add(kit.mesh(
      new THREE.CircleGeometry(0.013 * eyeS, 14),
      mats.iris,
      [sign * eyeX, eyeY, eyeZ + 0.016],
      shadows
    ))
    head.add(kit.mesh(
      new THREE.CircleGeometry(0.006 * eyeS, 10),
      mats.pupil,
      [sign * eyeX, eyeY, eyeZ + 0.018],
      shadows
    ))
    head.add(kit.mesh(
      new THREE.CircleGeometry(0.003, 8),
      mats.catchlight,
      [sign * eyeX - 0.005, eyeY + 0.005, eyeZ + 0.02],
      shadows
    ))
    head.add(kit.mesh(
      new THREE.BoxGeometry(0.038 * eyeS, 0.007, 0.01),
      mats.brow,
      [sign * eyeX, eyeY + 0.028, eyeZ + 0.01],
      shadows,
      [0, 0, sign * -0.12]
    ))
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.028 * hs, 10, 8),
      mats.skin,
      [sign * 0.13 * spec.faceWidth * hs, -0.01, 0.01],
      shadows,
      undefined,
      [0.55, 1.1, 0.7]
    ))
  }

  head.add(kit.mesh(
    new THREE.SphereGeometry(0.028 * spec.noseScale * hs, 10, 8),
    mats.skin,
    [0, -0.018, 0.12 * hs],
    shadows,
    undefined,
    [0.7, 1.05, 1.15]
  ))
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.022, 10, 8),
    mats.lip,
    [0, -0.055, 0.108 * hs],
    shadows,
    undefined,
    [1.35, 0.45, 0.7]
  ))
}

function addBeard(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean,
  hs: number
) {
  if (spec.facialHair === 'none') {
    return
  }
  const hair = mats.beard
  if (spec.facialHair === 'handlebar') {
    head.add(kit.mesh(
      new THREE.TorusGeometry(0.028, 0.007, 8, 16, Math.PI),
      hair,
      [-0.04, -0.048, 0.1],
      shadows,
      [Math.PI / 2, 0.4, 0]
    ))
    head.add(kit.mesh(
      new THREE.TorusGeometry(0.028, 0.007, 8, 16, Math.PI),
      hair,
      [0.04, -0.048, 0.1],
      shadows,
      [Math.PI / 2, -0.4, 0]
    ))
    return
  }
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.09 * hs, 12, 10),
    hair,
    [0, -0.08, 0.04],
    shadows,
    undefined,
    [spec.jawWidth * 1.05, spec.facialHair === 'short_beard' ? 0.55 : 0.85, 0.9]
  ))
  head.add(kit.mesh(
    new THREE.BoxGeometry(0.07, 0.018, 0.03),
    hair,
    [0, -0.04, 0.12 * hs],
    shadows
  ))
}

function addGlasses(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean,
  hs: number
) {
  if (spec.glasses === 'none') {
    return
  }
  const r = spec.glasses === 'round' ? 0.028 : 0.026
  const tube = spec.glasses === 'round' ? 0.0032 : 0.0028
  for (const sign of [-1, 1] as const) {
    const rim = kit.mesh(
      new THREE.TorusGeometry(r, tube, 8, 20),
      mats.gold,
      [sign * 0.046 * spec.faceWidth * hs, 0.012, 0.128 * hs],
      shadows
    )
    rim.name = sign < 0 ? 'glasses-l' : 'glasses-r'
    head.add(rim)
    head.add(kit.mesh(
      new THREE.CylinderGeometry(tube, tube, 0.08, 6),
      mats.gold,
      [sign * 0.1 * hs, 0.01, 0.04],
      shadows,
      [0.15, sign * 0.55, 0]
    ))
  }
  head.add(kit.mesh(
    new THREE.CylinderGeometry(0.0026, 0.0026, 0.03, 6),
    mats.gold,
    [0, 0.016, 0.128 * hs],
    shadows,
    [0, 0, Math.PI / 2]
  ))
}

function addHead(
  kit: SculptKit,
  root: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean
) {
  const hs = spec.headScale
  const head = new THREE.Group()
  head.position.set(0, 1.28, 0.08)
  const skull = kit.mesh(
    new THREE.SphereGeometry(0.132 * hs, 28, 22),
    mats.skin,
    [0, 0, 0],
    shadows,
    undefined,
    [spec.faceWidth, 1.12, 0.98]
  )
  skull.name = 'head'
  head.add(skull)
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.1 * hs, 16, 12),
    mats.skin,
    [0, -0.06, 0.02],
    shadows,
    undefined,
    [spec.jawWidth * 0.95, 0.7, 0.85]
  ))
  addFace(kit, head, spec, mats, shadows, hs)
  addHair(kit, head, spec, mats, shadows, hs)
  addBeard(kit, head, spec, mats, shadows, hs)
  addGlasses(kit, head, spec, mats, shadows, hs)
  if (spec.earrings !== 'none') {
    for (const sign of [-1, 1] as const) {
      const geo = spec.earrings === 'hoop'
        ? new THREE.TorusGeometry(0.012, 0.0025, 6, 12)
        : new THREE.SphereGeometry(0.008, 8, 6)
      head.add(kit.mesh(geo, mats.gold, [sign * 0.13 * hs, -0.04, 0.02], shadows))
    }
  }
  if (spec.hairOrnament === 'laurel') {
    head.add(kit.mesh(
      new THREE.TorusGeometry(0.12 * hs, 0.008, 6, 18, Math.PI),
      mats.gold,
      [0, 0.08, 0.02],
      shadows,
      [0.4, 0, 0]
    ))
  }
  root.add(head)
}

function addOutfit(
  kit: SculptKit,
  root: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean,
  sw: number,
  feminine: boolean
) {
  const jacketH = feminine ? 0.46 : 0.52
  const torso = kit.mesh(
    new THREE.CylinderGeometry(0.15 * sw, 0.19 * sw, jacketH, 18),
    mats.suit,
    [0, 0.86, 0.04],
    shadows,
    undefined,
    [1, 1, spec.torsoDepth]
  )
  torso.name = 'torso'
  root.add(torso)
  root.add(kit.mesh(
    new THREE.SphereGeometry(0.17 * sw, 14, 12),
    mats.suit,
    [0, 1.08, 0.03],
    shadows,
    undefined,
    [1.2, 0.5, spec.torsoDepth]
  ))

  if (spec.collar !== 'vneck') {
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.12 * sw, 0.16, 0.04),
      mats.shirt,
      [0, 0.92, 0.14 * spec.torsoDepth],
      shadows
    ))
    for (const sign of [-1, 1] as const) {
      root.add(kit.mesh(
        new THREE.BoxGeometry(0.05, 0.07, 0.03),
        mats.shirt,
        [sign * 0.04, 1.1, 0.12],
        shadows,
        [0.15, 0, sign * 0.35]
      ))
    }
  }

  if (spec.outfit !== 'evening_dress') {
    for (const sign of [-1, 1] as const) {
      root.add(kit.mesh(
        new THREE.BoxGeometry(0.07, 0.22, 0.02),
        mats.satin,
        [sign * 0.05, 0.96, 0.155 * spec.torsoDepth],
        shadows,
        [0.12, 0, sign * 0.45]
      ))
    }
  }

  if (spec.bowTie !== 'none') {
    root.add(kit.mesh(new THREE.SphereGeometry(0.018, 10, 8), mats.bow, [0, 1.06, 0.16], shadows))
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.07, 0.035, 0.02),
      mats.bow,
      [-0.04, 1.06, 0.155],
      shadows,
      [0, 0, 0.35]
    ))
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.07, 0.035, 0.02),
      mats.bow,
      [0.04, 1.06, 0.155],
      shadows,
      [0, 0, -0.35]
    ))
  }

  if (spec.scarf) {
    root.add(kit.mesh(
      new THREE.TorusGeometry(0.09, 0.022, 8, 18),
      kit.mat(spec.accent, { roughness: 0.7 }),
      [0, 1.14, 0.05],
      shadows,
      [1.15, 0, 0]
    ))
  }

  if (spec.pinStyle !== 'none') {
    root.add(kit.mesh(new THREE.SphereGeometry(0.012, 10, 8), mats.gold, [0.08, 0.98, 0.16], shadows))
  }
}

/** Seated salon guest sculpted as authored volumes — no photo projection. */
export function buildSculptedGuest(spec: SalonSculptSpec, options: SalonModelOptions = {}) {
  const shadows = options.shadows ?? false
  const kit = new SculptKit()
  const root = new THREE.Group()
  root.name = `salon-${spec.id}`
  const mats = makeMats(kit, spec)
  const sw = spec.shoulderWidth
  const hw = spec.hipWidth
  const feminine = spec.build === 'feminine'

  addChair(kit, root, mats, shadows)

  const hips = kit.mesh(
    new THREE.SphereGeometry(0.15, 16, 14),
    spec.outfit === 'evening_dress' ? mats.suit : mats.suit,
    [0, 0.56, 0.08],
    shadows,
    undefined,
    [1.2 * hw, 0.7, 1.05]
  )
  hips.name = 'hips'
  root.add(hips)

  if (spec.outfit === 'evening_dress') {
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.14 * hw, 0.28 * hw, 0.48, 16),
      mats.suit,
      [0, 0.38, 0.1],
      shadows
    ))
  }

  addOutfit(kit, root, spec, mats, shadows, sw, feminine)

  const neck = kit.mesh(
    new THREE.CylinderGeometry(0.05 * spec.headScale, 0.06 * spec.headScale, 0.09, 12),
    mats.skin,
    [0, 1.17, 0.06],
    shadows
  )
  neck.name = 'neck'
  root.add(neck)
  addHead(kit, root, spec, mats, shadows)

  const trouser = spec.outfit === 'evening_dress' ? mats.suit : mats.suit
  for (const sign of [-1, 1] as const) {
    const hip: [number, number, number] = [sign * 0.1 * hw, 0.54, 0.1]
    const knee: [number, number, number] = [sign * 0.12 * hw, 0.33, 0.34]
    const ankle: [number, number, number] = [sign * 0.12 * hw, 0.08, 0.44]
    const thigh = kit.limb(root, trouser, hip, knee, 0.072, shadows, 12)
    thigh.name = sign < 0 ? 'thigh-l' : 'thigh-r'
    const shin = kit.limb(root, trouser, knee, ankle, 0.052, shadows, 12)
    shin.name = sign < 0 ? 'shin-l' : 'shin-r'
    const foot = kit.mesh(
      new THREE.BoxGeometry(0.11, 0.045, 0.22),
      mats.shoe,
      [ankle[0], 0.045, ankle[2] + 0.07],
      shadows
    )
    foot.name = sign < 0 ? 'foot-l' : 'foot-r'
    root.add(foot)

    const shoulder: [number, number, number] = [sign * 0.2 * sw, 1.08, 0.04]
    const elbow: [number, number, number] = [sign * 0.2 * sw, 0.78, 0.2]
    const wrist: [number, number, number] = [sign * 0.12 * sw, 0.58, 0.3]
    const sleeve = kit.limb(root, mats.suit, shoulder, elbow, 0.058, shadows, 12)
    sleeve.name = sign < 0 ? 'upper-arm-l' : 'upper-arm-r'
    const cuff = kit.limb(root, mats.shirt, elbow, wrist, 0.042, shadows, 12)
    cuff.name = sign < 0 ? 'forearm-l' : 'forearm-r'
    const hand = kit.mesh(
      new THREE.SphereGeometry(0.046, 12, 10),
      mats.skin,
      wrist,
      shadows,
      undefined,
      [1.15, 0.65, 1.35]
    )
    hand.name = sign < 0 ? 'hand-l' : 'hand-r'
    root.add(hand)
  }

  root.userData.sculptRuntime = {
    characterId: spec.id,
    likeness: {
      source: spec.portraitUrl,
      mode: 'authored-volumes'
    },
    dispose: () => kit.dispose()
  }
  return root
}

/** @deprecated Use buildSculptedGuest — kept so existing factories keep compiling during the swap. */
export const buildLikenessGuest = buildSculptedGuest
