import * as THREE from 'three'

/** Soft de-light + face crop for likeness projection (img2threejs likeness track). */
export async function loadLikenessAlbedo(
  portraitUrl: string,
  crop: { sx: number, sy: number, sw: number, sh: number },
  skinFallback: string,
): Promise<THREE.CanvasTexture> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`likeness ${portraitUrl}`))
    img.src = portraitUrl
  })

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Skin base (back / sides of head)
  ctx.fillStyle = skinFallback
  ctx.fillRect(0, 0, size, size)

  const sx = image.width * crop.sx
  const sy = image.height * crop.sy
  const sw = image.width * crop.sw
  const sh = image.height * crop.sh

  // Temporary face crop
  const face = document.createElement('canvas')
  face.width = 384
  face.height = 384
  const fctx = face.getContext('2d')!
  fctx.drawImage(image, sx, sy, sw, sh, 0, 0, face.width, face.height)

  // Mild de-light: overlay mid-grey to flatten baked lighting
  fctx.globalCompositeOperation = 'overlay'
  fctx.fillStyle = 'rgba(128,128,128,0.28)'
  fctx.fillRect(0, 0, face.width, face.height)
  fctx.globalCompositeOperation = 'source-over'

  // Project face onto frontal UV band of a sphere map (u≈0.2–0.8, v≈0.25–0.78)
  const padX = size * 0.18
  const padY = size * 0.22
  const fw = size - padX * 2
  const fh = size * 0.56
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(size / 2, size * 0.48, fw * 0.48, fh * 0.52, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(face, padX, padY, fw, fh)
  ctx.restore()

  // Soft edge blend into skin
  const edge = ctx.createRadialGradient(size / 2, size * 0.48, fw * 0.28, size / 2, size * 0.48, fw * 0.5)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(1, skinFallback)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}
