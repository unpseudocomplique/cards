import { createError } from 'h3'
import type { ZodType } from 'zod'

/**
 * Parse a request body with Zod and throw a client-friendly 400 error.
 * Zod 4's ZodError.message is a JSON dump of issues — never expose that raw.
 */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (!result.success) {
    const message = result.error.issues
      .map(issue => issue.message)
      .find(value => typeof value === 'string' && value.length > 0 && !value.trimStart().startsWith('['))
      || 'Données invalides'

    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message
    })
  }

  return result.data
}
