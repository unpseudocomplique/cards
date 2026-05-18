import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, decks } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }

  return db
    .select()
    .from(decks)
    .where(and(eq(decks.userId, session.user.id), isNull(decks.deletedAt)))
    .orderBy(desc(decks.updatedAt))
})
