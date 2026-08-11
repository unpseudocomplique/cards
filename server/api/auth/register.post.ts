import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { buildSessionUser, hashLocalPassword, normalizeEmail } from '~~/server/utils/auth'
import { db, users } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/validation'

const bodySchema = z.object({
  email: z.email({ error: 'Adresse email invalide' }),
  username: z.string().trim().min(2, { error: 'Le pseudo doit contenir au moins 2 caractères' }).max(30, { error: 'Le pseudo est trop long' }),
  password: z.string().min(8, { error: 'Le mot de passe doit contenir au moins 8 caractères' }).max(128),
  confirmPassword: z.string().min(8, { error: 'La confirmation du mot de passe est requise' }).max(128)
}).refine(body => body.password === body.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

export default defineEventHandler(async (event) => {
  const body = parseBody(bodySchema, await readBody(event))
  const email = normalizeEmail(body.email)

  const existingUser = await db.select({
    id: users.id
  })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser[0]) {
    throw createError({
      statusCode: 409,
      message: 'Un compte existe déjà avec cet email'
    })
  }

  const passwordHash = await hashLocalPassword(body.password)
  const now = new Date()

  const result = await db.insert(users)
    .values({
      email,
      username: body.username.trim(),
      locale: 'fr-FR',
      provider: 'local',
      passwordHash,
      passwordUpdatedAt: now,
      emailVerifiedAt: now,
      lastLoginAt: now
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      picture: users.picture,
      role: users.role,
      locale: users.locale
    })

  const user = result[0]

  if (!user) {
    throw createError({ statusCode: 500, message: 'Impossible de créer le compte' })
  }

  await setUserSession(event, {
    user: buildSessionUser(user),
    loggedInAt: Date.now()
  })

  return {
    success: true,
    email: user.email
  }
})
