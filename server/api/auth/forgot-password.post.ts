import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { normalizeEmail } from '~~/server/utils/auth'
import { createAuthToken } from '~~/server/utils/auth-tokens'
import { db, users } from '~~/server/utils/db'
import { buildAuthActionUrl, maskEmailAddress, sendPasswordResetEmail } from '~~/server/utils/email'
import { parseBody } from '~~/server/utils/validation'

const bodySchema = z.object({
  email: z.email({ error: 'Adresse email invalide' })
})

export default defineEventHandler(async (event) => {
  const body = parseBody(bodySchema, await readBody(event))
  const email = normalizeEmail(body.email)

  const result = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    isActive: users.isActive
  })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = result[0]

  if (!user) {
    console.log('[auth/forgot-password] Aucun compte éligible trouvé pour cette demande.', {
      email: maskEmailAddress(email)
    })
    return { success: true }
  }

  if (!user.isActive) {
    console.log('[auth/forgot-password] Réinitialisation ignorée pour un compte inactif.', {
      email: maskEmailAddress(user.email),
      userId: user.id
    })
    return { success: true }
  }

  const { token } = await createAuthToken({
    email: user.email,
    userId: user.id,
    purpose: 'PASSWORD_RESET'
  })

  const emailSent = await sendPasswordResetEmail(event, {
    to: user.email,
    token,
    username: user.username
  }).catch((error) => {
    console.error('[auth/forgot-password] Échec de l\'envoi de l\'email de réinitialisation.', {
      email: maskEmailAddress(user.email),
      error
    })
    return false
  })

  if (emailSent) {
    console.log('[auth/forgot-password] Email de réinitialisation envoyé.', {
      email: maskEmailAddress(user.email),
      userId: user.id
    })
  } else {
    console.log('[auth/forgot-password] Email de réinitialisation non envoyé.', {
      email: maskEmailAddress(user.email),
      userId: user.id
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth/forgot-password] Lien de secours généré pour le développement.', {
        email: maskEmailAddress(user.email),
        fallbackUrl: buildAuthActionUrl(event, '/auth/reset-password', token)
      })
    }
  }

  return { success: true }
})
