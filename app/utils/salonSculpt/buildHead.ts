import * as THREE from 'three'
import type { SculptKit } from './kit'
import type { HairStyle, SalonSculptSpec } from './types'

type Mats = {
  skin: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
  beard: THREE.MeshStandardMaterial
  eyeWhite: THREE.MeshStandardMaterial
  iris: THREE.MeshStandardMaterial
  pupil: THREE.MeshStandardMaterial
  catchlight: THREE.MeshStandardMaterial
  lip: THREE.MeshStandardMaterial
  brow: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
}

function lock(
  kit: SculptKit,
  parent: THREE.Group,
  mat: THREE.Material,
  points: Array<[number, number, number]>,
  radius: number,
  shadows: boolean,
  tubular = 8
) {
  parent.add(kit.mesh(kit.tube(points, radius, tubular, 5), mat, [0, 0, 0], shadows))
}

function addHair(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  hairMat: THREE.Material,
  shadows: boolean
) {
  const s = spec.headScale
  const style: HairStyle = spec.hairStyle

  // Scalp mass — sits on the crown, leaves the face plane open.
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.22 * s, 18, 14),
    hairMat,
    [0, 0.1 * s, -0.06 * s],
    shadows,
    undefined,
    [1.02 * spec.faceWidth, 0.68, 0.95]
  ))

  const L = (
    pts: Array<[number, number, number]>,
    r: number,
    tubular = 8
  ) => lock(kit, head, hairMat, pts.map(([x, y, z]) => [x * s, y * s, z * s]), r * s, shadows, tubular)

  switch (style) {
    case 'bob':
      L([[-0.08, 0.16, 0.12], [-0.18, 0.04, 0.16], [-0.2, -0.12, 0.1], [-0.16, -0.2, 0.02]], 0.055)
      L([[0.08, 0.16, 0.12], [0.18, 0.04, 0.16], [0.2, -0.12, 0.1], [0.16, -0.2, 0.02]], 0.055)
      L([[0, 0.18, -0.08], [0, 0.02, -0.2], [0, -0.16, -0.16]], 0.07)
      L([[-0.14, 0.12, -0.1], [-0.2, -0.02, -0.12], [-0.18, -0.18, -0.06]], 0.05)
      L([[0.14, 0.12, -0.1], [0.2, -0.02, -0.12], [0.18, -0.18, -0.06]], 0.05)
      L([[-0.04, 0.18, 0.16], [-0.1, 0.08, 0.2], [-0.08, -0.02, 0.18]], 0.032, 6)
      L([[0.06, 0.16, 0.16], [0.12, 0.06, 0.2], [0.1, -0.04, 0.16]], 0.03, 6)
      break
    case 'updo':
      L([[0, 0.16, 0], [0, 0.28, -0.04], [0.04, 0.34, -0.02], [0, 0.32, 0.04]], 0.07)
      L([[-0.1, 0.14, 0.04], [-0.16, 0.24, 0], [-0.08, 0.32, -0.06]], 0.05)
      L([[0.1, 0.14, 0.04], [0.16, 0.24, 0], [0.08, 0.32, -0.06]], 0.05)
      L([[-0.12, 0.12, 0.14], [-0.16, 0.02, 0.18], [-0.12, -0.08, 0.14]], 0.028, 6)
      L([[0.1, 0.1, 0.16], [0.16, 0.0, 0.18], [0.12, -0.1, 0.12]], 0.026, 6)
      L([[0, 0.14, -0.12], [0, 0.22, -0.16], [0.04, 0.28, -0.1]], 0.055)
      break
    case 'bun_silver':
      head.add(kit.mesh(
        new THREE.SphereGeometry(0.1 * s, 14, 12),
        hairMat,
        [0, 0.2 * s, -0.1 * s],
        shadows,
        undefined,
        [1.15, 0.9, 1.1]
      ))
      L([[-0.1, 0.14, 0.1], [-0.18, 0.04, 0.12], [-0.14, -0.06, 0.08]], 0.04)
      L([[0.1, 0.14, 0.1], [0.18, 0.04, 0.12], [0.14, -0.06, 0.08]], 0.04)
      L([[0, 0.16, -0.08], [0, 0.08, -0.18], [0, -0.04, -0.16]], 0.05)
      L([[-0.08, 0.18, 0.06], [-0.04, 0.22, 0.02], [0, 0.2, -0.08]], 0.035)
      break
    case 'long_waves':
      L([[-0.1, 0.16, 0.08], [-0.2, 0.02, 0.1], [-0.22, -0.16, 0.04], [-0.18, -0.34, 0.02]], 0.05, 10)
      L([[0.1, 0.16, 0.08], [0.2, 0.02, 0.1], [0.22, -0.16, 0.04], [0.18, -0.34, 0.02]], 0.05, 10)
      L([[-0.06, 0.14, -0.1], [-0.14, -0.02, -0.12], [-0.12, -0.22, -0.08], [-0.1, -0.4, -0.04]], 0.045, 10)
      L([[0.06, 0.14, -0.1], [0.14, -0.02, -0.12], [0.12, -0.22, -0.08], [0.1, -0.4, -0.04]], 0.045, 10)
      L([[-0.04, 0.18, 0.14], [-0.12, 0.06, 0.18], [-0.1, -0.08, 0.14]], 0.03, 6)
      L([[0.08, 0.16, 0.14], [0.14, 0.02, 0.16], [0.1, -0.12, 0.1]], 0.028, 6)
      L([[0, 0.2, -0.04], [0.04, 0.16, -0.16], [0, 0.02, -0.2]], 0.06)
      break
    case 'natural_short':
      for (const [x, z] of [[-0.1, 0.08], [0.1, 0.08], [-0.12, -0.04], [0.12, -0.04], [0, 0.12], [-0.06, -0.12], [0.06, -0.12]] as const) {
        L([[x * 0.6, 0.16, z * 0.6], [x, 0.2, z], [x * 1.1, 0.12, z * 1.1]], 0.04, 5)
      }
      L([[-0.08, 0.14, 0.12], [-0.12, 0.08, 0.16], [-0.08, 0.02, 0.14]], 0.03, 5)
      L([[0.08, 0.14, 0.12], [0.12, 0.08, 0.16], [0.08, 0.02, 0.14]], 0.03, 5)
      break
    case 'thick_dark':
      L([[0, 0.18, 0.04], [0, 0.24, -0.02], [0.06, 0.2, -0.1]], 0.07)
      L([[-0.12, 0.14, 0.08], [-0.2, 0.06, 0.06], [-0.18, -0.06, 0.02]], 0.055)
      L([[0.12, 0.14, 0.08], [0.2, 0.06, 0.06], [0.18, -0.06, 0.02]], 0.055)
      L([[0, 0.16, -0.1], [0, 0.06, -0.2], [0.04, -0.06, -0.16]], 0.06)
      L([[-0.08, 0.18, 0.12], [-0.12, 0.08, 0.16], [-0.06, 0.0, 0.12]], 0.032, 6)
      break
    case 'white_short':
      L([[0, 0.16, 0.02], [0, 0.2, -0.06], [0.04, 0.14, -0.12]], 0.055)
      L([[-0.1, 0.12, 0.04], [-0.16, 0.04, 0], [-0.12, -0.04, -0.04]], 0.04)
      L([[0.1, 0.12, 0.04], [0.16, 0.04, 0], [0.12, -0.04, -0.04]], 0.04)
      L([[0, 0.14, -0.1], [0, 0.04, -0.18], [0, -0.04, -0.14]], 0.045)
      break
    case 'salt_pepper':
      L([[0, 0.16, 0.02], [0, 0.2, -0.04], [0.05, 0.14, -0.1]], 0.05)
      L([[-0.1, 0.12, 0.08], [-0.16, 0.04, 0.06], [-0.12, -0.02, 0.02]], 0.038)
      L([[0.1, 0.12, 0.08], [0.16, 0.04, 0.06], [0.12, -0.02, 0.02]], 0.038)
      L([[0, 0.14, -0.1], [0, 0.04, -0.18], [0, -0.02, -0.14]], 0.042)
      break
    case 'cropped_beard':
      L([[0, 0.14, 0], [0, 0.16, -0.06], [0.04, 0.1, -0.1]], 0.042)
      L([[-0.12, 0.1, 0.04], [-0.16, 0.02, 0], [-0.1, -0.02, -0.04]], 0.032)
      L([[0.12, 0.1, 0.04], [0.16, 0.02, 0], [0.1, -0.02, -0.04]], 0.032)
      break
    case 'short_slick':
    default:
      L([[0, 0.12, 0.08], [0, 0.22, 0.02], [0.04, 0.2, -0.08]], 0.055)
      L([[-0.08, 0.14, 0.06], [-0.14, 0.16, -0.02], [-0.1, 0.08, -0.1]], 0.04)
      L([[0.08, 0.14, 0.06], [0.14, 0.16, -0.02], [0.1, 0.08, -0.1]], 0.04)
      L([[0, 0.16, -0.08], [0, 0.08, -0.18], [0.02, 0.0, -0.14]], 0.05)
      break
  }
}

function addFacialHair(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  beardMat: THREE.Material,
  shadows: boolean
) {
  const s = spec.headScale
  if (spec.facialHair === 'none') {
    return
  }
  if (spec.facialHair === 'handlebar') {
    lock(kit, head, beardMat, [
      [-0.02 * s, -0.1 * s, 0.2 * s],
      [-0.08 * s, -0.1 * s, 0.2 * s],
      [-0.12 * s, -0.08 * s, 0.18 * s],
      [-0.14 * s, -0.04 * s, 0.16 * s]
    ], 0.016 * s, shadows, 6)
    lock(kit, head, beardMat, [
      [0.02 * s, -0.1 * s, 0.2 * s],
      [0.08 * s, -0.1 * s, 0.2 * s],
      [0.12 * s, -0.08 * s, 0.18 * s],
      [0.14 * s, -0.04 * s, 0.16 * s]
    ], 0.016 * s, shadows, 6)
    return
  }
  // Beard volume + mustache
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.12 * s, 12, 10),
    beardMat,
    [0, -0.16 * s, 0.1 * s],
    shadows,
    undefined,
    [1.05 * spec.jawWidth, 0.85, 0.8]
  ))
  lock(kit, head, beardMat, [
    [-0.04 * s, -0.1 * s, 0.2 * s],
    [-0.08 * s, -0.12 * s, 0.18 * s],
    [0, -0.14 * s, 0.2 * s],
    [0.08 * s, -0.12 * s, 0.18 * s],
    [0.04 * s, -0.1 * s, 0.2 * s]
  ], 0.018 * s, shadows, 6)
  if (spec.facialHair === 'full_beard') {
    lock(kit, head, beardMat, [
      [-0.1 * s, -0.12 * s, 0.12 * s],
      [-0.12 * s, -0.2 * s, 0.08 * s],
      [0, -0.24 * s, 0.1 * s],
      [0.12 * s, -0.2 * s, 0.08 * s],
      [0.1 * s, -0.12 * s, 0.12 * s]
    ], 0.03 * s, shadows, 7)
  }
}

function addEyes(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean
) {
  const s = spec.headScale * spec.eyeScale
  const y = 0.04 * spec.headScale
  const z = 0.195 * spec.headScale
  const spread = 0.07 * spec.headScale * spec.faceWidth

  for (const sign of [-1, 1]) {
    const x = sign * spread
    const eye = new THREE.Group()
    eye.position.set(x, y, z)
    eye.add(kit.mesh(new THREE.SphereGeometry(0.036 * s, 14, 12), mats.eyeWhite, [0, 0, 0], shadows))
    eye.add(kit.mesh(
      new THREE.CircleGeometry(0.02 * s, 16),
      mats.iris,
      [0, 0, 0.032 * s],
      false
    ))
    eye.add(kit.mesh(
      new THREE.CircleGeometry(0.009 * s, 12),
      mats.pupil,
      [0, 0, 0.034 * s],
      false
    ))
    eye.add(kit.mesh(
      new THREE.SphereGeometry(0.006 * s, 8, 8),
      mats.catchlight,
      [0.01 * s, 0.01 * s, 0.038 * s],
      false
    ))
    eye.add(kit.mesh(
      new THREE.SphereGeometry(0.038 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      mats.skin,
      [0, 0.008 * s, 0.004 * s],
      false,
      [0.2, 0, 0]
    ))
    head.add(eye)
  }
}

function addNose(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  skin: THREE.Material,
  shadows: boolean
) {
  const s = spec.headScale * spec.noseScale
  head.add(kit.mesh(
    new THREE.CylinderGeometry(0.014 * s, 0.026 * s, 0.11 * s, 8),
    skin,
    [0, 0.01 * spec.headScale, 0.21 * spec.headScale],
    shadows,
    [0.72, 0, 0]
  ))
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.032 * s, 10, 8),
    skin,
    [0, -0.048 * spec.headScale, 0.255 * spec.headScale],
    shadows,
    undefined,
    [0.9, 0.72, 0.95]
  ))
}

function addMouth(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean
) {
  const s = spec.headScale
  const smile = spec.id === 'marco' ? 0.08 : 0.02
  head.add(kit.mesh(
    new THREE.TorusGeometry(0.045 * s, 0.012 * s, 8, 16, Math.PI),
    mats.lip,
    [0, -0.1 * s, 0.2 * s],
    shadows,
    [1.2, 0, 0],
    [1.1, 0.7, 1]
  ))
  head.add(kit.mesh(
    new THREE.TorusGeometry(0.04 * s, 0.01 * s, 8, 14, Math.PI),
    mats.lip,
    [0, -0.118 * s - smile * 0.1, 0.195 * s],
    shadows,
    [2.0, 0, 0],
    [1.05, 0.65, 1]
  ))
}

function addEars(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  skin: THREE.Material,
  shadows: boolean
) {
  const s = spec.headScale
  for (const sign of [-1, 1]) {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.055 * s, 10, 10),
      skin,
      [sign * 0.22 * s * spec.faceWidth, 0.0, -0.02 * s],
      shadows,
      [0, sign * 0.35, sign * 0.15],
      [0.45, 1.05, 0.7]
    ))
  }
}

function addGlasses(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  mats: Mats
) {
  if (spec.glasses === 'none') {
    return
  }
  const s = spec.headScale
  const r = spec.glasses === 'round' ? 0.048 * s : 0.042 * s
  const g = new THREE.Group()
  g.position.set(0, 0.04 * s, 0.26 * s)
  const spread = 0.072 * s * spec.faceWidth
  g.add(kit.mesh(new THREE.TorusGeometry(r, 0.007 * s, 8, 20), mats.gold, [-spread, 0, 0], false))
  g.add(kit.mesh(new THREE.TorusGeometry(r, 0.007 * s, 8, 20), mats.gold, [spread, 0, 0], false))
  g.add(kit.mesh(new THREE.BoxGeometry(0.036 * s, 0.007 * s, 0.007 * s), mats.gold, [0, 0.004 * s, 0], false))
  g.add(kit.mesh(
    new THREE.CircleGeometry(r * 0.88, 16),
    mats.glass,
    [-spread, 0, 0.002 * s],
    false
  ))
  g.add(kit.mesh(
    new THREE.CircleGeometry(r * 0.88, 16),
    mats.glass,
    [spread, 0, 0.002 * s],
    false
  ))
  g.add(kit.mesh(
    new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.12 * s, 6),
    mats.gold,
    [-spread - r * 0.85, 0, -0.055 * s],
    false,
    [1.2, 0, 0]
  ))
  g.add(kit.mesh(
    new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.12 * s, 6),
    mats.gold,
    [spread + r * 0.85, 0, -0.055 * s],
    false,
    [1.2, 0, 0]
  ))
  head.add(g)
}

function addEarrings(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  gold: THREE.Material,
  shadows: boolean
) {
  if (spec.earrings === 'none') {
    return
  }
  const s = spec.headScale
  for (const sign of [-1, 1]) {
    const x = sign * 0.23 * s * spec.faceWidth
    if (spec.earrings === 'hoop') {
      head.add(kit.mesh(
        new THREE.TorusGeometry(0.028 * s, 0.005 * s, 8, 16),
        gold,
        [x, -0.06 * s, 0.02 * s],
        shadows,
        [0.4, 0, 0]
      ))
    } else {
      head.add(kit.mesh(
        new THREE.SphereGeometry(0.012 * s, 10, 8),
        gold,
        [x, -0.04 * s, 0.02 * s],
        shadows
      ))
    }
  }
}

function addLaurel(
  kit: SculptKit,
  head: THREE.Group,
  spec: SalonSculptSpec,
  gold: THREE.Material,
  shadows: boolean
) {
  if (spec.hairOrnament !== 'laurel') {
    return
  }
  const s = spec.headScale
  const g = new THREE.Group()
  g.position.set(0.12 * s, 0.14 * s, 0.08 * s)
  g.rotation.set(0.3, -0.6, 0.4)
  for (let i = 0; i < 5; i++) {
    g.add(kit.mesh(
      new THREE.SphereGeometry(0.018 * s, 8, 6),
      gold,
      [0, i * 0.022 * s, 0],
      shadows,
      [0, 0, 0.4],
      [0.45, 1.4, 0.7]
    ))
  }
  head.add(g)
}

export function buildHead(
  kit: SculptKit,
  spec: SalonSculptSpec,
  mats: Mats,
  shadows: boolean
) {
  const s = spec.headScale
  const head = new THREE.Group()
  head.name = 'head'

  // Cranium (ellipsoid, not a photo sphere)
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.23 * s, 28, 22),
    mats.skin,
    [0, 0.02 * s, 0],
    shadows,
    undefined,
    [0.92 * spec.faceWidth, 1.06, 0.88]
  ))
  // Jaw / chin volume
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.16 * s, 18, 14),
    mats.skin,
    [0, -0.12 * s, 0.04 * s],
    shadows,
    undefined,
    [0.9 * spec.jawWidth, 0.72, 0.78]
  ))
  head.add(kit.mesh(
    new THREE.SphereGeometry(0.055 * s, 12, 10),
    mats.skin,
    [0, -0.2 * s, 0.12 * s],
    shadows,
    undefined,
    [1.1, 0.7, 0.9]
  ))
  // Cheeks
  for (const sign of [-1, 1]) {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.07 * s, 12, 10),
      mats.skin,
      [sign * 0.12 * s * spec.faceWidth, -0.04 * s, 0.12 * s],
      shadows,
      undefined,
      [0.7, 0.85, 0.65]
    ))
  }
  // Brow ridge
  for (const sign of [-1, 1]) {
    head.add(kit.mesh(
      new THREE.SphereGeometry(0.04 * s, 10, 8),
      mats.brow,
      [sign * 0.07 * s, 0.08 * s, 0.18 * s],
      false,
      undefined,
      [1.4, 0.45, 0.55]
    ))
  }

  addEars(kit, head, spec, mats.skin, shadows)
  addNose(kit, head, spec, mats.skin, shadows)
  addEyes(kit, head, spec, mats, shadows)
  addMouth(kit, head, spec, mats, shadows)
  addFacialHair(kit, head, spec, mats.beard, shadows)
  addHair(kit, head, spec, mats.hair, shadows)
  addGlasses(kit, head, spec, mats)
  addEarrings(kit, head, spec, mats.gold, shadows)
  addLaurel(kit, head, spec, mats.gold, shadows)

  return head
}

export type { Mats }
