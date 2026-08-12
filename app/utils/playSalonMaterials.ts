import * as THREE from 'three'

export type SalonTextureQuality = 'high' | 'medium' | 'low'

export type SalonMapPair = {
  map: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

export type SalonTextureBundle = {
  ebony: SalonMapPair
  felt: SalonMapPair
  brass: SalonMapPair
  plaster: { map: THREE.CanvasTexture }
  parquet: SalonMapPair
  dispose: () => void
}

export const SALON_TEXTURE_SIZE: Record<SalonTextureQuality, number> = {
  high: 256,
  medium: 192,
  low: 128,
}

/** Deterministic 0..1 hash from integer coords + seed. */
function hash2(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function sizeFor(quality: SalonTextureQuality): number {
  return SALON_TEXTURE_SIZE[quality]
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  return { canvas, ctx }
}

function toColorMap(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = Math.min(4, anisotropy)
  texture.needsUpdate = true
  return texture
}

function toDataMap(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = Math.min(4, anisotropy)
  texture.needsUpdate = true
  return texture
}

function drawEbony(size: number): SalonMapPair {
  const { canvas, ctx } = makeCanvas(size)
  const rough = makeCanvas(size)

  const base = ctx.createLinearGradient(0, 0, size, size)
  base.addColorStop(0, '#1a100c')
  base.addColorStop(0.45, '#2a1810')
  base.addColorStop(1, '#120c09')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < size; i += 2) {
    const t = i / size
    const wobble = Math.sin(t * 18) * 3 + Math.sin(t * 41) * 1.5
    ctx.strokeStyle = `rgba(60, 36, 22, ${0.08 + hash2(i, 0, 11) * 0.12})`
    ctx.lineWidth = 1 + hash2(i, 1, 17) * 1.5
    ctx.beginPath()
    ctx.moveTo(0, i + wobble)
    ctx.bezierCurveTo(size * 0.35, i + wobble * 0.4, size * 0.65, i - wobble, size, i + wobble * 0.6)
    ctx.stroke()
  }

  for (let y = 0; y < size; y += 3) {
    for (let x = 0; x < size; x += 3) {
      const n = hash2(x, y, 23)
      if (n > 0.82) {
        ctx.fillStyle = `rgba(8, 5, 4, ${0.12 + n * 0.15})`
        ctx.fillRect(x, y, 2, 2)
      }
    }
  }

  const gloss = ctx.createRadialGradient(size * 0.35, size * 0.3, 0, size * 0.35, size * 0.3, size * 0.7)
  gloss.addColorStop(0, 'rgba(90, 60, 40, 0.18)')
  gloss.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gloss
  ctx.fillRect(0, 0, size, size)

  const rctx = rough.ctx
  rctx.fillStyle = '#6a6a6a'
  rctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size; i += 2) {
    const v = Math.floor(70 + hash2(i, 2, 31) * 50)
    rctx.strokeStyle = `rgb(${v},${v},${v})`
    rctx.lineWidth = 1
    rctx.beginPath()
    rctx.moveTo(0, i)
    rctx.lineTo(size, i + Math.sin(i * 0.05) * 2)
    rctx.stroke()
  }

  return {
    map: toColorMap(canvas, 3),
    roughnessMap: toDataMap(rough.canvas, 2),
  }
}

function drawFelt(size: number): SalonMapPair {
  const { canvas, ctx } = makeCanvas(size)
  const rough = makeCanvas(size)

  ctx.fillStyle = '#24563a'
  ctx.fillRect(0, 0, size, size)

  // Sparse fiber noise (stepped — avoid per-pixel main-thread cost)
  const step = Math.max(2, Math.floor(size / 128))
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const n = hash2(x, y, 47)
      if (n > 0.62) {
        const g = Math.floor(48 + n * 55)
        ctx.fillStyle = `rgba(${g * 0.45}, ${g}, ${g * 0.55}, ${0.12 + n * 0.2})`
        ctx.fillRect(x, y, step, step)
      }
    }
  }

  for (let i = 0; i < size; i++) {
    const x = Math.floor(hash2(i, 0, 59) * size)
    const y = Math.floor(hash2(i, 1, 61) * size)
    ctx.strokeStyle = `rgba(70, 130, 85, ${0.05 + hash2(i, 2, 67) * 0.1})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 2 + hash2(i, 3, 71) * 4, y + hash2(i, 4, 73) * 3 - 1.5)
    ctx.stroke()
  }

  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.7)
  vignette.addColorStop(0, 'rgba(30, 70, 45, 0.15)')
  vignette.addColorStop(1, 'rgba(8, 20, 14, 0.35)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, size, size)

  const rctx = rough.ctx
  rctx.fillStyle = '#c8c8c8'
  rctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += step * 2) {
    for (let x = 0; x < size; x += step * 2) {
      const v = Math.floor(180 + hash2(x, y, 79) * 60)
      rctx.fillStyle = `rgb(${v},${v},${v})`
      rctx.fillRect(x, y, step * 2, step * 2)
    }
  }

  return {
    map: toColorMap(canvas, 2),
    roughnessMap: toDataMap(rough.canvas, 2),
  }
}

function drawBrass(size: number): SalonMapPair {
  const { canvas, ctx } = makeCanvas(size)
  const rough = makeCanvas(size)

  const base = ctx.createLinearGradient(0, 0, size, size)
  base.addColorStop(0, '#8a6a2e')
  base.addColorStop(0.4, '#c4a04a')
  base.addColorStop(0.7, '#b08d3e')
  base.addColorStop(1, '#6e5224')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  const shine = ctx.createRadialGradient(size * 0.4, size * 0.35, 0, size * 0.4, size * 0.35, size * 0.55)
  shine.addColorStop(0, 'rgba(255, 230, 160, 0.45)')
  shine.addColorStop(0.5, 'rgba(176, 141, 62, 0.1)')
  shine.addColorStop(1, 'rgba(40, 28, 10, 0.25)')
  ctx.fillStyle = shine
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < size * 2; i++) {
    const x = Math.floor(hash2(i, 0, 83) * size)
    const y = Math.floor(hash2(i, 1, 89) * size)
    ctx.fillStyle = `rgba(40, 30, 12, ${0.08 + hash2(i, 2, 97) * 0.2})`
    ctx.fillRect(x, y, 1 + (hash2(i, 3, 101) > 0.7 ? 2 : 0), 1)
  }

  const rctx = rough.ctx
  rctx.fillStyle = '#404040'
  rctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 3) {
    for (let x = 0; x < size; x += 3) {
      const v = Math.floor(40 + hash2(x, y, 103) * 70)
      rctx.fillStyle = `rgb(${v},${v},${v})`
      rctx.fillRect(x, y, 3, 3)
    }
  }

  return {
    map: toColorMap(canvas, 3),
    roughnessMap: toDataMap(rough.canvas, 2),
  }
}

function drawPlaster(size: number): { map: THREE.CanvasTexture } {
  const { canvas, ctx } = makeCanvas(size)
  ctx.fillStyle = '#1c1612'
  ctx.fillRect(0, 0, size, size)
  const step = Math.max(2, Math.floor(size / 64))
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const n = hash2(x, y, 107)
      const v = Math.floor(20 + n * 18)
      ctx.fillStyle = `rgba(${v + 4}, ${v}, ${v - 2}, 0.35)`
      ctx.fillRect(x, y, step, step)
    }
  }
  return { map: toColorMap(canvas, 2) }
}

function drawParquet(size: number): SalonMapPair {
  const { canvas, ctx } = makeCanvas(size)
  const rough = makeCanvas(size)
  const cells = 8
  const cell = size / cells

  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const flip = (gx + gy) % 2 === 0
      const shade = 0.85 + hash2(gx, gy, 109) * 0.2
      const r = Math.floor(26 * shade)
      const g = Math.floor(16 * shade)
      const b = Math.floor(10 * shade)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(gx * cell, gy * cell, cell + 1, cell + 1)

      ctx.save()
      ctx.translate(gx * cell + cell / 2, gy * cell + cell / 2)
      ctx.rotate(flip ? 0 : Math.PI / 2)
      ctx.translate(-cell / 2, -cell / 2)
      for (let s = 0; s < 5; s++) {
        const yy = (s + 0.5) * (cell / 5)
        ctx.strokeStyle = `rgba(50, 30, 18, ${0.15 + hash2(gx, s, 113) * 0.2})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(2, yy)
        ctx.lineTo(cell - 2, yy + Math.sin(s) * 1.5)
        ctx.stroke()
      }
      ctx.restore()

      ctx.strokeStyle = 'rgba(8, 5, 3, 0.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(gx * cell + 0.5, gy * cell + 0.5, cell - 1, cell - 1)
    }
  }

  const rctx = rough.ctx
  rctx.fillStyle = '#888888'
  rctx.fillRect(0, 0, size, size)
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const v = Math.floor(100 + hash2(gx, gy, 127) * 60)
      rctx.fillStyle = `rgb(${v},${v},${v})`
      rctx.fillRect(gx * cell, gy * cell, cell, cell)
    }
  }

  return {
    map: toColorMap(canvas, 3),
    roughnessMap: toDataMap(rough.canvas, 2),
  }
}

export function createSalonTextures(quality: SalonTextureQuality): SalonTextureBundle {
  const size = sizeFor(quality)
  const ebony = drawEbony(size)
  const felt = drawFelt(size)
  const brass = drawBrass(Math.max(128, Math.floor(size / 2)))
  const plaster = drawPlaster(Math.max(128, Math.floor(size / 2)))
  const parquet = drawParquet(size)

  return {
    ebony,
    felt,
    brass,
    plaster,
    parquet,
    dispose() {
      ebony.map.dispose()
      ebony.roughnessMap.dispose()
      felt.map.dispose()
      felt.roughnessMap.dispose()
      brass.map.dispose()
      brass.roughnessMap.dispose()
      plaster.map.dispose()
      parquet.map.dispose()
      parquet.roughnessMap.dispose()
    },
  }
}
