import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckPhotos } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxSize = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const formData = await readMultipartFormData(event)

  if (!formData?.length) {
    throw createError({ status: 400, message: 'Aucun fichier fourni' })
  }

  const file = formData.find(field => field.name === 'file')
  const label = formData.find(field => field.name === 'label')?.data.toString().trim()

  if (!file?.data || !file.type) {
    throw createError({ status: 400, message: 'Aucun fichier fourni' })
  }

  if (!allowedTypes.includes(file.type)) {
    throw createError({ status: 400, message: 'Format non supporté. Utilisez JPEG, PNG ou WebP.' })
  }

  if (file.data.length > maxSize) {
    throw createError({ status: 400, message: 'Image trop volumineuse. Limite: 2 Mo.' })
  }

  const filename = file.filename || 'photo.jpg'
  const storageKey = generateFileKey(`users/${session.user.id}/decks/${deck.id}/photos`, filename)
  const url = await uploadFile(Buffer.from(file.data), storageKey, file.type)

  const [photo] = await db
    .insert(deckPhotos)
    .values({
      deckId: deck.id,
      userId: session.user.id,
      label: label || filename.replace(/\.[^/.]+$/, ''),
      originalFilename: filename,
      mimeType: file.type,
      size: file.data.length,
      storageKey,
      url
    })
    .returning()

  return photo
})
