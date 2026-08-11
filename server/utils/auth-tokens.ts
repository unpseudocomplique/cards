import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { authTokens, db } from '~~/server/utils/db'

export type AuthTokenPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'

type AuthTokenRecord = {
  email: string
  expiresAt: Date
  id: string
  userId: string
  purpose: AuthTokenPurpose
  usedAt: Date | null
}

const AUTH_TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 1000 * 60 * 60 * 24,
  PASSWORD_RESET: 1000 * 60 * 30
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const findTokenRecord = async (token: string, purpose: AuthTokenPurpose) => {
  const result = await db.select({
    email: authTokens.email,
    expiresAt: authTokens.expiresAt,
    id: authTokens.id,
    userId: authTokens.userId,
    purpose: authTokens.purpose,
    usedAt: authTokens.usedAt
  })
    .from(authTokens)
    .where(and(
      eq(authTokens.tokenHash, hashToken(token)),
      eq(authTokens.purpose, purpose)
    ))
    .limit(1)

  return result[0] ?? null
}

const isTokenUsable = (record: AuthTokenRecord | null) => Boolean(
  record
  && !record.usedAt
  && record.expiresAt.getTime() > Date.now()
)

export async function createAuthToken(options: {
  email: string
  userId: string
  purpose: AuthTokenPurpose
}) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS[options.purpose])

  await db.delete(authTokens)
    .where(and(
      eq(authTokens.userId, options.userId),
      eq(authTokens.purpose, options.purpose),
      isNull(authTokens.usedAt)
    ))

  await db.insert(authTokens).values({
    email: options.email,
    expiresAt,
    userId: options.userId,
    purpose: options.purpose,
    tokenHash: hashToken(token)
  })

  return {
    expiresAt,
    token
  }
}

export async function validateAuthToken(token: string, purpose: AuthTokenPurpose) {
  const record = await findTokenRecord(token, purpose)

  if (!isTokenUsable(record)) {
    return null
  }

  return record
}

export async function consumeAuthToken(token: string, purpose: AuthTokenPurpose) {
  const record = await validateAuthToken(token, purpose)

  if (!record) {
    return null
  }

  const now = new Date()
  const updated = await db.update(authTokens)
    .set({ usedAt: now })
    .where(and(
      eq(authTokens.id, record.id),
      isNull(authTokens.usedAt)
    ))
    .returning({
      email: authTokens.email,
      expiresAt: authTokens.expiresAt,
      id: authTokens.id,
      userId: authTokens.userId,
      purpose: authTokens.purpose,
      usedAt: authTokens.usedAt
    })

  return updated[0] ?? null
}

export async function invalidateAuthTokens(userId: string, purpose: AuthTokenPurpose) {
  await db.delete(authTokens)
    .where(and(
      eq(authTokens.userId, userId),
      eq(authTokens.purpose, purpose)
    ))
}
