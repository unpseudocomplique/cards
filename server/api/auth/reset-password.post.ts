import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { hashLocalPassword } from '~~/server/utils/auth'
import { consumeAuthToken, invalidateAuthTokens, validateAuthToken } from '~~/server/utils/auth-tokens'
import { db, users } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/validation'

const bodySchema = z.object({
  token: z.string().min(1, { error: 'Lien de réinitialisation invalide' }),
  newPassword: z.string().min(8, { error: 'Le mot de passe doit contenir au moins 8 caractères' }).max(128),
  confirmPassword: z.string().min(8, { error: 'La confirmation du mot de passe est requise' }).max(128)
}).refine(body => body.newPassword === body.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

export default defineEventHandler(async (event) => {
  const body = parseBody(bodySchema, await readBody(event))
  const authToken = await validateAuthToken(body.token, 'PASSWORD_RESET')

  if (!authToken) {
    throw createError({
      statusCode: 400,
      message: 'Le lien de réinitialisation est invalide ou a expiré.'
    })
  }

  const userResult = await db.select({
    email: users.email,
    emailVerifiedAt: users.emailVerifiedAt
  })
    .from(users)
    .where(eq(users.id, authToken.userId))
    .limit(1)

  const user = userResult[0]

  if (!user) {
    throw createError({ statusCode: 404, message: 'Compte introuvable.' })
  }

  await db.update(users)
    .set({
      passwordHash: await hashLocalPassword(body.newPassword),
      passwordUpdatedAt: new Date(),
      emailVerifiedAt: user.email === authToken.email
        ? new Date()
        : user.emailVerifiedAt,
      updatedAt: new Date()
    })
    .where(eq(users.id, authToken.userId))

  await consumeAuthToken(body.token, 'PASSWORD_RESET')
  await invalidateAuthTokens(authToken.userId, 'PASSWORD_RESET')
  await invalidateAuthTokens(authToken.userId, 'EMAIL_VERIFICATION')

  return { success: true }
})
