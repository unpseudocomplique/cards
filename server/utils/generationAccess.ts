const allowedGeneratorEmails = new Set(['mathnewph@gmail.com'])

export function assertCanGenerate(user: { email?: string | null }) {
  const email = user.email?.trim().toLowerCase()

  if (email && allowedGeneratorEmails.has(email)) {
    return
  }

  throw createError({
    status: 403,
    message: 'La génération est temporairement réservée à mathnewph@gmail.com.'
  })
}
