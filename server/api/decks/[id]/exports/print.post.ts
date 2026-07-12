import { eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, exportJobs } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
import { buildPrintExportZip } from '~~/server/utils/printExport'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { email: string, id: string } }
  assertCanGenerate(session.user)
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)

  const [job] = await db
    .insert(exportJobs)
    .values({
      deckId: deck.id,
      userId: session.user.id,
      type: 'zip',
      status: 'running'
    })
    .returning()

  try {
    const result = await buildPrintExportZip({
      deckId: deck.id,
      userId: session.user.id,
      deckTitle: deck.title,
      deckType: deck.type,
      settings: deck.settings,
      defaultAspectRatio: deck.type === 'tarot78' ? '9:16' : '3:4'
    })

    const [readyJob] = await db
      .update(exportJobs)
      .set({
        status: 'ready',
        storageKey: result.key,
        url: result.url,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(exportJobs.id, job!.id))
      .returning()

    return {
      job: readyJob,
      url: result.url,
      cardCount: result.cardCount,
      hasCardBack: result.hasCardBack
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export impossible'

    await db
      .update(exportJobs)
      .set({
        status: 'failed',
        errorMessage: message,
        updatedAt: new Date()
      })
      .where(eq(exportJobs.id, job!.id))

    throw createError({ status: 422, message })
  }
})
