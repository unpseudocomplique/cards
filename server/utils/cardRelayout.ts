import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { renderCardImage } from '~~/server/utils/cardRenderer'
import { syncClassicCards } from '~~/server/utils/classicCards'
import { db, deckCards, decks, deckVariantCards } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { resolveCardImageFormat } from '~~/shared/utils/printSpec'

/**
 * Redraw stored faces when the layout of their format changed (for example
 * the index corners), from the scene and the character layer kept at
 * generation: no AI call, the painting stays exactly the same.
 */

type FaceMetadata = { format?: string | null, layoutVersion?: number | null }

/** True when a stored face was drawn with an older layout than its format's. */
export function isFaceLayoutStale(metadata?: FaceMetadata | null) {
  const format = resolveCardImageFormat(metadata)
  return (metadata?.layoutVersion ?? 1) < format.layoutVersion
}

async function readStoredFile(url: string) {
  if (url.startsWith('/')) {
    return readFile(join(process.cwd(), 'public', url.replace(/^\/+/, '')))
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Fichier inaccessible: ${url}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

type DeckRow = typeof decks.$inferSelect
type CardRow = typeof deckCards.$inferSelect

/** Draw the face again with the current layout and store it under a new key. */
async function redrawFace(options: {
  deck: DeckRow
  card: CardRow
  rawImageUrl: string
  foregroundImageUrl: string
  format: string | undefined
  storagePrefix: string
}) {
  const [scene, foreground] = await Promise.all([
    readStoredFile(options.rawImageUrl),
    readStoredFile(options.foregroundImageUrl)
  ])
  const format = resolveCardImageFormat({ format: options.format })
  const buffer = await renderCardImage(scene, options.card.metadata, foreground, {
    theme: options.deck.settings.colorTheme,
    format: format.id
  })
  const finalImageKey = generateFileKey(options.storagePrefix, 'final.png')
  // Old files stay: shared copies of the deck may still point to them.
  const finalImageUrl = await uploadFile(buffer, finalImageKey, 'image/png')

  return { finalImageKey, finalImageUrl, layoutVersion: format.layoutVersion }
}

/**
 * Bring every face of a deck (and of its variants) to the current layout.
 * Faces without a stored character layer (generated before it was kept)
 * cannot be redrawn without AI and are left as they are.
 */
export async function relayoutDeckFaces(deck: DeckRow) {
  let redrawn = 0
  let skipped = 0

  redrawn += await syncClassicCards(deck)

  const cards = await db.select().from(deckCards).where(eq(deckCards.deckId, deck.id))
  const cardsById = new Map(cards.map(card => [card.id, card]))

  for (const card of cards) {
    if (card.status !== 'ready' || card.metadata.design === 'classic' || !card.finalImageUrl || !isFaceLayoutStale(card.metadata)) {
      continue
    }

    if (!card.rawImageUrl || !card.metadata.foregroundImageUrl) {
      skipped += 1
      continue
    }

    try {
      const face = await redrawFace({
        deck,
        card,
        rawImageUrl: card.rawImageUrl,
        foregroundImageUrl: card.metadata.foregroundImageUrl,
        format: card.metadata.format,
        storagePrefix: `users/${deck.userId}/decks/${deck.id}/cards/${card.id}`
      })

      // Only if nothing regenerated the card meanwhile.
      const updated = await db
        .update(deckCards)
        .set({
          finalImageKey: face.finalImageKey,
          finalImageUrl: face.finalImageUrl,
          metadata: { ...card.metadata, layoutVersion: face.layoutVersion },
          updatedAt: new Date()
        })
        .where(and(eq(deckCards.id, card.id), eq(deckCards.finalImageUrl, card.finalImageUrl)))
        .returning({ id: deckCards.id })

      redrawn += updated.length
    } catch (error) {
      skipped += 1
      console.warn('[card.relayout] face failed', { deckId: deck.id, cardId: card.id, message: error instanceof Error ? error.message : String(error) })
    }
  }

  const overrides = await db
    .select()
    .from(deckVariantCards)
    .where(and(eq(deckVariantCards.deckId, deck.id), eq(deckVariantCards.status, 'ready'), isNotNull(deckVariantCards.finalImageUrl)))

  for (const override of overrides) {
    const base = cardsById.get(override.baseCardId)

    if (!base || !isFaceLayoutStale(override.metadata)) {
      continue
    }

    if (!override.rawImageUrl || !override.metadata.foregroundImageUrl) {
      skipped += 1
      continue
    }

    try {
      const face = await redrawFace({
        deck,
        card: base,
        rawImageUrl: override.rawImageUrl,
        foregroundImageUrl: override.metadata.foregroundImageUrl,
        format: override.metadata.format,
        storagePrefix: `users/${deck.userId}/decks/${deck.id}/variants/${override.variantId}/cards/${base.id}`
      })

      const updated = await db
        .update(deckVariantCards)
        .set({
          finalImageKey: face.finalImageKey,
          finalImageUrl: face.finalImageUrl,
          metadata: { ...override.metadata, layoutVersion: face.layoutVersion },
          updatedAt: new Date()
        })
        .where(and(eq(deckVariantCards.id, override.id), eq(deckVariantCards.finalImageUrl, override.finalImageUrl!)))
        .returning({ id: deckVariantCards.id })

      redrawn += updated.length
    } catch (error) {
      skipped += 1
      console.warn('[card.relayout] variant face failed', { deckId: deck.id, variantCardId: override.id, message: error instanceof Error ? error.message : String(error) })
    }
  }

  return { redrawn, skipped }
}

/** Every deck that still has a face drawn with an older layout. */
export async function findDecksWithStaleFaces() {
  const [cards, overrides] = await Promise.all([
    db
      .select({ deckId: deckCards.deckId, metadata: deckCards.metadata })
      .from(deckCards)
      .where(and(eq(deckCards.status, 'ready'), isNotNull(deckCards.finalImageUrl))),
    db
      .select({ deckId: deckVariantCards.deckId, metadata: deckVariantCards.metadata, rawImageUrl: deckVariantCards.rawImageUrl })
      .from(deckVariantCards)
      .where(and(eq(deckVariantCards.status, 'ready'), isNotNull(deckVariantCards.finalImageUrl)))
  ])

  const ids = new Set<string>()

  for (const card of cards) {
    // Faces that cannot be redrawn are not worth a pass.
    const redrawable = card.metadata.design === 'classic' || Boolean(card.metadata.foregroundImageUrl)
    if (redrawable && isFaceLayoutStale(card.metadata)) {
      ids.add(card.deckId)
    }
  }

  for (const override of overrides) {
    if (override.metadata.foregroundImageUrl && override.rawImageUrl && isFaceLayoutStale(override.metadata)) {
      ids.add(override.deckId)
    }
  }

  if (!ids.size) {
    return []
  }

  return db.select().from(decks).where(inArray(decks.id, [...ids]))
}

let running: Promise<void> | null = null

/** Redraw every stale face of every deck, one deck at a time. */
export function relayoutAllStaleFaces() {
  running ??= (async () => {
    try {
      const stale = await findDecksWithStaleFaces()

      for (const deck of stale) {
        const result = await relayoutDeckFaces(deck)
        console.info('[card.relayout] deck done', { deckId: deck.id, ...result })
      }
    } catch (error) {
      console.error('[card.relayout] failed', error)
    } finally {
      running = null
    }
  })()

  return running
}
