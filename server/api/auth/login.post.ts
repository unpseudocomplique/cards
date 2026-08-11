import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { buildSessionUser, normalizeEmail, verifyLocalPassword } from '~~/server/utils/auth'
import { db, users } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/validation'

const bodySchema = z.object({
  email: z.email({ error: 'Adresse email invalide' }),
  password: z.string().min(1, { error: 'Le mot de passe est requis' })
})

export default defineEventHandler(async (event) => {
  const body = parseBody(bodySchema, await readBody(event))
  const email = normalizeEmail(body.email)

  const result = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    picture: users.picture,
    role: users.role,
    locale: users.locale,
    isActive: users.isActive,
    provider: users.provider,
    passwordHash: users.passwordHash
  })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = result[0]

  if (!user) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }

  if (!user.passwordHash) {
    throw createError({
      statusCode: 400,
      message: user.provider === 'google'
        ? 'Ce compte utilise Google. Connectez-vous avec Google ou utilisez "Mot de passe oublié" pour ajouter aussi un mot de passe.'
        : 'Ce compte ne dispose pas encore de mot de passe.'
    })
  }

  const isValidPassword = await verifyLocalPassword(body.password, user.passwordHash)

  if (!isValidPassword) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }

  if (!user.isActive) {
    throw createError({ statusCode: 403, message: 'Compte désactivé' })
  }

  await db.update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  await setUserSession(event, {
    user: buildSessionUser(user),
    loggedInAt: Date.now()
  })

  return { success: true }
})
