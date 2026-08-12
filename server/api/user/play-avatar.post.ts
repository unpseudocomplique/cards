import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, users } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'

const bodySchema = z.object({
  prompt: z.string().trim().min(8).max(1200),
})

/**
 * Scaffold: upload profile photo + prompt for a future play avatar (cycle 3).
 * Stores reference image + prompt on the user; 3D bake (img2threejs / Meshy) comes next.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ status: 400, message: 'Formulaire manquant' })
  }

  const promptPart = form.find(p => p.name === 'prompt')
  const filePart = form.find(p => p.name === 'photo' && p.data && p.filename)
  const parsed = bodySchema.safeParse({
    prompt: promptPart ? String(promptPart.data) : '',
  })
  if (!parsed.success) {
    throw createError({ status: 400, message: 'Prompt invalide (8–1200 caractères)' })
  }
  if (!filePart?.data?.byteLength) {
    throw createError({ status: 400, message: 'Photo manquante' })
  }

  const mime = filePart.type || 'image/jpeg'
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) {
    throw createError({ status: 400, message: 'Formats acceptés : JPEG, PNG, WebP' })
  }
  if (filePart.data.byteLength > 8 * 1024 * 1024) {
    throw createError({ status: 400, message: 'Image trop lourde (max 8 Mo)' })
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const key = generateFileKey(`users/${session.user.id}/play-avatar`, `source.${ext}`)
  const url = await uploadFile(filePart.data, key, mime)

  // Persist on picture for now; dedicated columns land with cycle-3 migration.
  await db.update(users).set({
    picture: url,
    updatedAt: new Date(),
  }).where(eq(users.id, session.user.id))

  return {
    ok: true as const,
    sourceImageUrl: url,
    prompt: parsed.data.prompt,
    status: 'queued_for_3d' as const,
    message: 'Photo enregistrée. La génération du modèle 3D de jeu arrive au prochain cycle.',
  }
})
