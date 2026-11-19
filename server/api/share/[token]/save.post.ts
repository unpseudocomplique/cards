import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getCardCatalog } from '~~/server/utils/cardCatalog'
import { updateDeckProgress } from '~~/server/utils/classicCards'
import { db, deckCards, decks, deckVariantCards, deckVariants, users, type DeckStyleSettings } from '~~/server/utils/db'
import { defaultRolePrompts, defaultSuitPrompts } from '~~/shared/utils/cardPromptPresets'
import { resolveCopiedFaces } from '~~/shared/utils/deckCopy'
import type { CardFormatId } from '~~/shared/utils/printSpec'
import type { CardThemeId } from '~~/shared/utils/cardThemes'
import type { SavedSharedDeck } from '~~/shared/types/sharedDeck'

const saveSchema = z.object({
  /** Variant position as listed by GET /api/share/[token], or null for the deck itself. */
  variant: z.number().int().min(0).nullable().default(null)
})

/**
 * Save a shared deck to the visitor's account: a new deck with the finished
 * faces and back of the chosen version. Photos, persons and prompts stay with
 * the owner, and nothing is generated, so saving costs no AI call. Saving the
 * same version twice returns the existing copy.
 */
export default defineEventHandler(async (event): Promise<SavedSharedDeck> => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const userId = session.user.id
  const token = getRouterParam(event, 'token')

  if (!token || token.length < 16) {
    throw createError({ status: 404, message: 'Lien de partage introuvable' })
  }

  const parsed = saveSchema.safeParse(await readBody(event).catch(() => ({})) ?? {})

  if (!parsed.success) {
    throw createError({ status: 400, message: 'Données invalides', data: parsed.error.flatten() })
  }

  const [source] = await db
    .select({
      id: decks.id,
      userId: decks.userId,
      title: decks.title,
      description: decks.description,
      type: decks.type,
      settings: decks.settings,
      ownerName: users.username
    })
    .from(decks)
    .innerJoin(users, eq(users.id, decks.userId))
    .where(and(eq(decks.shareToken, token), isNull(decks.deletedAt)))
    .limit(1)

  if (!source) {
    throw createError({ status: 404, message: 'Lien de partage introuvable' })
  }

  let variant: typeof deckVariants.$inferSelect | null = null

  if (parsed.data.variant !== null) {
    const variants = await db
      .select()
      .from(deckVariants)
      .where(eq(deckVariants.deckId, source.id))
      .orderBy(asc(deckVariants.createdAt))
    variant = variants[parsed.data.variant] ?? null

    if (!variant) {
      throw createError({ status: 404, message: 'Variante introuvable' })
    }
  }

  // The owner already has the deck itself.
  if (source.userId === userId && !variant) {
    return { deckId: source.id, created: false }
  }

  const [existing] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(
      eq(decks.userId, userId),
      isNull(decks.deletedAt),
      sql`${decks.settings}->'copiedFrom'->>'deckId' = ${source.id}`,
      variant
        ? sql`${decks.settings}->'copiedFrom'->>'variantId' = ${variant.id}`
        : sql`${decks.settings}->'copiedFrom'->>'variantId' is null`
    ))
    .limit(1)

  if (existing) {
    return { deckId: existing.id, created: false }
  }

  const [sourceCards, overrides] = await Promise.all([
    db
      .select({
        id: deckCards.id,
        cardCode: deckCards.cardCode,
        status: deckCards.status,
        finalImageUrl: deckCards.finalImageUrl,
        metadata: deckCards.metadata
      })
      .from(deckCards)
      .where(eq(deckCards.deckId, source.id)),
    variant
      ? db
          .select({
            baseCardId: deckVariantCards.baseCardId,
            status: deckVariantCards.status,
            finalImageUrl: deckVariantCards.finalImageUrl,
            metadata: deckVariantCards.metadata
          })
          .from(deckVariantCards)
          .where(eq(deckVariantCards.variantId, variant.id))
      : Promise.resolve([])
  ])

  const faces = resolveCopiedFaces(sourceCards, overrides)
  const catalog = getCardCatalog(source.type)
  const from = source.settings
  const back = variant?.backImageUrl
    ? { url: variant.backImageUrl, format: variant.backFormat ?? undefined }
    : { url: from.cardBackImageUrl ?? null, format: from.cardBackFormat }

  // Display settings only: the owner's prompts stay private, the copy gets the defaults.
  const settings: DeckStyleSettings = {
    allowPhotoReuse: from.allowPhotoReuse ?? true,
    visualStyle: from.visualStyle,
    ...(from.colorTheme ? { colorTheme: from.colorTheme } : {}),
    ...(from.cardFormat ? { cardFormat: from.cardFormat } : {}),
    ...(from.pipCardStyle ? { pipCardStyle: from.pipCardStyle } : {}),
    rolePrompts: defaultRolePrompts,
    suitPrompts: defaultSuitPrompts,
    cardBackImageUrl: back.url,
    ...(back.url && back.format ? { cardBackFormat: back.format } : {}),
    copiedFrom: {
      deckId: source.id,
      variantId: variant?.id ?? null,
      ownerName: source.ownerName,
      copiedAt: new Date().toISOString()
    }
  }

  const deck = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(decks)
      .values({
        userId,
        title: (variant ? `${source.title} · ${variant.name}` : source.title).slice(0, 100),
        description: source.description,
        type: source.type,
        cardCount: catalog.length,
        settings
      })
      .returning({ id: decks.id })

    if (!created) {
      throw new Error('Deck copy failed')
    }

    await tx.insert(deckCards).values(catalog.map((card) => {
      const face = faces.get(card.cardCode)

      return {
        deckId: created.id,
        userId,
        cardCode: card.cardCode,
        status: face ? 'ready' as const : 'pending' as const,
        finalImageUrl: face?.finalImageUrl ?? null,
        metadata: {
          label: card.label,
          shortLabel: card.shortLabel,
          suit: card.suit,
          rank: card.rank,
          role: card.role,
          sortOrder: card.sortOrder,
          aspectRatio: card.aspectRatio,
          promptHint: card.promptHint,
          ...(face?.format ? { format: face.format as CardFormatId } : {}),
          ...(face?.design ? { design: face.design } : {}),
          ...(face?.theme ? { theme: face.theme as CardThemeId } : {})
        },
        sortOrder: card.sortOrder
      }
    }))

    return created
  })

  await updateDeckProgress(deck.id)

  return { deckId: deck.id, created: true }
})
