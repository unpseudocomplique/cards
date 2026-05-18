import sharp from 'sharp'

type RenderCard = {
  label: string
  shortLabel: string
  suit?: string
  aspectRatio: '3:4' | '9:16'
}

const pokerCard = { width: 900, height: 1200 }
const tarotCard = { width: 900, height: 1600 }

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildOverlay(card: RenderCard, width: number, height: number) {
  const safeLabel = escapeXml(card.label)
  const safeShortLabel = escapeXml(card.shortLabel)
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? '#b91c1c' : '#111827'

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="42" fill="none" stroke="#111827" stroke-width="16"/>
      <rect x="52" y="52" width="${width - 104}" height="${height - 104}" rx="28" fill="none" stroke="#d4af37" stroke-width="6"/>
      <text x="72" y="126" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="800" fill="${color}">${safeShortLabel}</text>
      <text x="${width - 72}" y="${height - 84}" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="800" fill="${color}" text-anchor="end" transform="rotate(180 ${width - 72} ${height - 84})">${safeShortLabel}</text>
      <rect x="96" y="${height - 168}" width="${width - 192}" height="74" rx="18" fill="rgba(255,255,255,0.88)"/>
      <text x="${width / 2}" y="${height - 119}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#111827" text-anchor="middle">${safeLabel}</text>
    </svg>
  `)
}

export async function renderCardImage(source: Buffer, card: RenderCard) {
  const dimensions = card.aspectRatio === '9:16' ? tarotCard : pokerCard

  const base = await sharp(source)
    .resize(dimensions.width, dimensions.height, { fit: 'cover' })
    .composite([{ input: buildOverlay(card, dimensions.width, dimensions.height), top: 0, left: 0 }])
    .png()
    .toBuffer()

  return base
}
