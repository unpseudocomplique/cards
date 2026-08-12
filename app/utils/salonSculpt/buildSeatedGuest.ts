import * as THREE from 'three'
import { buildHead, type Mats } from './buildHead'
import { SculptKit } from './kit'
import type { SalonModelOptions, SalonSculptSpec } from './types'

function addHand(
  kit: SculptKit,
  root: THREE.Group,
  spec: SalonSculptSpec,
  skin: THREE.Material,
  sign: number,
  wrist: [number, number, number],
  shadows: boolean
) {
  const g = new THREE.Group()
  g.position.set(...wrist)
  g.rotation.set(0.25, 0, sign * 0.12)
  g.add(kit.mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    skin,
    [0, 0, 0],
    shadows,
    undefined,
    [1.1, 0.7, 1.3]
  ))
  for (let i = 0; i < 4; i++) {
    const fx = (i - 1.5) * 0.028
    g.add(kit.mesh(
      new THREE.CylinderGeometry(0.01, 0.012, 0.09, 6),
      skin,
      [fx, 0.0, 0.07],
      shadows,
      [1.15, 0, 0]
    ))
  }
  g.add(kit.mesh(
    new THREE.CylinderGeometry(0.011, 0.013, 0.06, 6),
    skin,
    [sign * -0.04, 0.01, 0.03],
    shadows,
    [0.8, sign * 0.8, 0.4]
  ))
  root.add(g)
}

function addBowTie(
  kit: SculptKit,
  root: THREE.Group,
  spec: SalonSculptSpec,
  gold: THREE.Material,
  shadows: boolean
) {
  if (spec.bowTie === 'none') {
    return
  }
  const color = spec.bowTie === 'white'
    ? '#f4efe6'
    : spec.bowTie === 'burgundy'
      ? '#6b2438'
      : spec.bowTie === 'gold_ornate'
        ? spec.accent
        : '#121014'
  const mat = spec.bowTie === 'gold_ornate'
    ? gold
    : kit.mat(color, { roughness: spec.bowTie === 'white' ? 0.45 : 0.4, metalness: spec.bowTie === 'gold_ornate' ? 0.85 : 0.08 })
  const y = 1.42
  const z = 0.26
  root.add(kit.mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), mat, [0, y, z], shadows))
  root.add(kit.mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    mat,
    [-0.08, y, z],
    shadows,
    [0, 0, 0.35],
    [1.4, 0.7, 0.35]
  ))
  root.add(kit.mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    mat,
    [0.08, y, z],
    shadows,
    [0, 0, -0.35],
    [1.4, 0.7, 0.35]
  ))
}

function addScarf(
  kit: SculptKit,
  root: THREE.Group,
  spec: SalonSculptSpec,
  gold: THREE.Material,
  shadows: boolean
) {
  if (!spec.scarf) {
    return
  }
  const silk = kit.mat(spec.accent, { roughness: 0.28, metalness: 0.35 })
  root.add(kit.mesh(
    new THREE.TorusGeometry(0.15, 0.04, 10, 24),
    silk,
    [0, 1.4, 0.06],
    shadows,
    [1.05, 0, 0]
  ))
  root.add(kit.mesh(
    kit.tube([[0.08, 1.38, 0.16], [0.12, 1.18, 0.2], [0.1, 0.95, 0.18]], 0.028, 8, 6),
    silk,
    [0, 0, 0],
    shadows
  ))
  if (spec.id === 'nadege') {
    root.add(kit.mesh(
      new THREE.TorusGeometry(0.2, 0.012, 8, 24),
      gold,
      [0, 1.38, 0.08],
      false,
      [1.0, 0, 0]
    ))
  }
}

function addPin(
  kit: SculptKit,
  root: THREE.Group,
  spec: SalonSculptSpec,
  gold: THREE.Material,
  shadows: boolean
) {
  if (spec.pinStyle === 'none') {
    return
  }
  const p: [number, number, number] = [0.2, 1.22, 0.22]
  if (spec.pinStyle === 'compass') {
    const g = new THREE.Group()
    g.position.set(...p)
    g.add(kit.mesh(new THREE.CircleGeometry(0.045, 8), gold, [0, 0, 0], shadows))
    g.add(kit.mesh(
      new THREE.SphereGeometry(0.016, 10, 8),
      kit.mat('#8a1828', { roughness: 0.25, metalness: 0.4, emissive: '#4a0810', emissiveIntensity: 0.25 }),
      [0, 0, 0.012],
      false
    ))
    root.add(g)
    return
  }
  if (spec.pinStyle === 'eye') {
    const g = new THREE.Group()
    g.position.set(...p)
    g.add(kit.mesh(new THREE.CircleGeometry(0.04, 12), gold, [0, 0, 0], shadows))
    g.add(kit.mesh(
      new THREE.SphereGeometry(0.014, 10, 8),
      kit.mat('#1a100c', { roughness: 0.4, metalness: 0.1 }),
      [0, 0, 0.01],
      false
    ))
    root.add(g)
    return
  }
  if (spec.pinStyle === 'filigree') {
    root.add(kit.mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 16), gold, p, shadows))
    root.add(kit.mesh(new THREE.SphereGeometry(0.016, 10, 8), gold, [p[0], p[1], p[2] + 0.01], shadows))
    return
  }
  root.add(kit.mesh(
    new THREE.SphereGeometry(0.035, 12, 12),
    kit.mat(spec.accent, { metalness: 0.95, roughness: 0.22, emissive: spec.accent, emissiveIntensity: 0.2 }),
    p,
    shadows
  ))
}

function addChair(kit: SculptKit, root: THREE.Group, spec: SalonSculptSpec, shadows: boolean) {
  const wood = kit.mat('#5a3220', { roughness: 0.58, metalness: 0.06 })
  const woodDark = kit.mat('#3a2014', { roughness: 0.55, metalness: 0.05 })
  const velvet = kit.mat('#4a1824', { roughness: 0.72, metalness: 0.04 })
  const gold = kit.mat(spec.accent, { roughness: 0.28, metalness: 0.9 })
  const chair = new THREE.Group()
  chair.name = 'chair'
  chair.add(kit.mesh(new THREE.BoxGeometry(0.92, 0.1, 0.82), wood, [0, 0.46, 0.04], shadows))
  chair.add(kit.mesh(
    new THREE.BoxGeometry(0.84, 0.08, 0.74),
    velvet,
    [0, 0.54, 0.06],
    shadows
  ))
  chair.add(kit.mesh(new THREE.BoxGeometry(0.9, 1.28, 0.1), wood, [0, 1.18, -0.38], shadows))
  chair.add(kit.mesh(
    new THREE.BoxGeometry(0.78, 0.9, 0.06),
    velvet,
    [0, 1.2, -0.32],
    shadows
  ))
  chair.add(kit.mesh(new THREE.BoxGeometry(0.96, 0.07, 0.12), gold, [0, 1.84, -0.38], false))
  for (const [x, z] of [[-0.36, 0.3], [0.36, 0.3], [-0.36, -0.26], [0.36, -0.26]] as const) {
    chair.add(kit.mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.46, 10), woodDark, [x, 0.22, z], shadows))
    chair.add(kit.mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 12), gold, [x, 0.4, z], false, [Math.PI / 2, 0, 0]))
  }
  root.add(chair)
}

/**
 * Procedural seated salon guest — sculpted head, lock hair, layered clothes.
 * Identity is geometry + PBR, not a portrait pasted on a mannequin.
 */
export function buildSalonSeatedGuest(
  spec: SalonSculptSpec,
  options: SalonModelOptions = {}
): THREE.Group {
  const shadows = options.shadows ?? false
  const kit = new SculptKit()
  const root = new THREE.Group()
  root.name = `salon-${spec.id}`

  const hs = spec.headScale
  const sw = spec.shoulderWidth
  const td = spec.torsoDepth
  const hw = spec.hipWidth
  const feminine = spec.build === 'feminine'
  const velvet = spec.outfit === 'velvet_jacket' || spec.outfit === 'dinner_jacket'

  const skin = kit.mat(spec.skin, { roughness: 0.58, metalness: 0 })
  const hair = kit.mat(spec.hair, { roughness: 0.62, metalness: 0.04 })
  const beard = kit.mat(spec.hair, { roughness: 0.7, metalness: 0.02 })
  const suit = kit.mat(spec.suit, {
    roughness: velvet ? 0.72 : 0.42,
    metalness: velvet ? 0.04 : 0.1
  })
  const shirt = kit.mat(spec.shirt, { roughness: spec.collar === 'blouse' ? 0.38 : 0.55, metalness: 0 })
  const shoe = kit.mat(spec.shoe, { roughness: 0.38, metalness: 0.18 })
  const gold = kit.mat(spec.accent, { roughness: 0.26, metalness: 0.92 })
  const mats: Mats = {
    skin,
    hair,
    beard,
    eyeWhite: kit.mat('#f4f0ea', { roughness: 0.22, metalness: 0 }),
    iris: kit.mat(spec.eyeColor, { roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide }),
    pupil: kit.mat('#0a0806', { roughness: 0.35, metalness: 0, side: THREE.DoubleSide }),
    catchlight: kit.mat('#fff6e8', { roughness: 0.15, metalness: 0, emissive: '#fff6e8', emissiveIntensity: 0.85 }),
    lip: kit.mat(spec.lipColor, { roughness: 0.42, metalness: 0.04 }),
    brow: kit.mat(spec.browColor, { roughness: 0.7, metalness: 0 }),
    gold,
    glass: kit.mat('#c8d8e8', { roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  }

  addChair(kit, root, spec, shadows)

  // img2threejs character tree, seated 8-head compression (crown ~1.45)
  const hip: [number, number, number] = [0, 0.54, 0.06]
  const chestY = 0.96
  const shoulderY = 1.14
  const headY = 1.34

  const hips = kit.mesh(
    new THREE.SphereGeometry(0.16, 14, 12),
    suit,
    hip,
    shadows,
    undefined,
    [1.25 * hw, 0.85, 1.1 * td]
  )
  root.add(hips)

  if (spec.outfit === 'evening_dress') {
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.22 * hw, 0.42 * hw, 0.62, 16),
      suit,
      [0, 0.42, 0.08],
      shadows
    ))
  }

  for (const sign of [-1, 1]) {
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.46, 10),
      suit,
      [sign * 0.15 * hw, 0.42, 0.28],
      shadows,
      [1.12, 0, sign * 0.06]
    ))
    root.add(kit.mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      suit,
      [sign * 0.18 * hw, 0.28, 0.52],
      shadows
    ))
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.075, 0.085, 0.4, 10),
      suit,
      [sign * 0.19 * hw, 0.18, 0.68],
      shadows,
      [1.25, 0, 0]
    ))
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.14, 0.07, 0.26),
      shoe,
      [sign * 0.19 * hw, 0.06, 0.88],
      shadows
    ))
    root.add(kit.mesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      shoe,
      [sign * 0.19 * hw, 0.05, 1.0],
      shadows,
      undefined,
      [1.2, 0.7, 1.1]
    ))
  }

  // Torso — tapered cylinder, not a box
  const torsoH = feminine ? 0.58 : 0.64
  const torso = kit.mesh(
    new THREE.CylinderGeometry(0.2 * sw, 0.24 * sw, torsoH, 14),
    suit,
    [0, 0.98, 0.02],
    shadows
  )
  root.add(torso)
  root.add(kit.mesh(
    new THREE.SphereGeometry(0.24 * sw, 14, 12),
    suit,
    [0, 1.28, 0.0],
    shadows,
    undefined,
    [1.2, 0.58, 0.98 * td]
  ))

  // Shirt / collar
  if (spec.collar !== 'vneck') {
    root.add(kit.mesh(new THREE.BoxGeometry(0.14, 0.38, 0.06), shirt, [0, 1.12, 0.155], shadows))
  }
  if (spec.collar === 'wing' || spec.collar === 'shirt' || spec.collar === 'blouse') {
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.03),
      shirt,
      [-0.06, 1.4, 0.18],
      shadows,
      [0.2, 0.4, 0.3]
    ))
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.03),
      shirt,
      [0.06, 1.4, 0.18],
      shadows,
      [0.2, -0.4, -0.3]
    ))
  }
  if (spec.outfit !== 'evening_dress') {
    // Peak lapels
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.14, 0.42, 0.035),
      suit,
      [-0.12 * sw, 1.14, 0.16],
      shadows,
      [0.05, 0.15, 0.35]
    ))
    root.add(kit.mesh(
      new THREE.BoxGeometry(0.14, 0.42, 0.035),
      suit,
      [0.12 * sw, 1.14, 0.16],
      shadows,
      [0.05, -0.15, -0.35]
    ))
    // Buttons
    for (const by of [1.18, 1.05, 0.92]) {
      root.add(kit.mesh(new THREE.SphereGeometry(0.012, 8, 8), gold, [0, by, 0.19], false))
    }
  }

  // Neck
  root.add(kit.mesh(
    new THREE.CylinderGeometry(0.08 * hs, 0.1 * hs, 0.16, 12),
    skin,
    [0, 1.52, 0.04],
    shadows
  ))

  // Arms resting forward — overlapping capsules so joints read as one limb
  for (const sign of [-1, 1]) {
    const sx = sign * 0.28 * sw
    root.add(kit.mesh(new THREE.SphereGeometry(0.12, 12, 12), suit, [sx, 1.3, 0.02], shadows))
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.42, 10),
      suit,
      [sx + sign * 0.06, 1.08, 0.16],
      shadows,
      [0.95, 0, sign * 0.12]
    ))
    root.add(kit.mesh(new THREE.SphereGeometry(0.08, 10, 8), suit, [sx + sign * 0.08, 0.84, 0.38], shadows))
    root.add(kit.mesh(
      new THREE.CylinderGeometry(0.065, 0.078, 0.36, 10),
      suit,
      [sx + sign * 0.05, 0.7, 0.54],
      shadows,
      [1.05, sign * 0.04, 0]
    ))
    root.add(kit.mesh(
      new THREE.TorusGeometry(0.06, 0.012, 8, 12),
      shirt,
      [sx + sign * 0.03, 0.6, 0.68],
      false,
      [1.05, 0, 0]
    ))
    addHand(kit, root, spec, skin, sign, [sx + sign * 0.03, 0.6, 0.68], shadows)
  }

  addBowTie(kit, root, spec, gold, shadows)
  addScarf(kit, root, spec, gold, shadows)
  addPin(kit, root, spec, gold, shadows)

  const head = buildHead(kit, spec, mats, shadows)
  head.position.set(0, 1.78, 0.05)
  root.add(head)

  root.userData.sculptRuntime = {
    characterId: spec.id,
    pivots: { root, head, torso, hips },
    dispose: () => kit.dispose()
  }

  return root
}
