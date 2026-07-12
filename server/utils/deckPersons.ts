import { and, asc, eq } from 'drizzle-orm'
import { db, deckPersons, deckPhotos } from '~~/server/utils/db'

export type DeckPersonPayload = {
  id: string
  label: string
  createdAt: string
  photos: Array<{
    id: string
    personId: string | null
    label: string
    url: string
    originalFilename: string | null
    size: number
    createdAt: string
  }>
}

export async function listDeckPersons(deckId: string): Promise<DeckPersonPayload[]> {
  const [persons, photos] = await Promise.all([
    db.select().from(deckPersons).where(eq(deckPersons.deckId, deckId)).orderBy(asc(deckPersons.createdAt)),
    db.select().from(deckPhotos).where(eq(deckPhotos.deckId, deckId)).orderBy(asc(deckPhotos.createdAt))
  ])

  const photosByPersonId = new Map<string, typeof photos>()

  for (const photo of photos) {
    if (!photo.personId) {
      continue
    }

    const list = photosByPersonId.get(photo.personId) || []
    list.push(photo)
    photosByPersonId.set(photo.personId, list)
  }

  return persons.map(person => ({
    id: person.id,
    label: person.label,
    createdAt: person.createdAt.toISOString(),
    photos: (photosByPersonId.get(person.id) || []).map(photo => ({
      id: photo.id,
      personId: photo.personId,
      label: photo.label,
      url: photo.url,
      originalFilename: photo.originalFilename,
      size: photo.size,
      createdAt: photo.createdAt.toISOString()
    }))
  }))
}

export async function findOrCreateDeckPerson(options: {
  deckId: string
  userId: string
  personId?: string | null
  label: string
}) {
  if (options.personId) {
    const [existing] = await db
      .select()
      .from(deckPersons)
      .where(and(
        eq(deckPersons.id, options.personId),
        eq(deckPersons.deckId, options.deckId),
        eq(deckPersons.userId, options.userId)
      ))
      .limit(1)

    if (!existing) {
      throw createError({ status: 404, message: 'Personne introuvable' })
    }

    return existing
  }

  const [created] = await db
    .insert(deckPersons)
    .values({
      deckId: options.deckId,
      userId: options.userId,
      label: options.label
    })
    .returning()

  return created
}

/** Gemini Flash Image supports multiple refs; keep a practical per-person cap. */
export const MAX_PERSON_REFERENCE_PHOTOS = 6
