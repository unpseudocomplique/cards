import { z } from 'zod'
import { validateAuthToken } from '~~/server/utils/auth-tokens'

const querySchema = z.object({
  token: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { token } = querySchema.parse(getQuery(event))
  const authToken = await validateAuthToken(token, 'PASSWORD_RESET')

  if (!authToken) {
    throw createError({
      statusCode: 400,
      message: 'Le lien de réinitialisation est invalide ou a expiré.',
      data: {
        code: 'TOKEN_INVALID'
      }
    })
  }

  return { success: true }
})
