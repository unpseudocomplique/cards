import * as THREE from 'three'
import type { HairStyle, SalonModelOptions, SalonSculptSpec } from './types'
import { loadLikenessAlbedo } from './likenessTexture'

function mat(color: string, extras: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.05,
    ...extras,
  })
}

function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  shadows: boolean,
  rotation?: [number, number, number],
  scale?: [number, number, number],
) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(...position)
  if (rotation) {
    m.rotation.set(...rotation)
  }
  if (scale) {
    m.scale.set(...scale)
  }
  m.castShadow = shadows
  m.receiveShadow = shadows
  return m
}

function addHair(
  head: THREE.Group,
  style: HairStyle,
  hairMat: THREE.Material,
  shadows: boolean,
  headScale: number,
) {
  const s = headScale
  const scalp = mesh(
    new THREE.SphereGeometry(0.24 * s, 18, 14),
    hairMat,
    [0, 0.12 * s, -0.02 * s],
    shadows,
    undefined,
    [1.08, 0.72, 1.1],
  )
  head.add(scalp)

  const lock = (pos: [number, number, number], sc: [number, number, number], rot?: [number, number, number]) => {
    head.add(mesh(new THREE.SphereGeometry(0.12 * s, 12, 10), hairMat, pos, shadows, rot, sc))
  }

  switch (style) {
    case 'bob':
      lock([-0.16 * s, 0.02 * s, 0.08 * s], [0.9, 1.1, 0.7])
      lock([0.16 * s, 0.02 * s, 0.08 * s], [0.9, 1.1, 0.7])
      lock([0, -0.02 * s, -0.14 * s], [1.25, 1.15, 0.85])
      lock([-0.1 * s, 0.08 * s, 0.16 * s], [0.7, 0.55, 0.45], [0.2, 0, 0])
      break
    case 'updo':
      lock([0, 0.22 * s, -0.04 * s], [1.15, 1.0, 1.0])
      lock([-0.12 * s, 0.1 * s, 0.12 * s], [0.65, 0.7, 0.55])
      lock([0.14 * s, 0.08 * s, 0.1 * s], [0.55, 0.65, 0.5])
      break
    case 'bun_silver':
      lock([0, 0.26 * s, -0.06 * s], [0.85, 0.75, 0.85])
      lock([0, 0.14 * s, -0.12 * s], [1.1, 0.7, 0.9])
      lock([-0.08 * s, 0.05 * s, 0.14 * s], [0.45, 0.4, 0.35])
      break
    case 'long_waves':
      lock([-0.2 * s, -0.05 * s, 0.02 * s], [0.7, 1.6, 0.65])
      lock([0.2 * s, -0.05 * s, 0.02 * s], [0.7, 1.6, 0.65])
      lock([-0.12 * s, -0.18 * s, -0.05 * s], [0.55, 1.4, 0.5])
      lock([0.12 * s, -0.18 * s, -0.05 * s], [0.55, 1.4, 0.5])
      lock([0, 0.18 * s, 0.1 * s], [1.1, 0.55, 0.7])
      break
    case 'natural_short':
      lock([0, 0.1 * s, 0], [1.2, 0.85, 1.15])
      lock([-0.1 * s, 0.06 * s, 0.1 * s], [0.55, 0.5, 0.5])
      lock([0.1 * s, 0.06 * s, 0.1 * s], [0.55, 0.5, 0.5])
      break
    case 'thick_dark':
      lock([0, 0.14 * s, -0.02 * s], [1.25, 0.9, 1.2])
      lock([-0.14 * s, 0.04 * s, 0.08 * s], [0.7, 0.85, 0.6])
      lock([0.14 * s, 0.04 * s, 0.08 * s], [0.7, 0.85, 0.6])
      lock([0, 0.02 * s, -0.16 * s], [1.1, 0.9, 0.7])
      break
    case 'white_short':
      lock([0, 0.1 * s, -0.02 * s], [1.15, 0.7, 1.1])
      lock([0, 0.05 * s, -0.14 * s], [1.0, 0.65, 0.7])
      break
    case 'salt_pepper':
      lock([0, 0.1 * s, -0.02 * s], [1.12, 0.68, 1.08])
      lock([-0.08 * s, 0.02 * s, 0.12 * s], [0.45, 0.4, 0.35])
      lock([0.08 * s, 0.02 * s, 0.12 * s], [0.45, 0.4, 0.35])
      break
    case 'cropped_beard':
      lock([0, 0.08 * s, -0.02 * s], [1.1, 0.65, 1.05])
      break
    case 'short_slick':
    default:
      lock([0, 0.1 * s, -0.04 * s], [1.15, 0.65, 1.12])
      lock([0, 0.02 * s, -0.14 * s], [1.0, 0.7, 0.65])
      break
  }
}

function addAccessory(
  root: THREE.Group,
  spec: SalonSculptSpec,
  accentMat: THREE.Material,
  headY: number,
  shadows: boolean,
) {
  const a = spec.accessory
  if (a === 'glasses') {
    const g = new THREE.Group()
    g.position.set(0, headY + 0.02, 0.22 * spec.headScale)
    const rim = mat(spec.accent, { metalness: 0.9, roughness: 0.28 })
    g.add(mesh(new THREE.TorusGeometry(0.06 * spec.headScale, 0.01, 8, 16), rim, [-0.08 * spec.headScale, 0, 0], false))
    g.add(mesh(new THREE.TorusGeometry(0.06 * spec.headScale, 0.01, 8, 16), rim, [0.08 * spec.headScale, 0, 0], false))
    g.add(mesh(new THREE.BoxGeometry(0.05 * spec.headScale, 0.012, 0.012), rim, [0, 0, 0], false))
    root.add(g)
  }
  if (a === 'bow') {
    root.add(mesh(new THREE.BoxGeometry(0.22, 0.08, 0.04), accentMat, [0, 1.42, 0.24], shadows))
    root.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), accentMat, [-0.1, 1.42, 0.25], shadows, [0, 0, 0.35]))
    root.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), accentMat, [0.1, 1.42, 0.25], shadows, [0, 0, -0.35]))
  }
  if (a === 'scarf') {
    root.add(mesh(new THREE.TorusGeometry(0.16, 0.045, 10, 24), accentMat, [0, 1.4, 0.08], shadows, [0.9, 0, 0]))
    root.add(mesh(new THREE.BoxGeometry(0.12, 0.35, 0.05), accentMat, [0.12, 1.2, 0.18], shadows, [0.2, 0, 0.15]))
  }
  if (a === 'pin') {
    root.add(mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      mat(spec.accent, { metalness: 0.95, roughness: 0.22, emissive: spec.accent, emissiveIntensity: 0.25 }),
      [0.2, 1.22, 0.22],
      shadows,
    ))
  }
}

/**
 * Shared seated guest builder — anatomy in head-units, likeness on head mesh
 * (no floating face disc). Each cast factory passes a unique SalonSculptSpec.
 */
export async function buildSalonSeatedGuest(
  spec: SalonSculptSpec,
  options: SalonModelOptions = {},
): Promise<THREE.Group> {
  const shadows = options.shadows ?? false
  const root = new THREE.Group()
  root.name = `salon-${spec.id}`

  const hs = spec.headScale
  const sw = spec.shoulderWidth
  const td = spec.torsoDepth
  const hw = spec.hipWidth
  const feminine = spec.build === 'feminine'

  const skinMat = mat(spec.skin, { roughness: 0.62, metalness: 0 })
  const hairMat = mat(spec.hair, { roughness: 0.82, metalness: 0 })
  const suitMat = mat(spec.suit, { roughness: 0.48, metalness: 0.08 })
  const shirtMat = mat(spec.shirt, { roughness: 0.55, metalness: 0 })
  const shoeMat = mat(spec.shoe, { roughness: 0.4, metalness: 0.15 })
  const accentMat = mat(spec.accent, { roughness: 0.3, metalness: 0.85 })
  const woodMat = mat('#6a3a24', { roughness: 0.65, metalness: 0.04 })
  const woodDark = mat('#4a2818', { roughness: 0.55, metalness: 0.05 })

  // Chair
  const chair = new THREE.Group()
  chair.name = 'chair'
  chair.add(mesh(new THREE.BoxGeometry(0.95, 0.12, 0.85), woodMat, [0, 0.48, 0.05], shadows))
  chair.add(mesh(new THREE.BoxGeometry(0.95, 1.35, 0.12), mat('#7a4528', { roughness: 0.45, metalness: 0.06 }), [0, 1.15, -0.38], shadows))
  chair.add(mesh(new THREE.BoxGeometry(1.0, 0.08, 0.14), accentMat, [0, 1.82, -0.38], false))
  for (const [x, , z] of [
    [-0.38, 0, 0.32],
    [0.38, 0, 0.32],
    [-0.38, 0, -0.28],
    [0.38, 0, -0.28],
  ] as const) {
    chair.add(mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.44, 8), woodDark, [x, 0.22, z], shadows))
  }
  root.add(chair)

  // Lower body (seated)
  const hips = mesh(
    new THREE.BoxGeometry(0.55 * hw, 0.22, 0.42 * td),
    suitMat,
    [0, 0.58, 0.08],
    shadows,
  )
  root.add(hips)

  for (const sign of [-1, 1]) {
    root.add(mesh(
      new THREE.CylinderGeometry(0.1, 0.11, 0.42, 10),
      suitMat,
      [sign * 0.16 * hw, 0.38, 0.28],
      shadows,
      [1.15, 0, sign * 0.08],
    ))
    root.add(mesh(
      new THREE.CylinderGeometry(0.085, 0.09, 0.38, 10),
      suitMat,
      [sign * 0.2 * hw, 0.22, 0.58],
      shadows,
      [1.35, 0, 0],
    ))
    root.add(mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.28),
      shoeMat,
      [sign * 0.2 * hw, 0.08, 0.82],
      shadows,
    ))
  }

  // Torso
  const torsoH = feminine ? 0.62 : 0.68
  const torso = mesh(
    new THREE.BoxGeometry(0.48 * sw, torsoH, 0.28 * td),
    suitMat,
    [0, 0.95, 0.02],
    shadows,
  )
  root.add(torso)

  if (spec.outfit === 'evening_dress') {
    root.add(mesh(
      new THREE.CylinderGeometry(0.28 * hw, 0.38 * hw, 0.55, 14),
      suitMat,
      [0, 0.55, 0.05],
      shadows,
    ))
  }

  // Shirt / lapels
  root.add(mesh(new THREE.BoxGeometry(0.16, 0.42, 0.06), shirtMat, [0, 1.05, 0.16], shadows))
  if (spec.outfit !== 'evening_dress') {
    root.add(mesh(new THREE.BoxGeometry(0.12, 0.38, 0.04), suitMat, [-0.14 * sw, 1.08, 0.15], shadows, [0, 0, 0.25]))
    root.add(mesh(new THREE.BoxGeometry(0.12, 0.38, 0.04), suitMat, [0.14 * sw, 1.08, 0.15], shadows, [0, 0, -0.25]))
  }

  // Arms resting forward
  for (const sign of [-1, 1]) {
    root.add(mesh(new THREE.SphereGeometry(0.14, 12, 12), suitMat, [sign * 0.32 * sw, 1.28, 0], shadows))
    root.add(mesh(
      new THREE.CylinderGeometry(0.085, 0.095, 0.4, 10),
      suitMat,
      [sign * 0.42 * sw, 1.0, 0.12],
      shadows,
      [0.85, 0, sign * 0.15],
    ))
    root.add(mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.36, 10),
      suitMat,
      [sign * 0.4 * sw, 0.72, 0.42],
      shadows,
      [1.15, sign * 0.05, 0],
    ))
    root.add(mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat, [sign * 0.34 * sw, 0.58, 0.72], shadows))
  }

  // Neck + head with likeness albedo (integrated, not a floating disc)
  const headY = 1.82
  root.add(mesh(new THREE.CylinderGeometry(0.09 * hs, 0.11 * hs, 0.16, 12), skinMat, [0, 1.55, 0.04], shadows))

  const headGroup = new THREE.Group()
  headGroup.name = 'head'
  headGroup.position.set(0, headY, 0.05)

  let faceMap: THREE.CanvasTexture | null = null
  try {
    if (import.meta.client) {
      faceMap = await loadLikenessAlbedo(spec.portraitUrl, spec.faceCrop, spec.skin)
    }
  } catch (error) {
    console.warn('[salon] likeness failed', spec.id, error)
  }

  const headMat = faceMap
    ? new THREE.MeshStandardMaterial({
        map: faceMap,
        color: '#ffffff',
        roughness: 0.52,
        metalness: 0,
        emissive: '#ffffff',
        emissiveMap: faceMap,
        emissiveIntensity: 0.42,
      })
    : skinMat

  const headMesh = mesh(
    new THREE.SphereGeometry(0.23 * hs, 28, 22),
    headMat,
    [0, 0, 0],
    shadows,
    undefined,
    [0.95, 1.05, 0.92],
  )
  headGroup.add(headMesh)

  // Soft ear volumes
  headGroup.add(mesh(new THREE.SphereGeometry(0.05 * hs, 10, 10), skinMat, [-0.22 * hs, 0, 0], false, undefined, [0.6, 1, 0.7]))
  headGroup.add(mesh(new THREE.SphereGeometry(0.05 * hs, 10, 10), skinMat, [0.22 * hs, 0, 0], false, undefined, [0.6, 1, 0.7]))

  if (spec.hasBeard) {
    headGroup.add(mesh(
      new THREE.SphereGeometry(0.14 * hs, 14, 12),
      hairMat,
      [0, -0.12 * hs, 0.12 * hs],
      false,
      undefined,
      [1.05, 0.85, 0.75],
    ))
  }

  addHair(headGroup, spec.hairStyle, hairMat, shadows, hs)
  root.add(headGroup)

  addAccessory(root, spec, accentMat, headY, shadows)

  root.userData.sculptRuntime = {
    characterId: spec.id,
    pivots: {
      root,
      head: headGroup,
      torso,
      hips,
    },
    dispose: () => {
      faceMap?.dispose()
      skinMat.dispose()
      hairMat.dispose()
      suitMat.dispose()
      shirtMat.dispose()
      shoeMat.dispose()
      accentMat.dispose()
      woodMat.dispose()
      woodDark.dispose()
      if (headMat !== skinMat) {
        headMat.dispose()
      }
    },
  }

  return root
}
