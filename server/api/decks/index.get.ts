import { desc, eq } from 'drizzle-orm'
import { db, decks } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }

  return db
    .select()
    .from(decks)
    .where(eq(decks.userId, session.user.id))
    .orderBy(desc(decks.updatedAt))
})
