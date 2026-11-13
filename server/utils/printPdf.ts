import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { PDFDocument, PDFName, PDFString, StandardFonts, cmyk, type PDFPage } from 'pdf-lib'
import {
  PRINT_BLEED_MM,
  PRINT_CROP_MARK_LENGTH_MM,
  PRINT_CROP_MARK_OFFSET_MM,
  PRINT_CROP_MARK_STROKE_PT,
  PRINT_ICC_PROFILE,
  PRINT_SLUG_MM,
  type CardFormat
} from '~~/shared/utils/printSpec'

const MM_TO_PT = 72 / 25.4

function pt(mm: number) {
  return mm * MM_TO_PT
}

/** All four plates at 100 %: crop marks must show on every separation. */
const REGISTRATION = cmyk(1, 1, 1, 1)
const BLACK = cmyk(0, 0, 0, 1)

let iccBuffer: Buffer | null = null
let iccPath: string | null = null

function readIccFromFilesystem() {
  const candidates = [
    join(process.cwd(), 'server/assets/icc', PRINT_ICC_PROFILE.file),
    join(process.cwd(), '.output/server/assets/icc', PRINT_ICC_PROFILE.file)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { buffer: readFileSync(candidate), path: candidate }
    }
  }

  return null
}

async function loadIccBuffer() {
  if (iccBuffer) {
    return iccBuffer
  }

  const fromDisk = readIccFromFilesystem()

  if (fromDisk) {
    iccBuffer = fromDisk.buffer
    iccPath = fromDisk.path
    return iccBuffer
  }

  try {
    const storage = useStorage('assets:icc')
    const raw = await storage.getItemRaw(PRINT_ICC_PROFILE.file)

    if (raw) {
      iccBuffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array)
      return iccBuffer
    }
  } catch (error) {
    console.warn('[printPdf] Nitro asset storage unavailable', error)
  }

  throw new Error(`Profil ICC introuvable (${PRINT_ICC_PROFILE.file}).`)
}

/** Sharp only takes an ICC profile by path: bundled builds get a temp copy. */
async function getIccPath() {
  const buffer = await loadIccBuffer()

  if (iccPath && existsSync(iccPath)) {
    return iccPath
  }

  iccPath = join(tmpdir(), `cards-${PRINT_ICC_PROFILE.file}`)
  writeFileSync(iccPath, buffer)

  return iccPath
}

/**
 * sRGB card image → CMYK JPEG in the press profile (FOGRA39).
 * The profile is not attached to the JPEG: the PDF carries it once, as its
 * OutputIntent, and the images are plain DeviceCMYK.
 */
export async function toPrintCmykJpeg(source: Buffer) {
  return sharp(source)
    .flatten({ background: '#ffffff' })
    .withIccProfile(await getIccPath(), { attach: false })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

export type PrintPdfPage = {
  /** Card image at trim + bleed (from upscaleToPrintCanvas). */
  image: Buffer
  /** Small text in the slug, outside the bleed, to identify the page. */
  label: string
}

function asciiLabel(label: string) {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

/**
 * Crop marks at the four corners, in the slug: aligned on the trim lines,
 * starting outside the bleed so they never print on the card.
 */
function drawCropMarks(page: PDFPage, trim: { x: number, y: number, width: number, height: number }) {
  const offset = pt(PRINT_CROP_MARK_OFFSET_MM)
  const length = pt(PRINT_CROP_MARK_LENGTH_MM)
  const left = trim.x
  const right = trim.x + trim.width
  const bottom = trim.y
  const top = trim.y + trim.height
  const line = (start: { x: number, y: number }, end: { x: number, y: number }) =>
    page.drawLine({ start, end, thickness: PRINT_CROP_MARK_STROKE_PT, color: REGISTRATION })

  for (const y of [bottom, top]) {
    line({ x: left - offset - length, y }, { x: left - offset, y })
    line({ x: right + offset, y }, { x: right + offset + length, y })
  }

  for (const x of [left, right]) {
    line({ x, y: bottom - offset - length }, { x, y: bottom - offset })
    line({ x, y: top + offset }, { x, y: top + offset + length })
  }
}

/**
 * One card per page: card with bleed, crop marks in the slug, TrimBox /
 * BleedBox set, images in CMYK and the press profile as OutputIntent.
 */
export async function buildPrintPdf(options: {
  title: string
  format: CardFormat
  pages: PrintPdfPage[]
}) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const icc = await loadIccBuffer()

  doc.setTitle(options.title)
  doc.setProducer('Cards — export imprimeur')
  doc.setCreator('Cards')

  const iccStream = doc.context.flateStream(icc, { N: 4 })
  const outputIntent = doc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
    OutputCondition: PDFString.of(PRINT_ICC_PROFILE.description),
    OutputConditionIdentifier: PDFString.of(PRINT_ICC_PROFILE.identifier),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of(PRINT_ICC_PROFILE.description),
    DestOutputProfile: doc.context.register(iccStream)
  })
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([outputIntent]))

  const trimWidth = pt(options.format.trimMm.width)
  const trimHeight = pt(options.format.trimMm.height)
  const bleed = pt(PRINT_BLEED_MM)
  const slug = pt(PRINT_SLUG_MM)
  const pageWidth = trimWidth + slug * 2
  const pageHeight = trimHeight + slug * 2
  const trim = { x: slug, y: slug, width: trimWidth, height: trimHeight }
  const labelSize = 6

  for (const entry of options.pages) {
    const page = doc.addPage([pageWidth, pageHeight])
    page.setBleedBox(slug - bleed, slug - bleed, trimWidth + bleed * 2, trimHeight + bleed * 2)
    page.setTrimBox(trim.x, trim.y, trim.width, trim.height)

    const image = await doc.embedJpg(await toPrintCmykJpeg(entry.image))
    page.drawImage(image, {
      x: slug - bleed,
      y: slug - bleed,
      width: trimWidth + bleed * 2,
      height: trimHeight + bleed * 2
    })

    drawCropMarks(page, trim)

    const label = asciiLabel(entry.label)

    if (label) {
      const width = font.widthOfTextAtSize(label, labelSize)
      page.drawText(label, {
        x: (pageWidth - width) / 2,
        y: (slug - bleed - labelSize) / 2,
        size: labelSize,
        font,
        color: BLACK
      })
    }
  }

  return doc.save({ useObjectStreams: false })
}
