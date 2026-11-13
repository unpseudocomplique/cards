import sharp from 'sharp'
import { PDFDocument, PDFName } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { upscaleToPrintCanvas } from '../../server/utils/cardRenderer'
import { buildPrintPdf, toPrintCmykJpeg } from '../../server/utils/printPdf'
import { CARD_FORMATS, PRINT_BLEED_MM, PRINT_SLUG_MM } from '../../shared/utils/printSpec'

const pt = (mm: number) => mm * 72 / 25.4

async function card(color: string) {
  const screen = await sharp({ create: { width: 900, height: 1652, channels: 4, background: color } }).png().toBuffer()
  return upscaleToPrintCanvas(screen, 'royal', 'tarot')
}

describe('printPdf', () => {
  it('converts card images to CMYK', async () => {
    const jpeg = await toPrintCmykJpeg(await card('#c81e28'))
    const meta = await sharp(jpeg).metadata()

    expect(meta.format).toBe('jpeg')
    expect(meta.space).toBe('cmyk')
    expect(meta.channels).toBe(4)
    // Profile carried by the PDF OutputIntent, not by every image.
    expect(meta.icc).toBeUndefined()
  }, 30_000)

  it('builds one page per card with bleed, trim and the CMYK output intent', async () => {
    const format = CARD_FORMATS.tarot
    const bytes = await buildPrintPdf({
      title: 'Test',
      format,
      pages: [
        { image: await card('#c81e28'), label: 'recto 1/2 - hearts-k' },
        { image: await card('#1d2b4c'), label: 'recto 2/2 - trump-21' }
      ]
    })
    const doc = await PDFDocument.load(bytes)

    expect(doc.getPageCount()).toBe(2)

    for (const page of doc.getPages()) {
      const trim = page.getTrimBox()
      const bleed = page.getBleedBox()
      const media = page.getMediaBox()

      expect(trim.width).toBeCloseTo(pt(format.trimMm.width), 3)
      expect(trim.height).toBeCloseTo(pt(format.trimMm.height), 3)
      expect(trim.x).toBeCloseTo(pt(PRINT_SLUG_MM), 3)
      expect(bleed.width).toBeCloseTo(pt(format.trimMm.width + PRINT_BLEED_MM * 2), 3)
      expect(media.width).toBeCloseTo(pt(format.trimMm.width + PRINT_SLUG_MM * 2), 3)
    }

    const intents = doc.catalog.lookup(PDFName.of('OutputIntents'))
    expect(intents?.toString()).toContain('GTS_PDFX')
    expect(Buffer.from(bytes).toString('latin1')).toContain('/ColorSpace /DeviceCMYK')
  }, 60_000)
})
