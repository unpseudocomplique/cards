import * as THREE from 'three'
import type { SalonTextureQuality } from '~/utils/playSalonMaterials'
import { SALON_TEXTURE_SIZE } from '~/utils/playSalonMaterials'

export type AmbianceArtBundle = {
  wallpaper: THREE.CanvasTexture
  curtain: THREE.CanvasTexture
  paintings: THREE.CanvasTexture[]
  dispose: () => void
}

function hash2(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function canvas(w: number, h: number) {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  return { el, ctx: el.getContext('2d')! }
}

function toMap(el: HTMLCanvasElement, anisotropy = 2): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(el)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = Math.min(4, anisotropy)
  texture.needsUpdate = true
  return texture
}

function drawWallpaper(size: number): THREE.CanvasTexture {
  const { el, ctx } = canvas(size, size)
  ctx.fillStyle = '#3d2a20'
  ctx.fillRect(0, 0, size, size)

  // Damask-ish diamonds
  const step = Math.max(24, Math.floor(size / 10))
  for (let y = 0; y < size + step; y += step) {
    for (let x = 0; x < size + step; x += step) {
      const ox = (Math.floor(y / step) % 2) * (step / 2)
      ctx.strokeStyle = `rgba(120, 80, 50, ${0.18 + hash2(x, y, 3) * 0.12})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x + ox, y)
      ctx.lineTo(x + ox + step / 2, y + step / 2)
      ctx.lineTo(x + ox, y + step)
      ctx.lineTo(x + ox - step / 2, y + step / 2)
      ctx.closePath()
      ctx.stroke()
    }
  }

  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(20,10,6,0.35)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, size, size)

  const texture = toMap(el, 2)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 2)
  return texture
}

function drawCurtain(w: number, h: number): THREE.CanvasTexture {
  const { el, ctx } = canvas(w, h)
  const base = ctx.createLinearGradient(0, 0, w, 0)
  base.addColorStop(0, '#4a1420')
  base.addColorStop(0.5, '#8a2434')
  base.addColorStop(1, '#4a1420')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  for (let x = 0; x < w; x += 6) {
    const shade = 0.08 + hash2(x, 0, 9) * 0.12
    ctx.fillStyle = `rgba(20, 4, 8, ${shade})`
    ctx.fillRect(x, 0, 3, h)
    ctx.fillStyle = `rgba(200, 80, 90, ${shade * 0.35})`
    ctx.fillRect(x + 3, 0, 1, h)
  }

  // Soft folds
  for (let i = 0; i < 7; i++) {
    const x = (i + 0.5) * (w / 7)
    const g = ctx.createLinearGradient(x - 18, 0, x + 18, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, 'rgba(255,180,160,0.08)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 18, 0, 36, h)
  }

  return toMap(el, 2)
}

const PAINTING_THEMES: Array<{
  sky: [string, string]
  ground: string
  accent: string
  title: string
}> = [
  { sky: ['#2a1a40', '#8a4a2a'], ground: '#1a1210', accent: '#d4a84b', title: 'Soirée' },
  { sky: ['#1a2838', '#4a6a80'], ground: '#142018', accent: '#c9b896', title: 'Brume' },
  { sky: ['#3a1020', '#c06040'], ground: '#201010', accent: '#e0c06a', title: 'Feu' },
]

function drawPainting(size: number, themeIndex: number): THREE.CanvasTexture {
  const theme = PAINTING_THEMES[themeIndex % PAINTING_THEMES.length]!
  const { el, ctx } = canvas(size, size)

  // Frame mat
  ctx.fillStyle = '#1a100c'
  ctx.fillRect(0, 0, size, size)

  const inset = Math.floor(size * 0.08)
  const inner = size - inset * 2
  const sky = ctx.createLinearGradient(0, inset, 0, inset + inner)
  sky.addColorStop(0, theme.sky[0])
  sky.addColorStop(1, theme.sky[1])
  ctx.fillStyle = sky
  ctx.fillRect(inset, inset, inner, inner)

  // Abstract hills / table silhouette
  ctx.fillStyle = theme.ground
  ctx.beginPath()
  ctx.moveTo(inset, inset + inner)
  for (let i = 0; i <= 8; i++) {
    const x = inset + (i / 8) * inner
    const y = inset + inner * (0.55 + hash2(i, themeIndex, 21) * 0.25)
    ctx.lineTo(x, y)
  }
  ctx.lineTo(inset + inner, inset + inner)
  ctx.closePath()
  ctx.fill()

  // Soft orb / moon
  const ox = inset + inner * (0.3 + themeIndex * 0.15)
  const oy = inset + inner * 0.28
  const rad = inner * 0.12
  const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad)
  orb.addColorStop(0, 'rgba(255,230,180,0.85)')
  orb.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = orb
  ctx.beginPath()
  ctx.arc(ox, oy, rad, 0, Math.PI * 2)
  ctx.fill()

  // Gold inner frame line
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.strokeRect(inset + 4, inset + 4, inner - 8, inner - 8)

  ctx.fillStyle = 'rgba(224, 192, 106, 0.55)'
  ctx.font = `600 ${Math.floor(size * 0.055)}px "Iowan Old Style", Palatino, serif`
  ctx.textAlign = 'center'
  ctx.fillText(theme.title, size / 2, inset + inner - size * 0.04)

  return toMap(el, 3)
}

export function createAmbianceArt(quality: SalonTextureQuality): AmbianceArtBundle {
  const size = SALON_TEXTURE_SIZE[quality]
  const paintingSize = Math.max(256, Math.floor(size * 0.75))
  const wallpaper = drawWallpaper(size)
  const curtain = drawCurtain(size, Math.floor(size * 1.2))
  const paintings = [0, 1, 2].map(i => drawPainting(paintingSize, i))

  return {
    wallpaper,
    curtain,
    paintings,
    dispose() {
      wallpaper.dispose()
      curtain.dispose()
      for (const painting of paintings) {
        painting.dispose()
      }
    },
  }
}
