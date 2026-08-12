import * as THREE from 'three'

export class SculptKit {
  readonly materials: THREE.Material[] = []
  readonly geometries: THREE.BufferGeometry[] = []

  mat(color: string, extras: THREE.MeshStandardMaterialParameters = {}) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.05,
      ...extras
    })
    this.materials.push(material)
    return material
  }

  track(geo: THREE.BufferGeometry) {
    this.geometries.push(geo)
    return geo
  }

  mesh(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    shadows: boolean,
    rotation?: [number, number, number],
    scale?: [number, number, number]
  ) {
    this.track(geo)
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

  tube(
    points: Array<[number, number, number]>,
    radius: number,
    tubular = 8,
    radial = 6
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'catmullrom',
      0.35
    )
    return this.track(new THREE.TubeGeometry(curve, tubular, radius, radial, false))
  }

  /** Capsule spanning two joints so limbs never float apart. */
  limb(
    parent: THREE.Object3D,
    material: THREE.Material,
    start: [number, number, number],
    end: [number, number, number],
    radius: number,
    shadows: boolean,
    radial = 10
  ) {
    const a = new THREE.Vector3(...start)
    const b = new THREE.Vector3(...end)
    const dir = b.clone().sub(a)
    const length = Math.max(dir.length(), 0.02)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const mesh = this.mesh(
      new THREE.CylinderGeometry(radius, radius, length, radial),
      material,
      [mid.x, mid.y, mid.z],
      shadows
    )
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    parent.add(mesh)
    parent.add(this.mesh(new THREE.SphereGeometry(radius * 1.02, 10, 8), material, start, shadows))
    parent.add(this.mesh(new THREE.SphereGeometry(radius * 1.02, 10, 8), material, end, shadows))
    return mesh
  }

  dispose() {
    for (const geo of this.geometries) {
      geo.dispose()
    }
    for (const material of this.materials) {
      material.dispose()
    }
  }
}
